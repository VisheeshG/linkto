"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase, Link, LinkClick, Project } from "@/lib/supabase";
import {
  fetchAllClicksForLinkIds,
  fetchAllLinksForProjectIds,
} from "@/lib/supabase-pagination";
import { ClicksAnalyticsChart } from "./ClicksAnalyticsChart";
import { GeoInsightsPanelClient } from "./GeoInsightsPanelLazy";
import {
  aggregateClicks,
  topEntries,
  allEntries,
  filterBotClicks,
  filterClicksInDateRange,
  summarizeTraffic,
  type BreakdownEntry,
} from "@/lib/click-aggregation";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import { BotFilterBar } from "./BotFilterBar";
import { formatDateRangeLabel } from "@/lib/analytics-date-range";
import {
  ANALYTICS_DATE_RANGE_STORAGE_KEYS,
  useAnalyticsDateRange,
} from "@/hooks/useAnalyticsDateRange";
import { AnalyticsDateRangePicker } from "./AnalyticsDateRangePicker";
import {
  BarChart3,
  Globe,
  X,
  Link2,
  Monitor,
  Chrome,
  ExternalLink,
  Copy,
  LineChart,
  Check,
  ChevronRight,
  Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import { describeError } from "@/lib/describe-error";
import { buildTrackingUrlTemplate } from "@/lib/tracking-url";

interface BrandAnalyticsPanelProps {
  projectIds: string[];
  projects?: Pick<Project, "id" | "slug" | "name">[];
  brandSlug?: string | null;
}

const PREVIEW_LIMIT = 5;

type LinkClickRow = {
  link: Link;
  brandSlug: string | null;
  projectSlug: string;
  projectName: string;
  clickCount: number;
};

function useModalLock(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);
}

function BreakdownDetailModal({
  title,
  subtitle,
  items,
  onClose,
  accent = "blue",
}: {
  title: string;
  subtitle?: string;
  items: BreakdownEntry[];
  onClose: () => void;
  accent?: "blue" | "violet" | "emerald" | "amber";
}) {
  const [search, setSearch] = useState("");
  useModalLock(onClose);

  const totalClicks = useMemo(
    () => items.reduce((sum, item) => sum + item.count, 0),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, search]);

  const accentBar = {
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  }[accent];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="clickable-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex w-full max-w-2xl max-h-[min(88vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="breakdown-modal-title"
      >
        <div className={`h-1 shrink-0 ${accentBar}`} />
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-slate-50 to-white">
          <div className="min-w-0">
            <h4
              id="breakdown-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              {title}
            </h4>
            <p className="text-sm text-slate-600 mt-0.5">
              {subtitle ??
                `${items.length.toLocaleString()} entries · ${totalClicks.toLocaleString()} clicks`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition"
          />
        </div>

        <div className="overflow-auto min-h-0 flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center px-5">
              No matches for &quot;{search.trim()}&quot;
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((item, index) => {
                const pct =
                  totalClicks > 0
                    ? ((item.count / totalClicks) * 100).toFixed(1)
                    : "0";
                return (
                  <li
                    key={`${item.label}-${index}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition"
                  >
                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 break-words">
                        {item.label}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {item.count.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {pct}%
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0 text-xs text-slate-500 text-center">
          Showing {filtered.length.toLocaleString()} of{" "}
          {items.length.toLocaleString()} · {totalClicks.toLocaleString()} total
          clicks in range
        </div>
      </div>
    </div>
  );
}

function LinkTitlesDetailModal({
  rows,
  dateLabel,
  onClose,
}: {
  rows: LinkClickRow[];
  dateLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useModalLock(onClose);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const totalClicks = useMemo(
    () => rows.reduce((sum, r) => sum + r.clickCount, 0),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.link.link_title.toLowerCase().includes(q) ||
        row.link.destination_url.toLowerCase().includes(q) ||
        row.projectName.toLowerCase().includes(q) ||
        row.link.platform.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const trackingTemplateFor = (row: LinkClickRow) =>
    buildTrackingUrlTemplate({
      baseUrl: origin,
      brandSlug: row.brandSlug,
      projectSlug: row.projectSlug,
      shortCode: row.link.short_code,
      includeSubmissionInUrl: row.link.include_submission_in_url ?? false,
    });

  const copyTrackingUrl = (row: LinkClickRow) => {
    navigator.clipboard.writeText(trackingTemplateFor(row));
    setCopiedId(row.link.id);
    toast.success("Tracking URL copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="clickable-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex w-full max-w-3xl max-h-[min(90vh,800px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="link-titles-modal-title"
      >
        <div className="h-1 shrink-0 bg-gradient-to-r from-blue-500 to-violet-500" />
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-blue-50/80 to-violet-50/50">
          <div className="min-w-0">
            <h4
              id="link-titles-modal-title"
              className="text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <Link2 className="w-5 h-5 text-blue-600 shrink-0" />
              All link titles
            </h4>
            <p className="text-sm text-slate-600 mt-1">
              {rows.length} links · {totalClicks.toLocaleString()} clicks ·{" "}
              {dateLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, URL, project, or platform..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition"
          />
        </div>

        <div className="overflow-auto min-h-0 flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center px-5">
              No links match your search.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((row, index) => {
                const pct =
                  totalClicks > 0
                    ? ((row.clickCount / totalClicks) * 100).toFixed(1)
                    : "0";
                const trackingPath = trackingTemplateFor(row).replace(
                  origin,
                  ""
                );

                return (
                  <li
                    key={row.link.id}
                    className="px-5 py-4 hover:bg-slate-50/90 transition"
                  >
                    <div className="flex gap-3">
                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700 shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {row.link.link_title}
                          </p>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900 tabular-nums">
                              {row.clickCount.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">{pct}%</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                            {row.link.platform}
                          </span>
                          <span className="text-slate-500">{row.projectName}</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-500 font-medium shrink-0">
                              Destination:
                            </span>
                            <a
                              href={row.link.destination_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline break-all inline-flex items-center gap-1"
                            >
                              {row.link.destination_url}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-500 font-medium shrink-0">
                              Tracking:
                            </span>
                            <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded break-all">
                              {origin}
                              {trackingPath}
                            </code>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <a
                            href={row.link.destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-700 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open destination
                          </a>
                          <button
                            type="button"
                            onClick={() => copyTrackingUrl(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-700 transition"
                          >
                            {copiedId === row.link.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy tracking URL
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              router.push(
                                `/dashboard/${row.link.project_id}?${row.link.id}`
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                            View analytics
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 shrink-0 text-xs text-slate-500 text-center">
          {filtered.length} of {rows.length} links shown
        </div>
      </div>
    </div>
  );
}

type SummaryCardConfig = {
  title: string;
  icon: typeof Link2;
  iconClass: string;
  iconBg: string;
  accent: "blue" | "violet" | "emerald" | "amber";
};

function SummaryCard({
  config,
  previewItems,
  allItems,
  onViewAll,
}: {
  config: SummaryCardConfig;
  previewItems: BreakdownEntry[];
  allItems: BreakdownEntry[];
  onViewAll?: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const Icon = config.icon;
  const hasMore = allItems.length > previewItems.length;
  const topCount = previewItems[0]?.count ?? 0;
  const topShare =
    allItems.reduce((s, i) => s + i.count, 0) > 0 && topCount > 0
      ? Math.round(
          (topCount / allItems.reduce((sum, i) => sum + i.count, 0)) * 100
        )
      : 0;

  const openModal = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition flex flex-col overflow-hidden">
        <div className={`h-0.5 ${config.accent === "blue" ? "bg-blue-500" : config.accent === "violet" ? "bg-violet-500" : config.accent === "emerald" ? "bg-emerald-500" : "bg-amber-500"}`} />
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${config.iconBg}`}
            >
              <Icon className={`w-4 h-4 ${config.iconClass}`} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">{config.title}</h4>
          </div>

          {previewItems.length === 0 ? (
            <p className="text-xs text-slate-500 flex-1">No data in range</p>
          ) : (
            <ul className="space-y-3 flex-1">
              {previewItems.map(({ label, count }) => (
                <li key={label}>
                  <div className="flex justify-between gap-2 text-sm mb-1">
                    <span
                      className="truncate min-w-0 text-slate-700"
                      title={label}
                    >
                      {label}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.accent === "blue" ? "bg-blue-500" : config.accent === "violet" ? "bg-violet-500" : config.accent === "emerald" ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{
                        width: `${topCount > 0 ? Math.max(8, (count / topCount) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {previewItems.length > 0 && topShare > 0 && (
            <p className="text-[11px] text-slate-400 mt-3">
              Top item: {topShare}% of category clicks
            </p>
          )}

          {allItems.length > 0 && (
            <button
              type="button"
              onClick={openModal}
              className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
            >
              {hasMore
                ? `View all ${allItems.length} entries`
                : `View details`}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showModal && !onViewAll && (
        <BreakdownDetailModal
          title={config.title}
          items={allItems}
          onClose={() => setShowModal(false)}
          accent={config.accent}
        />
      )}
    </>
  );
}

function LinkTitlesSummaryCard({
  previewRows,
  allRows,
  dateLabel,
}: {
  previewRows: LinkClickRow[];
  allRows: LinkClickRow[];
  dateLabel: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const topCount = previewRows[0]?.clickCount ?? 0;
  const totalClicks = allRows.reduce((s, r) => s + r.clickCount, 0);
  const topShare =
    totalClicks > 0 && topCount > 0
      ? Math.round((topCount / totalClicks) * 100)
      : 0;

  return (
    <>
      <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition flex flex-col overflow-hidden">
        <div className="h-0.5 bg-blue-500" />
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
              <Link2 className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Top link titles</h4>
          </div>

          {previewRows.length === 0 ? (
            <p className="text-xs text-slate-500 flex-1">No data in range</p>
          ) : (
            <ul className="space-y-3 flex-1">
              {previewRows.map((row) => (
                <li key={row.link.id}>
                  <div className="flex items-start gap-1.5 text-sm mb-1">
                    <span
                      className="flex-1 min-w-0 text-slate-700 line-clamp-2 leading-snug"
                      title={row.link.link_title}
                    >
                      {row.link.link_title}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                      {row.clickCount.toLocaleString()}
                    </span>
                    <a
                      href={row.link.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition shrink-0"
                      title={`Open: ${row.link.destination_url}`}
                      aria-label="Open destination link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${topCount > 0 ? Math.max(8, (row.clickCount / topCount) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {previewRows.length > 0 && topShare > 0 && (
            <p className="text-[11px] text-slate-400 mt-3">
              Top item: {topShare}% of link clicks
            </p>
          )}

          {allRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
            >
              {allRows.length > previewRows.length
                ? `View all ${allRows.length} links`
                : "View link details"}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <LinkTitlesDetailModal
          rows={allRows}
          dateLabel={dateLabel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export function BrandAnalyticsPanel({
  projectIds,
  projects = [],
  brandSlug = null,
}: BrandAnalyticsPanelProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [allClicks, setClicks] = useState<LinkClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideBots, setHideBots] = useHideBotClicks();
  const clicks = useMemo(
    () => filterBotClicks(allClicks, hideBots),
    [allClicks, hideBots]
  );
  const {
    rangePreset,
    startDate,
    endDate,
    allTimeRange,
    applyPreset,
    handleStartDateChange,
    handleEndDateChange,
  } = useAnalyticsDateRange(ANALYTICS_DATE_RANGE_STORAGE_KEYS.brand, clicks);

  const projectById = useMemo(() => {
    const map = new Map<string, Pick<Project, "id" | "slug" | "name">>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const loadData = useCallback(async () => {
    if (projectIds.length === 0) {
      setLinks([]);
      setClicks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const linkList = await fetchAllLinksForProjectIds(supabase, projectIds);
      setLinks(linkList);

      if (linkList.length === 0) {
        setClicks([]);
        return;
      }

      const linkIds = linkList.map((l) => l.id);
      const clicksData = await fetchAllClicksForLinkIds(supabase, linkIds);
      setClicks(clicksData);
    } catch (error) {
      console.error("Error loading brand analytics:", error);
      toast.error(
        `Couldn't load click data: ${describeError(error)}`,
        { id: "brand-analytics-load-error", duration: 8000 }
      );
    } finally {
      setLoading(false);
    }
  }, [projectIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const linkIdToTitle = useMemo(() => {
    const map: Record<string, string> = {};
    links.forEach((l) => {
      map[l.id] = l.link_title;
    });
    return map;
  }, [links]);

  const analytics = useMemo(
    () => aggregateClicks(clicks, linkIdToTitle, startDate, endDate),
    [clicks, linkIdToTitle, startDate, endDate]
  );

  const trafficSummary = useMemo(
    () => summarizeTraffic(filterClicksInDateRange(allClicks, startDate, endDate)),
    [allClicks, startDate, endDate]
  );

  const dateLabel = useMemo(
    () => formatDateRangeLabel(startDate, endDate),
    [startDate, endDate]
  );

  const linkClickRows = useMemo((): LinkClickRow[] => {
    const inRange = filterClicksInDateRange(clicks, startDate, endDate);
    const countByLinkId = new Map<string, number>();
    inRange.forEach((c) => {
      countByLinkId.set(c.link_id, (countByLinkId.get(c.link_id) ?? 0) + 1);
    });

    return links
      .map((link) => {
        const project = projectById.get(link.project_id);
        return {
          link,
          brandSlug,
          projectSlug: project?.slug ?? "",
          projectName: project?.name ?? "Unknown project",
          clickCount: countByLinkId.get(link.id) ?? 0,
        };
      })
      .filter((row) => row.clickCount > 0)
      .sort((a, b) => b.clickCount - a.clickCount);
  }, [clicks, links, startDate, endDate, projectById, brandSlug]);

  const breakdowns = useMemo(
    () => ({
      countries: allEntries(analytics.clicksByCountry),
      devices: allEntries(analytics.clicksByDevice),
      browsers: allEntries(analytics.clicksByBrowser),
      referrers: allEntries(analytics.clicksByReferrer),
    }),
    [analytics]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 text-sm">Loading brand analytics...</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <BarChart3 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600">
          No links in this brand yet. Add links to projects to see combined
          analytics.
        </p>
      </div>
    );
  }

  const linkPreview = linkClickRows.slice(0, PREVIEW_LIMIT);

  return (
    <section className="space-y-8">
      <BotFilterBar
        hideBots={hideBots}
        onChange={setHideBots}
        summary={trafficSummary}
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Combined Analytics
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {dateLabel} · {analytics.totalClicks.toLocaleString()} clicks
              {" · "}
              {analytics.uniqueVisitors.toLocaleString()} unique visitors in
              range
            </p>
          </div>
        </div>

        <div className="mb-6">
          <AnalyticsDateRangePicker
            preset={rangePreset}
            startDate={startDate}
            endDate={endDate}
            onPresetChange={applyPreset}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            minDate={allTimeRange.startDate}
            maxDate={allTimeRange.endDate}
          />
        </div>

        <ClicksAnalyticsChart
          weeklyData={analytics.clicksByWeek}
          startDate={startDate}
          endDate={endDate}
          totalClicksInRange={analytics.totalClicks}
        />
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
          Breakdown
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <LinkTitlesSummaryCard
            previewRows={linkPreview}
            allRows={linkClickRows}
            dateLabel={dateLabel}
          />
          <SummaryCard
            config={{
              title: "Top countries",
              icon: Globe,
              iconClass: "text-violet-600",
              iconBg: "bg-violet-50",
              accent: "violet",
            }}
            previewItems={topEntries(
              analytics.clicksByCountry,
              PREVIEW_LIMIT
            )}
            allItems={breakdowns.countries}
          />
          <SummaryCard
            config={{
              title: "Top devices",
              icon: Monitor,
              iconClass: "text-emerald-600",
              iconBg: "bg-emerald-50",
              accent: "emerald",
            }}
            previewItems={topEntries(analytics.clicksByDevice, PREVIEW_LIMIT)}
            allItems={breakdowns.devices}
          />
          <SummaryCard
            config={{
              title: "Top browsers",
              icon: Chrome,
              iconClass: "text-amber-600",
              iconBg: "bg-amber-50",
              accent: "amber",
            }}
            previewItems={topEntries(analytics.clicksByBrowser, PREVIEW_LIMIT)}
            allItems={breakdowns.browsers}
          />
          <SummaryCard
            config={{
              title: "Top referrers",
              icon: Share2,
              iconClass: "text-blue-600",
              iconBg: "bg-blue-50",
              accent: "blue",
            }}
            previewItems={topEntries(analytics.clicksByReferrer, PREVIEW_LIMIT)}
            allItems={breakdowns.referrers}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-slate-700" />
          <h4 className="text-lg font-bold text-slate-900">
            Geographic insights
          </h4>
        </div>
        <GeoInsightsPanelClient clicks={analytics.filteredClicks} />
      </div>
    </section>
  );
}
