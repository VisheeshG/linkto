"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  AppWindow,
  BarChart3,
  ChevronRight,
  FolderOpen,
  Globe2,
  Link2,
  MapPin,
  MousePointerClick,
  Share2,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { supabase, Link, LinkClick, Project } from "@/lib/supabase";
import {
  fetchAllClicksForLinkIds,
  fetchAllLinksForProjectIds,
} from "@/lib/supabase-pagination";
import {
  aggregateClicks,
  filterBotClicks,
  filterClicksInDateRange,
  summarizeTraffic,
} from "@/lib/click-aggregation";
import { formatDateRangeLabel } from "@/lib/analytics-date-range";
import {
  ANALYTICS_DATE_RANGE_STORAGE_KEYS,
  useAnalyticsDateRange,
} from "@/hooks/useAnalyticsDateRange";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import { describeError } from "@/lib/describe-error";
import { formatNumber } from "@/lib/format";
import { StatCard } from "./StatCard";
import { ClicksAnalyticsChart } from "./ClicksAnalyticsChart";
import { GeoInsightsPanelClient } from "./GeoInsightsPanelLazy";
import { AnalyticsToolbar } from "./analytics/AnalyticsToolbar";
import { BreakdownCard } from "./analytics/BreakdownCard";
import { TrafficQualityCard } from "./analytics/TrafficQualityCard";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Skeleton,
} from "./ui";

interface BrandAnalyticsPanelProps {
  projectIds: string[];
  projects?: Pick<Project, "id" | "slug" | "name">[];
  brandSlug?: string | null;
}

type LinkRow = { link: Link; projectName: string; clicks: number };

const TOP_LINKS = 6;

/** Ranked links across the brand; each opens that link's analytics. */
function TopLinksCard({ rows }: { rows: LinkRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, TOP_LINKS);
  const max = rows[0]?.clicks ?? 0;

  return (
    <Card>
      <CardHeader
        title="Top links"
        description="Across every project in this brand"
        icon={Link2}
        as="h3"
        className="mb-3"
      />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600">No link clicks in this range</p>
      ) : (
        <ol className="-mx-2 divide-y divide-slate-100">
          {visible.map((row) => (
            <li key={row.link.id}>
              <NextLink
                href={`/dashboard/${row.link.project_id}?link_id=${row.link.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{row.link.link_title}</p>
                  <p className="truncate text-xs text-slate-600">
                    {row.projectName} · {row.link.platform}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
                    <div
                      className="h-1.5 rounded-full bg-primary-500"
                      style={{ width: `${max ? Math.max((row.clicks / max) * 100, 2) : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatNumber(row.clicks)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </NextLink>
            </li>
          ))}
        </ol>
      )}
      {rows.length > TOP_LINKS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          {expanded ? "Show less" : `Show all ${rows.length} links`}
        </button>
      )}
    </Card>
  );
}

export function BrandAnalyticsPanel({ projectIds, projects = [] }: BrandAnalyticsPanelProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [allClicks, setClicks] = useState<LinkClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hideBots, setHideBots] = useHideBotClicks();
  const {
    rangePreset,
    startDate,
    endDate,
    allTimeRange,
    applyPreset,
    handleStartDateChange,
    handleEndDateChange,
  } = useAnalyticsDateRange(ANALYTICS_DATE_RANGE_STORAGE_KEYS.brand, allClicks);

  const projectIdsKey = projectIds.join(",");

  const loadData = useCallback(async () => {
    const ids = projectIdsKey ? projectIdsKey.split(",") : [];
    if (ids.length === 0) {
      setLinks([]);
      setClicks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const linkList = await fetchAllLinksForProjectIds(supabase, ids);
      setLinks(linkList);
      setClicks(
        linkList.length ? await fetchAllClicksForLinkIds(supabase, linkList.map((l) => l.id)) : []
      );
    } catch (error) {
      console.error("Error loading brand analytics:", error);
      setLoadError(describeError(error));
    } finally {
      setLoading(false);
    }
  }, [projectIdsKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clicks = useMemo(() => filterBotClicks(allClicks, hideBots), [allClicks, hideBots]);
  const linkIdToTitle = useMemo(
    () => Object.fromEntries(links.map((l) => [l.id, l.link_title])),
    [links]
  );
  const analytics = useMemo(
    () => aggregateClicks(clicks, linkIdToTitle, startDate, endDate),
    [clicks, linkIdToTitle, startDate, endDate]
  );
  const trafficSummary = useMemo(
    () => summarizeTraffic(filterClicksInDateRange(allClicks, startDate, endDate)),
    [allClicks, startDate, endDate]
  );
  const dateLabel = useMemo(() => formatDateRangeLabel(startDate, endDate), [startDate, endDate]);

  const projectName = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  const linkRows = useMemo((): LinkRow[] => {
    const counts = new Map<string, number>();
    for (const c of analytics.filteredClicks) counts.set(c.link_id, (counts.get(c.link_id) ?? 0) + 1);
    return links
      .map((link) => ({
        link,
        projectName: projectName[link.project_id] ?? "Unknown project",
        clicks: counts.get(link.id) ?? 0,
      }))
      .filter((r) => r.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks);
  }, [analytics.filteredClicks, links, projectName]);

  const projectClicks = useMemo(() => {
    const byProject: Record<string, number> = {};
    for (const row of linkRows) byProject[row.projectName] = (byProject[row.projectName] ?? 0) + row.clicks;
    return byProject;
  }, [linkRows]);

  const top = (record: Record<string, number>) =>
    Object.entries(record).sort((a, b) => b[1] - a[1])[0] ?? null;
  const topProject = top(projectClicks);
  const topCreator = top(analytics.clicksByCreator);

  if (loading) {
    return (
      <LoadingBlock label="Loading brand analytics">
        <Skeleton className="mb-6 h-14" />
        <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </LoadingBlock>
    );
  }

  if (loadError) {
    return <ErrorState title="Couldn't load brand analytics" message={loadError} onRetry={loadData} />;
  }

  if (links.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No links yet"
        description="Add links to this brand's projects to see combined analytics here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <AnalyticsToolbar
        range={{
          preset: rangePreset,
          startDate,
          endDate,
          minDate: allTimeRange.startDate,
          maxDate: allTimeRange.endDate,
          label: dateLabel,
          onPresetChange: applyPreset,
          onStartDateChange: handleStartDateChange,
          onEndDateChange: handleEndDateChange,
        }}
        hideBots={hideBots}
        onHideBotsChange={setHideBots}
        traffic={trafficSummary}
        idPrefix="brand-analytics"
        showFilters={false}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={hideBots ? "Genuine clicks" : "Total clicks"}
          value={analytics.totalClicks}
          icon={MousePointerClick}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          sublabel={hideBots ? `of ${formatNumber(trafficSummary.total)} incl. bots` : undefined}
        />
        <StatCard
          label="Unique visitors"
          value={analytics.uniqueVisitors}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Top project"
          value={topProject ? topProject[0] : "—"}
          icon={FolderOpen}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          sublabel={topProject ? `${formatNumber(topProject[1])} clicks` : undefined}
        />
        <StatCard
          label="Top creator"
          value={topCreator ? topCreator[0] : "—"}
          icon={Users}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sublabel={topCreator ? `${formatNumber(topCreator[1])} clicks` : undefined}
        />
      </div>

      <ClicksAnalyticsChart
        weeklyData={analytics.clicksByWeek}
        startDate={startDate}
        endDate={endDate}
        totalClicksInRange={analytics.totalClicks}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopLinksCard rows={linkRows} />
        </div>
        <TrafficQualityCard summary={trafficSummary} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard title="Creators" data={analytics.clicksByCreator} icon={Users} />
        <BreakdownCard title="Cities" data={analytics.clicksByCity} icon={MapPin} />
        <BreakdownCard title="Countries" data={analytics.clicksByCountry} icon={Globe2} />
        <BreakdownCard title="Devices" data={analytics.clicksByDevice} icon={Smartphone} />
        <BreakdownCard title="Browsers" data={analytics.clicksByBrowser} icon={AppWindow} />
        <BreakdownCard title="Referrers" data={analytics.clicksByReferrer} icon={Share2} />
      </div>

      <GeoInsightsPanelClient clicks={analytics.filteredClicks} />
    </div>
  );
}
