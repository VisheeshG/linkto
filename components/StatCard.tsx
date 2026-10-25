"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile background and icon color. */
  iconBg: string;
  iconColor: string;
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
  loading = false,
  title,
}: StatCardProps) {
  return (
    <div
      className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-5 min-w-0"
      title={title}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] leading-tight sm:text-sm font-medium text-slate-600 mb-1">
            {label}
          </p>
          {loading ? (
            <div className="h-7 sm:h-9 w-14 sm:w-20 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <p className="text-xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tabular-nums truncate">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          )}
        </div>
        <div
          className={`hidden sm:flex w-11 h-11 lg:w-12 lg:h-12 rounded-xl items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
