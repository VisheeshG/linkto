"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile background and icon color. */
  iconBg: string;
  iconColor: string;
  /** Small line under the value, e.g. "of 1,872 total". */
  sublabel?: ReactNode;
  loading?: boolean;
  title?: string;
};

/**
 * KPI tile used across dashboard, brand, project, link and shared pages.
 * Compact on phones (sits 2–3 per row, icon hidden) and roomier from `sm` up.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sublabel,
  loading = false,
  title,
}: StatCardProps) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 min-w-0 print-avoid-break"
      title={title}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1 leading-tight">
            {label}
          </p>
          {loading ? (
            <div className="h-7 sm:h-9 w-14 sm:w-20 bg-slate-200/80 rounded-md animate-pulse" />
          ) : (
            <p className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums truncate">
              {typeof value === "number" ? formatNumber(value) : value}
            </p>
          )}
          {sublabel && !loading && (
            <p className="mt-0.5 text-xs text-slate-600 truncate">{sublabel}</p>
          )}
        </div>
        <div
          aria-hidden
          className={`hidden sm:flex w-10 h-10 lg:w-11 lg:h-11 rounded-lg items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
