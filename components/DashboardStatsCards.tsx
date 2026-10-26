"use client";

import { StatCard } from "./StatCard";
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
    label: "Projects",
    icon: FolderOpen,
    iconBg: "bg-primary-50",
    iconColor: "text-primary-600",
  },
  {
    key: "links",
    label: "Links",
    icon: Link2,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    key: "clicks",
    label: "Clicks",
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
    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
      {cards.map(({ key, label, icon, iconBg, iconColor }) => (
        <StatCard
          key={key}
          label={key === "clicks" && clicksLabel ? clicksLabel : label}
          value={values[key]}
          icon={icon}
          iconBg={iconBg}
          iconColor={iconColor}
          loading={loading}
        />
      ))}
    </div>
  );
}
