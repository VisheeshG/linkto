"use client";

import { FolderOpen, Link2, MousePointerClick } from "lucide-react";

interface DashboardStatsCardsProps {
  totalProjects: number;
  totalLinks: number;
  totalClicks: number;
  /** Label for the clicks card (e.g. "Genuine Clicks" when bots are hidden). */
  clicksLabel?: string;
  loading?: boolean;
}

const cards = [
  {
    key: "projects",
    label: "Total Projects",
    icon: FolderOpen,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    key: "links",
    label: "Total Links",
    icon: Link2,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    key: "clicks",
    label: "Total Clicks",
    icon: MousePointerClick,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
] as const;

export function DashboardStatsCards({
  totalProjects,
  totalLinks,
  totalClicks,
  clicksLabel,
  loading = false,
}: DashboardStatsCardsProps) {
  const values: Record<(typeof cards)[number]["key"], number> = {
    projects: totalProjects,
    links: totalLinks,
    clicks: totalClicks,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {cards.map(({ key, label, icon: Icon, iconBg, iconColor }) => (
        <div
          key={key}
          className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600 mb-1">
                {key === "clicks" && clicksLabel ? clicksLabel : label}
              </p>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
                  {values[key].toLocaleString()}
                </p>
              )}
            </div>
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
