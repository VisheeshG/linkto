import { LinkClick, TrafficType } from "@/lib/supabase";
import { analyticsToday, parseDateKey, toAnalyticsDateKey } from "@/lib/analytics-time";
import { isHumanClick } from "@/lib/bot-detection";

export type AggregatedClickAnalytics = {
  totalClicks: number;
  uniqueVisitors: number;
  clicksByLinkTitle: Record<string, number>;
  clicksByCreator: Record<string, number>;
  clicksBySubmission: Record<string, number>;
  clicksByCountry: Record<string, number>;
  clicksByState: Record<string, number>;
  clicksByCity: Record<string, number>;
  clicksByDevice: Record<string, number>;
  clicksByBrowser: Record<string, number>;
  clicksByOs: Record<string, number>;
  clicksByReferrer: Record<string, number>;
  clicksByWeek: { week: string; clicks: number }[];
  filteredClicks: LinkClick[];
};

/** Formats a local Date's calendar fields as "YYYY-MM-DD". */
export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Day bucket of a click, in the analytics time zone. */
export function getClickDateKey(click: Pick<LinkClick, "clicked_at">): string | null {
  return click.clicked_at ? toAnalyticsDateKey(click.clicked_at) : null;
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function increment(record: Record<string, number>, key: string | null | undefined) {
  if (key) record[key] = (record[key] || 0) + 1;
}

/** Hostname of the referring page, or a "direct" label when none was sent. */
export function referrerLabel(referrer: string | null | undefined): string {
  if (!referrer) return "Direct / unknown";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "") || "Direct / unknown";
  } catch {
    return "Direct / unknown";
  }
}

/**
 * Distinct visitors (hashed IP + user agent). Clicks recorded before visitor
 * hashing existed have no hash and are each counted as one visitor.
 */
export function countUniqueVisitors(clicks: LinkClick[]): number {
  const seen = new Set<string>();
  let unhashed = 0;
  for (const click of clicks) {
    if (click.visitor_hash) seen.add(click.visitor_hash);
    else unhashed += 1;
  }
  return seen.size + unhashed;
}

/** Counts per dimension for a set of clicks (no date filtering). */
export function countClicksByDimension(clicks: LinkClick[]) {
  const result = {
    clicksByCreator: {} as Record<string, number>,
    clicksBySubmission: {} as Record<string, number>,
    clicksByCountry: {} as Record<string, number>,
    clicksByState: {} as Record<string, number>,
    clicksByCity: {} as Record<string, number>,
    clicksByDevice: {} as Record<string, number>,
    clicksByBrowser: {} as Record<string, number>,
    clicksByOs: {} as Record<string, number>,
    clicksByReferrer: {} as Record<string, number>,
  };
  for (const click of clicks) {
    increment(result.clicksByCreator, click.creator_username);
    increment(result.clicksBySubmission, click.submission_number);
    increment(result.clicksByCountry, click.country);
    increment(result.clicksByState, click.state);
    increment(result.clicksByCity, click.city);
    increment(result.clicksByDevice, click.device_type);
    increment(result.clicksByBrowser, click.browser);
    increment(result.clicksByOs, click.os);
    increment(result.clicksByReferrer, referrerLabel(click.referrer));
  }
  return result;
}

export function aggregateClicks(
  clicks: LinkClick[],
  linkIdToTitle: Record<string, string>,
  startDate: string,
  endDate: string
): AggregatedClickAnalytics {
  const filteredClicks = filterClicksInDateRange(clicks, startDate, endDate);

  const clicksByLinkTitle: Record<string, number> = {};
  const dailyClicksMap: Record<string, number> = {};

  for (const click of filteredClicks) {
    increment(clicksByLinkTitle, linkIdToTitle[click.link_id] ?? "Unknown link");
    increment(dailyClicksMap, getClickDateKey(click));
  }

  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const rangeDays: { week: string; clicks: number }[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    rangeDays.push({
      week: formatDateForDisplay(day),
      clicks: dailyClicksMap[getDateString(day)] || 0,
    });
  }

  return {
    totalClicks: filteredClicks.length,
    uniqueVisitors: countUniqueVisitors(filteredClicks),
    clicksByLinkTitle,
    ...countClicksByDimension(filteredClicks),
    clicksByWeek: rangeDays,
    filteredClicks,
  };
}

export function getDefaultWeekDateRange(
  today: Date = analyticsToday()
): { startDate: string; endDate: string } {
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: getDateString(monday),
    endDate: getDateString(sunday),
  };
}

export type BreakdownEntry = { label: string; count: number };

export function sortedEntries(
  record: Record<string, number>
): BreakdownEntry[] {
  return Object.entries(record)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function topEntries(
  record: Record<string, number>,
  limit = 5
): BreakdownEntry[] {
  return sortedEntries(record).slice(0, limit);
}

export function allEntries(record: Record<string, number>): BreakdownEntry[] {
  return sortedEntries(record);
}

export function filterClicksInDateRange(
  clicks: LinkClick[],
  startDate: string,
  endDate: string
): LinkClick[] {
  return clicks.filter((click) => {
    const dateString = getClickDateKey(click);
    return !!dateString && dateString >= startDate && dateString <= endDate;
  });
}

// ---------------------------------------------------------------------------
// Bot filtering
// ---------------------------------------------------------------------------

/** Drops non-human clicks when `hideBots` is on. */
export function filterBotClicks(clicks: LinkClick[], hideBots: boolean): LinkClick[] {
  return hideBots ? clicks.filter(isHumanClick) : clicks;
}

export type TrafficSummary = {
  total: number;
  byType: Record<TrafficType, number>;
  /** Reasons non-human clicks were flagged, most common first. */
  topReasons: BreakdownEntry[];
};

export function summarizeTraffic(clicks: LinkClick[]): TrafficSummary {
  const byType: Record<TrafficType, number> = {
    human: 0,
    bot: 0,
    datacenter: 0,
    suspicious: 0,
  };
  const reasons: Record<string, number> = {};

  for (const click of clicks) {
    const type: TrafficType = click.traffic_type ?? "human";
    byType[type] += 1;
    if (type !== "human") increment(reasons, click.bot_reason || "Unclassified");
  }

  return { total: clicks.length, byType, topReasons: topEntries(reasons, 6) };
}
