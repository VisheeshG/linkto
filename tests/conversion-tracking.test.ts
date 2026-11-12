import { readFileSync } from "fs";
import path from "path";
import vm from "vm";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendClickId,
  generateClickId,
  isTestClickId,
  isValidClickId,
} from "@/lib/click-id";
import { describeRecordStatus, parseEventPayload } from "@/lib/conversion-events";
import {
  buildFunnel,
  dateKeysToRange,
  formatMoney,
  formatRate,
  formatRevenue,
  type ConversionSummaryRow,
} from "@/lib/conversions";
import { TtlCache } from "@/lib/ttl-cache";
import { createCachedTrackingPathResolver } from "@/lib/link-resolution";
import {
  baseSnippet,
  integrationPlatforms,
  testModeUrl,
} from "@/lib/integration-snippets";
import { hashSecretKey } from "@/lib/tracking-sites";
import { isValidSlug } from "@/lib/slug-utils";

describe("click IDs", () => {
  it("generates unique, URL-safe IDs", () => {
    const ids = new Set(Array.from({ length: 500 }, generateClickId));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(isValidClickId(id)).toBe(true);
      expect(encodeURIComponent(id)).toBe(id);
    }
  });

  it("rejects anything that is not a click ID", () => {
    for (const bad of ["", "short", "has space 123", "<script>alert(1)</script>", 12345678, null, "a".repeat(65)]) {
      expect(isValidClickId(bad)).toBe(false);
    }
  });

  it("recognises test clicks", () => {
    expect(isValidClickId("lt_test_setup")).toBe(true);
    expect(isTestClickId("lt_test_setup")).toBe(true);
    expect(isTestClickId(generateClickId())).toBe(false);
  });

  it("appends lt_id while keeping existing parameters and fragments", () => {
    const url = new URL(appendClickId("https://shop.example.com/p?id=1&utm_source=linkto#reviews", "abc12345"));
    expect(url.searchParams.get("id")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("linkto");
    expect(url.searchParams.get("lt_id")).toBe("abc12345");
    expect(url.hash).toBe("#reviews");
  });

  it("replaces an lt_id already on the destination and leaves bad URLs alone", () => {
    expect(appendClickId("https://x.test/?lt_id=old", "newclick1")).toBe("https://x.test/?lt_id=newclick1");
    expect(appendClickId("not a url", "abc12345")).toBe("not a url");
  });
});

describe("parseEventPayload", () => {
  const click = "Ab3_dEf-9012xyZ0";
  const parse = (body: unknown) => parseEventPayload(body, { defaultCurrency: "INR" });
  const ok = (body: unknown) => {
    const result = parse(body);
    if (!result.ok) throw new Error(result.error);
    return result.event;
  };

  it("accepts the three standard events", () => {
    expect(ok({ event: "visit", click_id: click })).toMatchObject({ eventType: "visit", clickId: click, test: false });
    expect(ok({ event: "Signup", clickId: click, userId: 42 })).toMatchObject({ eventType: "signup", userId: "42" });
    expect(ok({ event: "purchase", click_id: click, amount: 499, currency: "usd", orderId: 1001 })).toMatchObject({
      eventType: "purchase",
      amount: 499,
      currency: "USD",
      orderId: "1001",
    });
  });

  it("normalises amounts and falls back to the site currency", () => {
    expect(ok({ event: "purchase", click_id: click, amount: "1,299.999" })).toMatchObject({
      amount: 1300,
      currency: "INR",
    });
    expect(ok({ event: "purchase", click_id: click })).toMatchObject({ amount: null, currency: null });
  });

  it("rejects bad amounts and currencies", () => {
    for (const amount of ["abc", -1, Infinity, {}, 1e13]) {
      expect(parse({ event: "purchase", click_id: click, amount }).ok).toBe(false);
    }
    expect(parse({ event: "purchase", click_id: click, amount: 1, currency: "RUPEES" }).ok).toBe(false);
  });

  it("treats other names as custom events", () => {
    expect(ok({ event: "Add_To_Cart", click_id: click, event_id: "e1" })).toMatchObject({
      eventType: "custom",
      eventName: "add_to_cart",
      eventId: "e1",
      amount: null,
    });
    expect(parse({ event: "bad name!", click_id: click }).ok).toBe(false);
  });

  it("needs a click ID or a user ID", () => {
    expect(parse({ event: "purchase", amount: 5 }).ok).toBe(false);
    expect(ok({ event: "purchase", user_id: "u1", amount: 5 })).toMatchObject({ clickId: null, userId: "u1" });
  });

  it("rejects malformed bodies and identifiers", () => {
    expect(parse(null).ok).toBe(false);
    expect(parse([]).ok).toBe(false);
    expect(parse({ click_id: click }).ok).toBe(false);
    expect(parse({ event: "visit", click_id: "no" }).ok).toBe(false);
    expect(parse({ event: "signup", click_id: click, user_id: "x".repeat(200) }).ok).toBe(false);
    expect(parse({ event: "signup", click_id: click, user_id: { a: 1 } }).ok).toBe(false);
  });

  it("flags test clicks", () => {
    expect(ok({ event: "purchase", click_id: "lt_test_setup", amount: 1 }).test).toBe(true);
  });

  it("maps database outcomes to HTTP statuses", () => {
    expect(describeRecordStatus("recorded").http).toBe(200);
    expect(describeRecordStatus("duplicate").http).toBe(200);
    expect(describeRecordStatus("unknown_click").http).toBe(404);
    expect(describeRecordStatus("forbidden").http).toBe(403);
    expect(describeRecordStatus("expired").http).toBe(410);
  });
});

describe("buildFunnel", () => {
  const row = (partial: Partial<ConversionSummaryRow>): ConversionSummaryRow => ({
    link_id: "l1",
    creator_username: "vish",
    event_type: "visit",
    event_name: "",
    currency: "",
    events: 1,
    revenue: 0,
    ...partial,
  });

  const funnel = buildFunnel({
    clicksByCreator: [
      { creator_username: "vish", clicks: 100 },
      { creator_username: "asha", clicks: 50 },
      { creator_username: "", clicks: 5 },
    ],
    summary: [
      row({ events: 80 }),
      row({ event_type: "signup", events: 20 }),
      row({ event_type: "purchase", currency: "INR", events: 4, revenue: 2000 }),
      row({ link_id: "l2", event_type: "purchase", currency: "INR", events: 1, revenue: 500 }),
      row({ creator_username: "asha", events: 40 }),
      row({ creator_username: "asha", event_type: "purchase", currency: "USD", events: 2, revenue: 90.5 }),
      row({ creator_username: "asha", event_type: "custom", event_name: "add_to_cart", events: 7 }),
    ],
  });

  it("totals every step", () => {
    expect(funnel.totals).toEqual({
      clicks: 155,
      visits: 120,
      signups: 20,
      purchases: 7,
      revenue: { INR: 2500, USD: 90.5 },
    });
    expect(funnel.hasEvents).toBe(true);
  });

  it("merges a creator across links and keeps creators with clicks only", () => {
    const vish = funnel.creators.find((c) => c.creator === "vish");
    expect(vish).toMatchObject({ clicks: 100, visits: 80, signups: 20, purchases: 5, revenue: { INR: 2500 } });
    expect(funnel.creators.find((c) => c.creator === "Unknown")).toMatchObject({ clicks: 5, visits: 0 });
  });

  it("ranks by revenue and lists custom events separately", () => {
    expect(funnel.creators.map((c) => c.creator)).toEqual(["vish", "asha", "Unknown"]);
    expect(funnel.customEvents).toEqual([{ name: "add_to_cart", count: 7 }]);
  });

  it("reports no events for clicks alone", () => {
    const empty = buildFunnel({ clicksByCreator: [{ creator_username: "a", clicks: 3 }], summary: [] });
    expect(empty.hasEvents).toBe(false);
    expect(empty.totals.clicks).toBe(3);
  });

  it("formats money, revenue and rates", () => {
    expect(formatMoney(12499.5, "INR")).toBe("₹12,499.50");
    expect(formatMoney(2500, "INR")).toBe("₹2,500");
    expect(formatMoney(5, "ZZZZ")).toBe("5 ZZZZ");
    expect(formatRevenue({})).toBe("—");
    expect(formatRevenue({ USD: 90.5, INR: 2500 })).toBe("₹2,500 + $90.50");
    expect(formatRate(1, 0)).toBe("—");
    expect(formatRate(0, 10)).toBe("0%");
    expect(formatRate(1, 40)).toBe("2.5%");
    expect(formatRate(1, 2)).toBe("50%");
  });

  it("turns calendar days into an inclusive-start, exclusive-end range", () => {
    const { from, to } = dateKeysToRange("2026-11-01", "2026-11-03");
    expect(new Date(from!).getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(new Date(to!).getTime()).toBe(new Date(2026, 10, 4).getTime());
    expect(dateKeysToRange(null, undefined)).toEqual({ from: null, to: null });
  });
});

describe("TtlCache", () => {
  it("expires entries and evicts the oldest when full", () => {
    let now = 0;
    const cache = new TtlCache<number>(2, () => now);
    cache.set("a", 1, 100);
    cache.set("b", 2, 100);
    cache.set("c", 3, 100);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    now = 100;
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(1);
  });
});

describe("cached link resolver", () => {
  type Row = Record<string, unknown>;

  function countingClient(tables: Record<string, Row[]>, failing = { value: false }) {
    let queries = 0;
    const from = (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select: () => builder,
        eq: (col: string, value: unknown) => ((rows = rows.filter((r) => r[col] === value)), builder),
        in: (col: string, values: unknown[]) => ((rows = rows.filter((r) => values.includes(r[col]))), builder),
        order: () => builder,
        limit: () => builder,
        then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) => {
          queries += 1;
          return Promise.resolve(
            resolve(failing.value ? { data: null, error: { code: "500", message: "down" } } : { data: rows, error: null })
          );
        },
      };
      return builder;
    };
    return { client: { from } as unknown as SupabaseClient, queries: () => queries };
  }

  const tables = {
    brands: [{ id: "b1", slug: "acme" }],
    projects: [{ id: "p1", slug: "sale", brand_id: "b1" }],
    links: [{ id: "l1", project_id: "p1", short_code: "abc", destination_url: "https://x.test", platform: "IG", click_id_enabled: true }],
  };

  it("hits the database once per link, whatever the creator", async () => {
    let now = 0;
    const resolve = createCachedTrackingPathResolver({ now: () => now });
    const { client, queries } = countingClient(tables);
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});

    const first = await resolve(client, "acme", ["sale", "abc", "vish"]);
    const after = queries();
    const second = await resolve(client, "acme", ["sale", "abc", "asha", "sub2"]);

    expect(first.result.status).toBe("found");
    expect(first.additionalParams).toEqual(["vish"]);
    expect(second.additionalParams).toEqual(["asha", "sub2"]);
    expect(queries()).toBe(after);
    if (first.result.status === "found") expect(first.result.link.click_id_enabled).toBe(true);

    now = 31_000;
    await resolve(client, "acme", ["sale", "abc", "vish"]);
    expect(queries()).toBeGreaterThan(after);
    silence.mockRestore();
  });

  it("caches misses briefly and never caches errors", async () => {
    let now = 0;
    const resolve = createCachedTrackingPathResolver({ now: () => now });
    const failing = { value: true };
    const { client, queries } = countingClient(tables, failing);
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await resolve(client, "acme", ["sale", "abc", "vish"])).result.status).toBe("error");
    failing.value = false;
    expect((await resolve(client, "acme", ["sale", "abc", "vish"])).result.status).toBe("found");

    const before = queries();
    expect((await resolve(client, "nope", ["x", "y", "z"])).result.status).toBe("not_found");
    const afterMiss = queries();
    await resolve(client, "nope", ["x", "y", "z"]);
    expect(queries()).toBe(afterMiss);
    expect(afterMiss).toBeGreaterThan(before);
    now = 11_000;
    await resolve(client, "nope", ["x", "y", "z"]);
    expect(queries()).toBeGreaterThan(afterMiss);
    silence.mockRestore();
  });
});

describe("integration snippets", () => {
  const ctx = { origin: "https://linkto.in", siteKey: "lt_pub_abc", currency: "USD" };

  it("puts the site key and origin in the base snippet", () => {
    const snippet = baseSnippet(ctx);
    expect(snippet).toContain('src="https://linkto.in/t.js"');
    expect(snippet).toContain('data-site="lt_pub_abc"');
    expect(snippet).toContain("linkto.q");
  });

  it("gives every platform numbered steps and never leaks a secret into browser code", () => {
    const platforms = integrationPlatforms({ ...ctx, secretKey: "lt_sec_SECRET" });
    expect(platforms.map((p) => p.id)).toEqual(["website", "shopify", "woocommerce", "gtm", "server"]);
    for (const platform of platforms) {
      expect(platform.steps.length).toBeGreaterThan(0);
      const code = platform.steps.map((s) => s.code ?? "").join("\n");
      if (platform.id === "server") expect(code).toContain("Bearer lt_sec_SECRET");
      else expect(code).not.toContain("lt_sec_");
    }
  });

  it("builds a test-mode URL from whatever the owner typed", () => {
    expect(testModeUrl("brand.com")).toBe("https://brand.com/?lt_id=lt_test_setup");
    expect(testModeUrl("http://localhost:4000/shop?a=1")).toBe("http://localhost:4000/shop?a=1&lt_id=lt_test_setup");
    expect(testModeUrl("")).toBeNull();
    expect(testModeUrl("not a url at all")).toBeNull();
  });
});

describe("keys and slugs", () => {
  it("hashes secrets the same way the database does (SHA-256 hex)", () => {
    expect(hashSecretKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("reserves app routes so a slug cannot shadow them", () => {
    expect(isValidSlug("guide")).toBe(false);
    expect(isValidSlug("dashboard")).toBe(false);
    expect(isValidSlug("guide-2026")).toBe(true);
  });
});

/** Runs public/t.js against a minimal fake browser. */
function runSnippet(options: {
  url: string;
  cookie?: string;
  queued?: unknown[][];
  site?: string | null;
}) {
  const sent: Record<string, unknown>[] = [];
  const jar = new Map<string, string>();
  for (const pair of (options.cookie ?? "").split("; ").filter(Boolean)) {
    const [k, v] = pair.split("=");
    jar.set(k, v);
  }
  const location = new URL(options.url);
  const history = {
    state: null,
    replaceState: (_s: unknown, _t: string, next: string) => {
      const updated = new URL(next, location.href);
      location.href = updated.href;
    },
  };
  const document = {
    currentScript: {
      src: "https://linkto.in/t.js",
      getAttribute: (name: string) =>
        name === "data-site" ? (options.site === undefined ? "lt_pub_abc" : options.site) : null,
    },
    querySelector: () => null,
    get cookie() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split("; ");
      const domain = attrs.find((a) => a.startsWith("domain="))?.slice(7);
      // Like a browser: refuse cookies for public suffixes.
      if (domain === ".com" || domain === ".co.uk") return;
      const [k, v] = pair.split("=");
      jar.set(k, v);
    },
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute: () => {} }),
    body: { appendChild: () => {} },
  };
  const stub: { q?: unknown[][] } = {};
  if (options.queued) stub.q = options.queued;
  const window: Record<string, unknown> = {
    linkto: options.queued ? stub : undefined,
    console: { warn: () => {} },
    fetch: (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true }) });
    },
  };
  const context = vm.createContext({
    window,
    document,
    location,
    history,
    navigator: {},
    localStorage: { getItem: () => null, setItem: () => {} },
    console: { warn: () => {} },
    fetch: window.fetch,
    URL,
    Date,
    JSON,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
  });
  vm.runInContext(readFileSync(path.join(__dirname, "../public/t.js"), "utf8"), context);
  const linkto = window.linkto as ((...args: unknown[]) => void) & { clickId: string | null };
  return { sent, jar, location, linkto };
}

describe("t.js (browser snippet)", () => {
  const click = "Ab3_dEf-9012xyZ0";

  it("stores the click ID, reports the visit and cleans the address bar", () => {
    const { sent, jar, location, linkto } = runSnippet({
      url: `https://shop.brand.com/p?ref=1&lt_id=${click}#top`,
    });
    expect(jar.get("lt_id")).toBe(click);
    expect(linkto.clickId).toBe(click);
    expect(sent).toEqual([{ site: "lt_pub_abc", event: "visit", click_id: click }]);
    expect(location.href).toBe("https://shop.brand.com/p?ref=1#top");
  });

  it("reports signups and purchases on later pages from the cookie", () => {
    const { sent, linkto } = runSnippet({ url: "https://shop.brand.com/thanks", cookie: `lt_id=${click}` });
    linkto("signup", { userId: 42 });
    linkto("purchase", { amount: 499, currency: "INR", orderId: 1001 });
    linkto("track", "add_to_cart");
    expect(sent).toEqual([
      { site: "lt_pub_abc", event: "signup", click_id: click, user_id: "42" },
      { site: "lt_pub_abc", event: "purchase", click_id: click, amount: 499, currency: "INR", order_id: "1001" },
      { site: "lt_pub_abc", event: "add_to_cart", click_id: click },
    ]);
  });

  it("replays calls made before the script finished loading", () => {
    const { sent } = runSnippet({
      url: `https://brand.com/thanks?lt_id=${click}`,
      queued: [["purchase", { amount: 10 }]],
    });
    expect(sent.map((e) => e.event)).toEqual(["visit", "purchase"]);
  });

  it("lets the most recent click win", () => {
    const { jar, linkto } = runSnippet({ url: `https://brand.com/?lt_id=${click}`, cookie: "lt_id=OlderClick000001" });
    expect(jar.get("lt_id")).toBe(click);
    expect(linkto.clickId).toBe(click);
  });

  it("sends nothing for visitors who did not come through Linkto", () => {
    const { sent, linkto } = runSnippet({ url: "https://brand.com/thanks" });
    linkto("purchase", { amount: 499 });
    linkto("signup");
    expect(sent).toEqual([]);
    expect(linkto.clickId).toBeNull();
  });

  it("ignores malformed click IDs and a missing site key", () => {
    expect(runSnippet({ url: "https://brand.com/?lt_id=<script>" }).sent).toEqual([]);
    expect(runSnippet({ url: `https://brand.com/?lt_id=${click}`, site: null }).sent).toEqual([]);
  });
});
