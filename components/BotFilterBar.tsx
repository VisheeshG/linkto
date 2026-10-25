"use client";

import { useState } from "react";
import { Bot, ChevronDown, ShieldCheck } from "lucide-react";
import type { TrafficSummary } from "@/lib/click-aggregation";
import { TRAFFIC_TYPE_LABELS } from "@/lib/bot-detection";
import type { TrafficType } from "@/lib/supabase";

const NON_HUMAN_TYPES: TrafficType[] = ["bot", "datacenter", "suspicious"];

const TYPE_DOT: Record<TrafficType, string> = {
  human: "bg-emerald-500",
  bot: "bg-rose-500",
  datacenter: "bg-amber-500",
  suspicious: "bg-violet-500",
};

type BotFilterBarProps = {
  hideBots: boolean;
  onChange: (hideBots: boolean) => void;
  /** Traffic summary of the clicks before bot filtering. */
  summary: TrafficSummary;
};

/** One-click "Hide bot clicks" switch plus a breakdown of what it removes. */
export function BotFilterBar({ hideBots, onChange, summary }: BotFilterBarProps) {
  const [showDetails, setShowDetails] = useState(false);
  const nonHuman = summary.total - summary.byType.human;
  const shown = hideBots ? summary.byType.human : summary.total;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${hideBots ? "bg-emerald-50" : "bg-slate-100"}`}
          >
            {hideBots ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <Bot className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {hideBots ? "Showing genuine visitors only" : "Showing all clicks"}
            </p>
            <p className="text-xs text-slate-600">
              {shown.toLocaleString()} of {summary.total.toLocaleString()} clicks
              {nonHuman > 0 &&
                (hideBots
                  ? ` · ${nonHuman.toLocaleString()} bot / datacenter / suspicious hidden`
                  : ` · ${nonHuman.toLocaleString()} look automated`)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {nonHuman > 0 && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              aria-expanded={showDetails}
            >
              Details
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
            </button>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm font-medium text-slate-700">Hide bot clicks</span>
            <button
              type="button"
              role="switch"
              aria-checked={hideBots}
              onClick={() => onChange(!hideBots)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                hideBots ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  hideBots ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {showDetails && nonHuman > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Traffic type
            </p>
            <ul className="space-y-1.5">
              {(["human", ...NON_HUMAN_TYPES] as TrafficType[]).map((type) => (
                <li key={type} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={`h-2 w-2 rounded-full ${TYPE_DOT[type]}`} />
                    {TRAFFIC_TYPE_LABELS[type]}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {summary.byType[type].toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Top reasons flagged
            </p>
            <ul className="space-y-1.5">
              {summary.topReasons.map((reason) => (
                <li
                  key={reason.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-slate-700 truncate">{reason.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {reason.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
