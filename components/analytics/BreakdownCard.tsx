"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { formatNumber } from "@/lib/format";

type Order = "count" | "natural";

/** Sorts "sub1, sub2, sub10" numerically and everything else by count. */
function sortEntries(record: Record<string, number>, order: Order) {
  const entries = Object.entries(record);
  if (order === "natural") {
    return entries.sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" })
    );
  }
  return entries.sort((a, b) => b[1] - a[1]);
}

/**
 * Ranked list with proportional bars ("Clicks by city" etc.). Shows the top
 * `limit` rows with a "Show all" toggle; values are also exposed as text, so
 * the bar is decorative.
 */
export function BreakdownCard({
  title,
  data,
  icon,
  limit = 8,
  order = "count",
  emptyText = "No data in this range",
  barClassName = "bg-primary-500",
  footer,
  expandable = true,
}: {
  title: string;
  data: Record<string, number>;
  icon?: LucideIcon;
  limit?: number;
  order?: Order;
  emptyText?: string;
  barClassName?: string;
  footer?: React.ReactNode;
  /** Show the in-card "Show all" toggle (off when `footer` links elsewhere). */
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = useMemo(() => sortEntries(data, order), [data, order]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);
  const visible = expanded ? entries : entries.slice(0, limit);

  return (
    <Card className="flex flex-col print-avoid-break">
      <CardHeader
        title={title}
        icon={icon}
        as="h3"
        className="mb-3"
        actions={
          entries.length > 0 ? (
            <span className="text-xs text-slate-600 tabular-nums">
              {entries.length} {entries.length === 1 ? "item" : "items"}
            </span>
          ) : undefined
        }
      />
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600">{emptyText}</p>
      ) : (
        <ol className="space-y-2.5">
          {visible.map(([label, count]) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <li key={label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-800" title={label}>
                    {label || "Unknown"}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-900">
                    <span className="font-semibold">{formatNumber(count)}</span>
                    <span className="ml-1.5 text-xs text-slate-600">{pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
                  <div
                    className={`h-1.5 rounded-full ${barClassName}`}
                    style={{ width: `${max ? Math.max((count / max) * 100, 2) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {expandable && entries.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 self-start text-sm font-medium text-primary-700 hover:text-primary-800"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
      {footer}
    </Card>
  );
}
