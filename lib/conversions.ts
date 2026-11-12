import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase-pagination";

/** One group from conversion_summary(): events for a link + creator + type. */
export type ConversionSummaryRow = {
  link_id: string;
  creator_username: string;
  event_type: "visit" | "signup" | "purchase" | "custom";
  event_name: string;
  currency: string;
  events: number;
  revenue: number;
};

export type CreatorClickRow = { creator_username: string; clicks: number };

/** Revenue per currency code, e.g. { INR: 12499.5, USD: 80 }. */
export type Revenue = Record<string, number>;

export type FunnelCounts = {
  clicks: number;
  visits: number;
  signups: number;
  purchases: number;
  revenue: Revenue;
};

export type CreatorFunnelRow = FunnelCounts & { creator: string };

export type Funnel = {
  totals: FunnelCounts;
  /** Every creator with a click or an event, best performers first. */
  creators: CreatorFunnelRow[];
  customEvents: { name: string; count: number }[];
  /** False until the first visit, signup, purchase or custom event arrives. */
  hasEvents: boolean;
};

export type ConversionData = {
  summary: ConversionSummaryRow[];
  clicksByCreator: CreatorClickRow[];
  /** True when the database has no conversion tracking yet (migration not run). */
  unavailable?: boolean;
};

export const UNKNOWN_CREATOR = "Unknown";

const emptyCounts = (): FunnelCounts => ({
  clicks: 0,
  visits: 0,
  signups: 0,
  purchases: 0,
  revenue: {},
});

/** Largest revenue first, for picking the headline currency. */
export function revenueEntries(revenue: Revenue): [string, number][] {
  return Object.entries(revenue).sort((a, b) => b[1] - a[1]);
}

function primaryRevenue(revenue: Revenue): number {
  return revenueEntries(revenue)[0]?.[1] ?? 0;
}

/** Turns database groups into the clicks → visits → signups → purchases funnel. */
export function buildFunnel(data: Pick<ConversionData, "summary" | "clicksByCreator">): Funnel {
  const totals = emptyCounts();
  const byCreator = new Map<string, CreatorFunnelRow>();
  const custom = new Map<string, number>();

  const rowFor = (name: string): CreatorFunnelRow => {
    const creator = name || UNKNOWN_CREATOR;
    let row = byCreator.get(creator);
    if (!row) {
      row = { creator, ...emptyCounts() };
      byCreator.set(creator, row);
    }
    return row;
  };

  for (const { creator_username, clicks } of data.clicksByCreator) {
    const count = Number(clicks) || 0;
    rowFor(creator_username).clicks += count;
    totals.clicks += count;
  }

  let hasEvents = false;
  for (const group of data.summary) {
    const events = Number(group.events) || 0;
    if (events === 0) continue;
    hasEvents = true;
    const row = rowFor(group.creator_username);

    switch (group.event_type) {
      case "visit":
        row.visits += events;
        totals.visits += events;
        break;
      case "signup":
        row.signups += events;
        totals.signups += events;
        break;
      case "purchase": {
        row.purchases += events;
        totals.purchases += events;
        const amount = Number(group.revenue) || 0;
        if (group.currency && amount) {
          row.revenue[group.currency] = (row.revenue[group.currency] ?? 0) + amount;
          totals.revenue[group.currency] = (totals.revenue[group.currency] ?? 0) + amount;
        }
        break;
      }
      default: {
        const name = group.event_name || "custom";
        custom.set(name, (custom.get(name) ?? 0) + events);
      }
    }
  }

  const creators = [...byCreator.values()].sort(
    (a, b) =>
      primaryRevenue(b.revenue) - primaryRevenue(a.revenue) ||
      b.purchases - a.purchases ||
      b.signups - a.signups ||
      b.visits - a.visits ||
      b.clicks - a.clicks ||
      a.creator.localeCompare(b.creator)
  );

  return {
    totals,
    creators,
    customEvents: [...custom.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    hasEvents,
  };
}

/** "₹12,499.50"; falls back to "12,499.50 XYZ" for codes Intl does not know. */
export function formatMoney(amount: number, currency: string): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** "₹12,499 + $80", or "—" when there is no revenue. */
export function formatRevenue(revenue: Revenue): string {
  const entries = revenueEntries(revenue);
  if (entries.length === 0) return "—";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
}

/** "4.2%" with one decimal below 10%; "—" when there is nothing to divide by. */
export function formatRate(part: number, total: number): string {
  if (!total) return "—";
  const pct = (part / total) * 100;
  if (pct === 0) return "0%";
  return `${pct < 10 ? pct.toFixed(1).replace(/\.0$/, "") : Math.round(pct)}%`;
}

export type ConversionRange = {
  /** Inclusive start, ISO timestamp. Omit for all time. */
  from?: string | null;
  /** Exclusive end, ISO timestamp. */
  to?: string | null;
  humanOnly?: boolean;
};

const LINK_ID_CHUNK = 500;

function isMissingFunctionError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|does not exist/i.test(error.message ?? "")
  );
}

/**
 * Loads grouped events and per-creator click counts for a set of links.
 * All counting happens in the database; the result has at most one row per
 * creator and event type, however many clicks or events there are.
 */
export async function loadConversionData(
  client: SupabaseClient,
  linkIds: string[],
  range: ConversionRange = {}
): Promise<ConversionData> {
  const summary: ConversionSummaryRow[] = [];
  const clicks = new Map<string, number>();
  if (linkIds.length === 0) return { summary, clicksByCreator: [] };

  try {
    for (let i = 0; i < linkIds.length; i += LINK_ID_CHUNK) {
      const chunk = linkIds.slice(i, i + LINK_ID_CHUNK);
      const [summaryRows, clickRows] = await Promise.all([
        fetchAllPages<ConversionSummaryRow>(async (from, to) =>
          client
            .rpc("conversion_summary", {
              p_link_ids: chunk,
              p_from: range.from ?? null,
              p_to: range.to ?? null,
            })
            .range(from, to)
        ),
        fetchAllPages<CreatorClickRow>(async (from, to) =>
          client
            .rpc("click_counts_per_creator", {
              p_link_ids: chunk,
              p_human_only: range.humanOnly ?? false,
              p_from: range.from ?? null,
              p_to: range.to ?? null,
            })
            .range(from, to)
        ),
      ]);
      summary.push(...summaryRows);
      for (const row of clickRows) {
        clicks.set(
          row.creator_username,
          (clicks.get(row.creator_username) ?? 0) + Number(row.clicks)
        );
      }
    }
  } catch (error) {
    if (isMissingFunctionError(error as { code?: string; message?: string })) {
      return { summary: [], clicksByCreator: [], unavailable: true };
    }
    throw error;
  }

  return {
    summary,
    clicksByCreator: [...clicks.entries()].map(([creator_username, count]) => ({
      creator_username,
      clicks: count,
    })),
  };
}

/** Calendar days ("YYYY-MM-DD", viewer's zone) → timestamp bounds for a query. */
export function dateKeysToRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { from: string | null; to: string | null } {
  const parse = (key: string, addDays: number) => {
    const [y, m, d] = key.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d + addDays).toISOString();
  };
  return {
    from: startDate ? parse(startDate, 0) : null,
    to: endDate ? parse(endDate, 1) : null,
  };
}
