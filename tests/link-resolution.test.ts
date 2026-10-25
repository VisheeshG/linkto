import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveLinkByBrandProjectAndShortCode,
  resolveLinkByProjectSlugAndShortCode,
  resolveTrackingPath,
} from "@/lib/link-resolution";
import { classifyServiceKey } from "@/lib/supabase-admin";

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };

/**
 * Minimal in-memory stand-in for the supabase-js query builder, supporting
 * only the chained calls the resolver uses: select / eq / in / order / limit,
 * awaited directly. Tables can be set to fail with a PostgREST-style error.
 */
function fakeClient(tables: Record<string, Row[]>, failing: Record<string, DbError> = {}) {
  const calls: { table: string; filters: string[] }[] = [];

  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let limit: number | null = null;
    const call = { table, filters: [] as string[] };
    calls.push(call);

    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => {
        call.filters.push(`eq:${col}`);
        rows = rows.filter((r) => r[col] === value);
        return builder;
      },
      in: (col: string, values: unknown[]) => {
        call.filters.push(`in:${col}`);
        rows = rows.filter((r) => values.includes(r[col]));
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const dir = opts?.ascending === false ? -1 : 1;
        rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -dir : dir));
        return builder;
      },
      limit: (n: number) => {
        limit = n;
        return builder;
      },
      then: (resolve: (v: { data: Row[] | null; error: DbError | null }) => unknown) => {
        if (failing[table]) return Promise.resolve(resolve({ data: null, error: failing[table] }));
        const data = limit === null ? rows : rows.slice(0, limit);
        return Promise.resolve(resolve({ data, error: null }));
      },
    };
    return builder;
  };

  return { client: { from } as unknown as SupabaseClient, calls };
}

const brands: Row[] = [
  { id: "b1", slug: "timebucks", user_id: "u1" },
  // Brand slugs are only unique per user: another user owns the same slug.
  { id: "b2", slug: "timebucks", user_id: "u2" },
];
const projects: Row[] = [
  { id: "p1", slug: "other", brand_id: "b1" },
  { id: "p2", slug: "w", brand_id: "b2" },
  { id: "p3", slug: "legacy-proj", brand_id: null },
];
const links: Row[] = [
  {
    id: "l1",
    project_id: "p2",
    short_code: "kx700",
    destination_url: "https://example.com/offer",
    platform: "YouTube",
    created_at: "2026-01-01T00:00:00Z",
    // Deliberately no utm_enabled / expires_at / submission_number columns:
    // production may lack them.
  },
  {
    id: "l2",
    project_id: "p3",
    short_code: "abc12",
    destination_url: "https://example.com/legacy",
    platform: "Instagram",
    submission_number: "sub1",
    utm_enabled: true,
    expires_at: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("link resolution", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("resolves a branded link when several brands share the slug", async () => {
    const { client } = fakeClient({ brands, projects, links });
    const result = await resolveLinkByBrandProjectAndShortCode(client, "timebucks", "w", "kx700");
    expect(result).toEqual({
      status: "found",
      link: {
        id: "l1",
        destination_url: "https://example.com/offer",
        platform: "YouTube",
        submission_number: null,
        open_app_on_mobile: false,
        include_submission_in_url: false,
        utm_enabled: false,
        expires_at: null,
        project_slug: "w",
      },
    });
  });

  it("uses plain filters only (no embedded / nested resource filters)", async () => {
    const { client, calls } = fakeClient({ brands, projects, links });
    await resolveLinkByBrandProjectAndShortCode(client, "timebucks", "w", "kx700");
    expect(calls.map((c) => c.table)).toEqual(["brands", "projects", "links"]);
    for (const c of calls) {
      for (const f of c.filters) expect(f).not.toContain(".");
    }
  });

  it("returns not_found for unknown brand, project or short code", async () => {
    const { client } = fakeClient({ brands, projects, links });
    expect(await resolveLinkByBrandProjectAndShortCode(client, "nope", "w", "kx700")).toEqual({
      status: "not_found",
    });
    expect(await resolveLinkByBrandProjectAndShortCode(client, "timebucks", "x", "kx700")).toEqual({
      status: "not_found",
    });
    expect(await resolveLinkByBrandProjectAndShortCode(client, "timebucks", "w", "zzz")).toEqual({
      status: "not_found",
    });
  });

  it("does not match a project under a different brand slug", async () => {
    const { client } = fakeClient({
      brands: [...brands, { id: "b3", slug: "acme", user_id: "u3" }],
      projects,
      links,
    });
    expect(await resolveLinkByBrandProjectAndShortCode(client, "acme", "w", "kx700")).toEqual({
      status: "not_found",
    });
  });

  it("resolves a legacy link and keeps its feature columns", async () => {
    const { client } = fakeClient({ brands, projects, links });
    const result = await resolveLinkByProjectSlugAndShortCode(client, "legacy-proj", "abc12");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.link.project_slug).toBe("legacy-proj");
      expect(result.link.submission_number).toBe("sub1");
      expect(result.link.utm_enabled).toBe(true);
    }
  });

  it("reports database errors as errors, not not_found, and logs them", async () => {
    const { client } = fakeClient(
      { brands, projects, links },
      { links: { code: "42703", message: "column links.utm_enabled does not exist" } }
    );
    const result = await resolveLinkByBrandProjectAndShortCode(client, "timebucks", "w", "kx700");
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.error).toContain("42703");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[redirect]"));
  });

  describe("resolveTrackingPath", () => {
    it("tries the branded form first for >= 3 segments", async () => {
      const { client } = fakeClient({ brands, projects, links });
      const { result, additionalParams } = await resolveTrackingPath(client, "timebucks", [
        "w",
        "kx700",
        "[creator]",
      ]);
      expect(result.status).toBe("found");
      expect(additionalParams).toEqual(["[creator]"]);
    });

    it("falls back to the legacy form", async () => {
      const { client } = fakeClient({ brands, projects, links });
      const { result, additionalParams } = await resolveTrackingPath(client, "legacy-proj", [
        "abc12",
        "alice",
        "sub2",
      ]);
      expect(result.status).toBe("found");
      expect(additionalParams).toEqual(["alice", "sub2"]);
    });

    it("returns not_found when nothing matches", async () => {
      const { client } = fakeClient({ brands, projects, links });
      const { result } = await resolveTrackingPath(client, "nothing", ["here", "at", "all"]);
      expect(result).toEqual({ status: "not_found" });
    });

    it("surfaces an error instead of not_found when the branded lookup fails", async () => {
      const { client } = fakeClient(
        { brands, projects, links },
        { brands: { code: "PGRST301", message: "JWT invalid" } }
      );
      const { result } = await resolveTrackingPath(client, "timebucks", ["w", "kx700", "c"]);
      expect(result.status).toBe("error");
    });
  });
});

describe("classifyServiceKey", () => {
  const jwt = (payload: object) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

  it("classifies keys without needing the secret", () => {
    expect(classifyServiceKey(undefined)).toBe("missing");
    expect(classifyServiceKey("  ")).toBe("missing");
    expect(classifyServiceKey(jwt({ role: "service_role" }))).toBe("service_role");
    expect(classifyServiceKey(jwt({ role: "anon" }))).toBe("anon");
    expect(classifyServiceKey("sb_secret_abc")).toBe("secret");
    expect(classifyServiceKey("sb_publishable_abc")).toBe("publishable");
    expect(classifyServiceKey("garbage")).toBe("unknown");
  });
});
