import { afterEach, describe, expect, it } from "vitest";
import type { LinkClick } from "@/lib/supabase";
import {
  aggregateClicks,
  countUniqueVisitors,
  filterBotClicks,
  filterClicksInDateRange,
  getClickDateKey,
  referrerLabel,
  summarizeTraffic,
} from "@/lib/click-aggregation";
import { getAnalyticsTimeZone, toAnalyticsDateKey } from "@/lib/analytics-time";

function click(overrides: Partial<LinkClick>): LinkClick {
  return {
    id: Math.random().toString(36).slice(2),
    link_id: "link-1",
    creator_username: "alice",
    submission_number: "sub1",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    device_type: "mobile",
    browser: "Chrome",
    os: "Android",
    referrer: null,
    clicked_at: "2026-10-20T10:00:00Z",
    traffic_type: "human",
    bot_reason: null,
    visitor_hash: null,
    ...overrides,
  };
}

describe("analytics time zone", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ANALYTICS_TIME_ZONE;
  });

  it("buckets an instant by calendar day in the given zone", () => {
    // 20:00 UTC is 01:30 the next day in IST, still the same day in New York.
    expect(toAnalyticsDateKey("2026-10-20T20:00:00Z", "Asia/Kolkata")).toBe("2026-10-21");
    expect(toAnalyticsDateKey("2026-10-20T20:00:00Z", "UTC")).toBe("2026-10-20");
    expect(toAnalyticsDateKey("2026-10-20T20:00:00Z", "America/New_York")).toBe("2026-10-20");
  });

  it("defaults to the viewer's own time zone", () => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(getAnalyticsTimeZone()).toBe(viewerZone);
    expect(getClickDateKey({ clicked_at: "2026-10-20T20:00:00Z" })).toBe(
      toAnalyticsDateKey("2026-10-20T20:00:00Z", viewerZone)
    );
  });

  it("can be pinned to one zone for every viewer", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_TIME_ZONE = "Asia/Kolkata";
    expect(getAnalyticsTimeZone()).toBe("Asia/Kolkata");
    const clicks = [
      click({ clicked_at: "2026-10-20T20:00:00Z" }),
      click({ clicked_at: "2026-10-20T10:00:00Z" }),
    ];
    expect(filterClicksInDateRange(clicks, "2026-10-21", "2026-10-21")).toHaveLength(1);
  });
});

describe("aggregateClicks", () => {
  it("builds a zero-filled daily series for the whole range", () => {
    const result = aggregateClicks(
      [
        click({ clicked_at: "2026-10-20T05:00:00Z" }),
        click({ clicked_at: "2026-10-20T06:00:00Z" }),
        click({ clicked_at: "2026-10-22T06:00:00Z" }),
      ],
      { "link-1": "My link" },
      "2026-10-20",
      "2026-10-22"
    );
    expect(result.totalClicks).toBe(3);
    expect(result.clicksByWeek.map((d) => d.clicks)).toEqual([2, 0, 1]);
    expect(result.clicksByWeek[0].week).toBe("Oct 20");
    expect(result.clicksByLinkTitle).toEqual({ "My link": 3 });
    expect(result.clicksByOs).toEqual({ Android: 3 });
    expect(result.clicksByReferrer).toEqual({ "Direct / unknown": 3 });
  });
});

describe("bot filtering", () => {
  const clicks = [
    click({ traffic_type: "human" }),
    click({ traffic_type: null }),
    click({ traffic_type: "bot", bot_reason: "WhatsApp link preview" }),
    click({ traffic_type: "bot", bot_reason: "WhatsApp link preview" }),
    click({ traffic_type: "datacenter", bot_reason: "Google network (AS15169)" }),
    click({ traffic_type: "suspicious", bot_reason: "Missing Accept-Language header" }),
  ];

  it("hides non-human clicks only when enabled", () => {
    expect(filterBotClicks(clicks, true)).toHaveLength(2);
    expect(filterBotClicks(clicks, false)).toHaveLength(6);
  });

  it("summarizes traffic types and reasons", () => {
    const summary = summarizeTraffic(clicks);
    expect(summary.total).toBe(6);
    expect(summary.byType).toEqual({ human: 2, bot: 2, datacenter: 1, suspicious: 1 });
    expect(summary.topReasons[0]).toEqual({ label: "WhatsApp link preview", count: 2 });
  });
});

describe("helpers", () => {
  it("counts unique visitors, treating unhashed legacy clicks individually", () => {
    expect(
      countUniqueVisitors([
        click({ visitor_hash: "a" }),
        click({ visitor_hash: "a" }),
        click({ visitor_hash: "b" }),
        click({ visitor_hash: null }),
      ])
    ).toBe(3);
  });

  it("labels referrers by hostname", () => {
    expect(referrerLabel("https://www.instagram.com/p/abc")).toBe("instagram.com");
    expect(referrerLabel("android-app://com.google.android.gm/")).toBe("com.google.android.gm");
    expect(referrerLabel(null)).toBe("Direct / unknown");
    expect(referrerLabel("not a url")).toBe("Direct / unknown");
  });
});

describe("format helpers", async () => {
  const { formatCompact, formatNumber, formatPercent, formatRelative } = await import("@/lib/format");
  it("formats numbers the Indian way", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(12400)).toBe("12.4K");
    expect(formatCompact(120000)).toBe("1.2L");
    expect(formatCompact(34000000)).toBe("3.4Cr");
    expect(formatPercent(1, 3)).toBe("33%");
    expect(formatPercent(1, 0)).toBe("0%");
  });
  it("formats relative times", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    expect(formatRelative("2026-10-25T11:59:30Z", now)).toBe("just now");
    expect(formatRelative("2026-10-25T10:00:00Z", now)).toBe("2h ago");
    expect(formatRelative("2026-10-22T12:00:00Z", now)).toBe("3d ago");
    expect(formatRelative(null, now)).toBeNull();
  });
});
