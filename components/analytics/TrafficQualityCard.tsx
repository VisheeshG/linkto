"use client";

import { ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { TRAFFIC_TYPE_LABELS } from "@/lib/bot-detection";
import type { TrafficSummary } from "@/lib/click-aggregation";
import type { TrafficType } from "@/lib/supabase";
import { formatNumber, formatPercent } from "@/lib/format";

/** Color per traffic type, used consistently in this card and elsewhere. */
export const TRAFFIC_COLORS: Record<TrafficType, string> = {
  human: "bg-emerald-500",
  bot: "bg-rose-500",
  datacenter: "bg-amber-500",
  suspicious: "bg-violet-500",
};

const ORDER: TrafficType[] = ["human", "bot", "datacenter", "suspicious"];

/** How much of the traffic is genuine, and why the rest was flagged. */
export function TrafficQualityCard({ summary }: { summary: TrafficSummary }) {
  const genuinePct = formatPercent(summary.byType.human, summary.total);

  return (
    <Card className="print-avoid-break">
      <CardHeader
        title="Traffic quality"
        description={
          summary.total
            ? `${genuinePct} of clicks in this range are genuine visitors`
            : "No clicks in this range"
        }
        icon={ShieldCheck}
        as="h3"
        className="mb-3"
      />
      {summary.total > 0 && (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
            {ORDER.map((type) =>
              summary.byType[type] ? (
                <div
                  key={type}
                  className={TRAFFIC_COLORS[type]}
                  style={{ width: `${(summary.byType[type] / summary.total) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-y-1.5 text-sm">
            {ORDER.map((type) => (
              <li key={type} className="flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-2 min-w-0 text-slate-700">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TRAFFIC_COLORS[type]}`} aria-hidden />
                  <span className="truncate">{TRAFFIC_TYPE_LABELS[type]}</span>
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatNumber(summary.byType[type])}
                </span>
              </li>
            ))}
          </ul>
          {summary.topReasons.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Why clicks were flagged
              </p>
              <ul className="space-y-1.5 text-sm">
                {summary.topReasons.map((reason) => (
                  <li key={reason.label} className="flex items-center justify-between gap-3">
                    <span className="truncate text-slate-700">{reason.label}</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {formatNumber(reason.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
