// All analytics dates are bucketed in one fixed time zone so every viewer
// (owner, client, teammate abroad) sees the same daily numbers.
// Configure with NEXT_PUBLIC_ANALYTICS_TIME_ZONE (IANA name); defaults to IST.

export const ANALYTICS_TIME_ZONE =
  process.env.NEXT_PUBLIC_ANALYTICS_TIME_ZONE || "Asia/Kolkata";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      // Invalid zone name: fall back to UTC rather than crashing analytics.
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** "YYYY-MM-DD" of an instant in the analytics time zone. */
export function toAnalyticsDateKey(
  instant: Date | string,
  timeZone: string = ANALYTICS_TIME_ZONE
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = getFormatter(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Parses "YYYY-MM-DD" into a local-midnight Date for calendar arithmetic. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Today in the analytics time zone, as a local-midnight Date. */
export function analyticsToday(now: Date = new Date()): Date {
  return parseDateKey(toAnalyticsDateKey(now));
}
