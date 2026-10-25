import type { LinkClick } from "@/lib/supabase";
import {
  getClickDateKey,
  getDateString,
  getDefaultWeekDateRange,
} from "@/lib/click-aggregation";
import { analyticsToday } from "@/lib/analytics-time";

export type DateRangePreset =
  | "all_time"
  | "this_month"
  | "this_week"
  | "yesterday"
  | "today"
  | "last_month"
  | "last_3_months"
  | "ytd"
  | "custom";

export const DATE_RANGE_PRESET_OPTIONS: {
  id: DateRangePreset;
  label: string;
}[] = [
  { id: "all_time", label: "All time" },
  { id: "this_month", label: "This month" },
  { id: "this_week", label: "This week" },
  { id: "yesterday", label: "Yesterday" },
  { id: "today", label: "Today" },
  { id: "last_month", label: "Last month" },
  { id: "last_3_months", label: "Last 3 months" },
  { id: "ytd", label: "YTD" },
  { id: "custom", label: "Custom range" },
];

export function getTodayDateString(): string {
  return getDateString(analyticsToday());
}

export function getAllTimeDateRange(clicks: LinkClick[]): {
  startDate: string;
  endDate: string;
} {
  const endDate = getTodayDateString();
  if (clicks.length === 0) {
    return { startDate: endDate, endDate };
  }

  let startDate = endDate;
  for (const click of clicks) {
    const d = getClickDateKey(click);
    if (d && d < startDate) startDate = d;
  }
  return { startDate, endDate };
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function resolveDateRangePreset(
  preset: DateRangePreset,
  clicks: LinkClick[] = []
): { startDate: string; endDate: string } {
  const today = analyticsToday();
  const todayStr = getDateString(today);

  switch (preset) {
    case "all_time":
      return getAllTimeDateRange(clicks);
    case "this_month":
      return {
        startDate: getDateString(startOfMonth(today)),
        endDate: todayStr,
      };
    case "this_week":
      return getDefaultWeekDateRange(today);
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = getDateString(y);
      return { startDate: s, endDate: s };
    }
    case "today":
      return { startDate: todayStr, endDate: todayStr };
    case "last_month": {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        startDate: getDateString(startOfMonth(prev)),
        endDate: getDateString(endOfMonth(prev)),
      };
    }
    case "last_3_months": {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 3);
      return { startDate: getDateString(start), endDate: todayStr };
    }
    case "ytd":
      return {
        startDate: getDateString(new Date(today.getFullYear(), 0, 1)),
        endDate: todayStr,
      };
    case "custom":
    default:
      return getDefaultWeekDateRange(today);
  }
}

export function formatDateRangeLabel(startDate: string, endDate: string): string {
  const fmt = (s: string) =>
    new Date(s + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (startDate === endDate) return fmt(startDate);
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}
