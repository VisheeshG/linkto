import { describe, expect, it } from "vitest";
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
import { toAnalyticsDateKey } from "@/lib/analytics-time";

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
  it("buckets clicks by the analytics time zone, not UTC", () => {
    // 20:00 UTC is 01:30 the next day in IST (the default zone).
    expect(getClickDateKey({ clicked_at: "2026-10-20T20:00:00Z" })).toBe("2026-10-21");
    expect(toAnalyticsDateKey("2026-10-20T20:00:00Z", "UTC")).toBe("2026-10-20");
    expect(toAnalyticsDateKey("2026-10-20T20:00:00Z", "America/New_York")).toBe("2026-10-20");
  });

  it("filters date ranges using the same buckets", () => {
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
