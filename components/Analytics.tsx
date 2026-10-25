"use client";

import { StatCard } from "@/components/StatCard";
import { AppHeader, type Crumb } from "@/components/app/AppHeader";
import {
  Badge,
  Button,
  CopyButton,
  DropdownMenu,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Skeleton,
  TabPanel,
  Tabs,
  buttonClasses,
  type TabItem,
} from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { AnalyticsToolbar, type DateRangeState } from "./analytics/AnalyticsToolbar";
import { BreakdownCard } from "./analytics/BreakdownCard";
import { CreatorDetailDialog } from "./analytics/CreatorDetailDialog";
import { CreatorTable } from "./analytics/CreatorTable";
import { LinkSetupPanel } from "./analytics/LinkSetupPanel";
import { TrafficQualityCard } from "./analytics/TrafficQualityCard";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, LinkClick } from "@/lib/supabase";
import {
  ClickSource,
  OWNER_CLICK_SOURCE,
  loadClicksForLink,
} from "@/lib/click-source";
import {
  AppWindow,
  ArrowLeft,
  Building2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe2,
  Hash,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Monitor,
  MousePointerClick,
  Settings2,
  Share2,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { ClicksAnalyticsChart } from "./ClicksAnalyticsChart";
import { GeoInsightsPanelClient } from "./GeoInsightsPanelLazy";
import {
  AggregatedClickAnalytics,
  aggregateClicks,
  filterBotClicks,
  filterClicksInDateRange,
  summarizeTraffic,
} from "@/lib/click-aggregation";
import { parseDateKey } from "@/lib/analytics-time";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import {
  ClickFilters,
  CreatorTableSortColumn,
  DEFAULT_CLICK_FILTERS,
  FILTER_ALL,
  SortDirection,
  buildCreatorRows,
  extractFilterOptions,
  matchesClickFilters,
  sortCreatorRows,
} from "@/lib/click-filters";
import {
  buildTrackingUrlExample,
  buildTrackingUrlTemplate,
} from "@/lib/tracking-url";
import { formatDateRangeLabel } from "@/lib/analytics-date-range";
import {
  ANALYTICS_DATE_RANGE_STORAGE_KEYS,
  useAnalyticsDateRange,
} from "@/hooks/useAnalyticsDateRange";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import { describeError } from "@/lib/describe-error";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface AnalyticsProps {
  link: Link;
  onBack: () => void;
  projectSlug: string;
  brandSlug?: string | null;
  /** Defaults to the signed-in owner's Supabase session. */
  clickSource?: ClickSource;
  /** Breadcrumbs for the app header (owner view). */
  crumbs?: Crumb[];
  /** Shown above the title on the shared client page. */
  projectName?: string;
}

type AnalyticsTab = "overview" | "creators" | "audience" | "map" | "setup";


export function Analytics({
  link,
  onBack,
  projectSlug,
  brandSlug = null,
  clickSource = OWNER_CLICK_SOURCE,
  crumbs,
  projectName,
}: AnalyticsProps) {
  const [allClicks, setAllClicks] = useState<LinkClick[]>([]);
  const [hideBots, setHideBots] = useHideBotClicks();
  const [clickFilters, setClickFilters] =
    useState<ClickFilters>(DEFAULT_CLICK_FILTERS);
  const [creatorModalFilters, setCreatorModalFilters] =
    useState<ClickFilters>(DEFAULT_CLICK_FILTERS);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const {
    rangePreset,
    startDate,
    endDate,
    allTimeRange,
    applyPreset,
    handleStartDateChange,
    handleEndDateChange,
  } = useAnalyticsDateRange(ANALYTICS_DATE_RANGE_STORAGE_KEYS.project, allClicks);
  const [creatorRawClicks, setCreatorRawClicks] = useState<LinkClick[] | null>(
    null
  );
  const creatorAnalytics = useMemo(
    () =>
      creatorRawClicks
        ? { clicks: filterBotClicks(creatorRawClicks, hideBots) }
        : null,
    [creatorRawClicks, hideBots]
  );
  const [creatorTableSort, setCreatorTableSort] = useState<{
    column: CreatorTableSortColumn;
    direction: SortDirection;
  }>({ column: "totalClicks", direction: "desc" });
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const clicks = await loadClicksForLink(clickSource, link.id);
      setAllClicks(clicks);
    } catch (error) {
      console.error("Error loading analytics:", error);
      setLoadError(describeError(error));
    } finally {
      setLoading(false);
    }
  }, [clickSource, link.id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const visibleClicks = useMemo(
    () => filterBotClicks(allClicks, hideBots),
    [allClicks, hideBots]
  );

  const filterOptions = useMemo(
    () =>
      extractFilterOptions(visibleClicks, clickFilters.country, clickFilters.state),
    [visibleClicks, clickFilters.country, clickFilters.state]
  );

  // Dimension + date filters applied to all traffic; the bot filter is applied
  // last so the bot summary describes exactly what the toggle hides.
  const dateFilteredAllTraffic = useMemo(
    () =>
      filterClicksInDateRange(
        allClicks.filter((click) => matchesClickFilters(click, clickFilters)),
        startDate,
        endDate
      ),
    [allClicks, clickFilters, startDate, endDate]
  );

  const trafficSummary = useMemo(
    () => summarizeTraffic(dateFilteredAllTraffic),
    [dateFilteredAllTraffic]
  );

  const dateFilteredClicks = useMemo(
    () => filterBotClicks(dateFilteredAllTraffic, hideBots),
    [dateFilteredAllTraffic, hideBots]
  );

  const data: AggregatedClickAnalytics = useMemo(
    () =>
      aggregateClicks(
        dateFilteredClicks,
        { [link.id]: link.link_title },
        startDate,
        endDate
      ),
    [dateFilteredClicks, link.id, link.link_title, startDate, endDate]
  );

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(startDate, endDate),
    [startDate, endDate]
  );

  const exportRows = useMemo(
    () =>
      data.filteredClicks.map((click, index) => ({
        "S.No": index + 1,
        "Clicked At": click.clicked_at
          ? new Date(click.clicked_at).toLocaleString()
          : "N/A",
        Creator: click.creator_username || "N/A",
        Submission: click.submission_number || "N/A",
        Country: click.country || "N/A",
        State: click.state || "N/A",
        City: click.city || "N/A",
        Device: click.device_type || "N/A",
        Browser: click.browser || "N/A",
        OS: click.os || "N/A",
        Referrer: click.referrer || "N/A",
        Traffic: click.traffic_type || "human",
      })),
    [data.filteredClicks]
  );

  const summarySections = useMemo(() => {
    const sortEntriesForSection = (
      sectionTitle: string,
      record: Record<string, number>
    ) => {
      const entries = Object.entries(record);

      // Keep ordering consistent with the on-screen StatsCard.
      if (sectionTitle === "Clicks by Submission") {
        return entries.sort((a, b) => {
          const aIsNumeric = !isNaN(Number(a[0]));
          const bIsNumeric = !isNaN(Number(b[0]));

          if (aIsNumeric && bIsNumeric) return Number(a[0]) - Number(b[0]);
          if (aIsNumeric) return -1;
          if (bIsNumeric) return 1;
          return a[0].localeCompare(b[0]);
        });
      }

      return entries.sort((a, b) => b[1] - a[1]);
    };

    return [
      {
        title: "Clicks by Link Title",
        entries: sortEntriesForSection("Clicks by Link Title", data.clicksByLinkTitle),
      },
      {
        title: "Clicks by Creator",
        entries: sortEntriesForSection("Clicks by Creator", data.clicksByCreator),
      },
      {
        title: "Clicks by Submission",
        entries: sortEntriesForSection("Clicks by Submission", data.clicksBySubmission),
      },
      {
        title: "Clicks by Country",
        entries: sortEntriesForSection("Clicks by Country", data.clicksByCountry),
      },
      {
        title: "Clicks by State",
        entries: sortEntriesForSection("Clicks by State", data.clicksByState),
      },
      {
        title: "Clicks by City",
        entries: sortEntriesForSection("Clicks by City", data.clicksByCity),
      },
      {
        title: "Clicks by Device",
        entries: sortEntriesForSection("Clicks by Device", data.clicksByDevice),
      },
      {
        title: "Clicks by Browser",
        entries: sortEntriesForSection("Clicks by Browser", data.clicksByBrowser),
      },
      {
        title: "Clicks by OS",
        entries: sortEntriesForSection("Clicks by OS", data.clicksByOs),
      },
      {
        title: "Clicks by Referrer",
        entries: sortEntriesForSection("Clicks by Referrer", data.clicksByReferrer),
      },
    ];
  }, [
    data.clicksByBrowser,
    data.clicksByOs,
    data.clicksByReferrer,
    data.clicksByCity,
    data.clicksByCountry,
    data.clicksByState,
    data.clicksByCreator,
    data.clicksByDevice,
    data.clicksByLinkTitle,
    data.clicksBySubmission,
  ]);

  const summaryRowsFlat = useMemo(() => {
    const rows: Array<{
      Section: string;
      Rank: number;
      Label: string;
      Clicks: number;
    }> = [];

    for (const section of summarySections) {
      section.entries.forEach(([label, count], idx) => {
        rows.push({
          Section: section.title,
          Rank: idx + 1,
          Label: label || "Unknown",
          Clicks: count,
        });
      });
    }

    return rows;
  }, [summarySections]);

  const weeklyRows = useMemo(
    () =>
      data.clicksByWeek.map((row, index) => {
        const date = parseDateKey(startDate);
        date.setDate(date.getDate() + index);
        return {
          Week: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        Clicks: row.clicks,
        };
      }),
    [data.clicksByWeek, startDate]
  );

  const canExport =
    exportRows.length > 0 ||
    summaryRowsFlat.length > 0 ||
    weeklyRows.length > 0;

  const getExportFilenamePrefix = () =>
    `${(link.link_title || "analytics-report")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}_analytics_${new Date()
      .toISOString()
      .slice(0, 10)}`;

  const handleExportExcel = () => {
    const canExport =
      exportRows.length > 0 ||
      summaryRowsFlat.length > 0 ||
      weeklyRows.length > 0;
    if (!canExport) return;
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    // Summary = the same "Clicks by ..." cards shown on the page
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRowsFlat);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

    const weeklyWorksheet = XLSX.utils.json_to_sheet(weeklyRows);
    XLSX.utils.book_append_sheet(
      workbook,
      weeklyWorksheet,
      "Weekly Analytics"
    );

    // Click detail = every filtered click row
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clicks Detail");
    XLSX.writeFile(workbook, `${getExportFilenamePrefix()}.xlsx`);
  };

  const handleExportPdf = () => {
    const canExport =
      exportRows.length > 0 ||
      summaryRowsFlat.length > 0 ||
      weeklyRows.length > 0;
    if (!canExport) return;

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${link.link_title} - Analytics Report`, 14, 14);
    doc.setFontSize(10);
    doc.text(`Platform: ${link.platform}`, 14, 20);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 26);
    doc.text(`Total Clicks: ${data.totalClicks}`, 14, 32);

    let currentY = 38;

    // Weekly analytics section (same as the weekly chart)
    doc.setFontSize(12);
    doc.text("Weekly Analytics", 14, currentY);
    currentY += 5;
    autoTable(doc, {
      startY: currentY,
      head: [["Week", "Clicks"]],
      body: weeklyRows.map((r) => [r.Week, r.Clicks]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14, right: 14 },
    });
    const lastFinalYWeekly = (
      doc as unknown as { lastAutoTable?: { finalY?: number } }
    ).lastAutoTable?.finalY;
    currentY = (lastFinalYWeekly ?? currentY) + 10;

    doc.setFontSize(12);
    doc.text("Summary (Clicks by Cards)", 14, currentY);
    currentY += 6;

    // Render one table per card (same order as the UI).
    for (const section of summarySections) {
      if (section.entries.length === 0) continue;

      doc.setFontSize(11);
      doc.text(section.title, 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [["#", "Label", "Clicks"]],
        body: section.entries.map(([label, count], idx) => [
          idx + 1,
          label || "Unknown",
          count,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });

      const lastFinalY = (
        doc as unknown as { lastAutoTable?: { finalY?: number } }
      ).lastAutoTable?.finalY;
      currentY = (lastFinalY ?? currentY) + 10;
    }

    // Also include the filtered click rows in the PDF.
    // (Capped to keep PDF size reasonable.)
    const PDF_MAX_ROWS = 300;
    const pdfRows =
      exportRows.length > PDF_MAX_ROWS
        ? exportRows.slice(0, PDF_MAX_ROWS)
        : exportRows;

    currentY += 2;
    doc.setFontSize(12);
    doc.text("Detailed Clicks", 14, currentY);
    currentY += 6;

    if (pdfRows.length === 0) {
      doc.setFontSize(10);
      doc.text("No click details for selected filters.", 14, currentY);
    } else {
      if (exportRows.length > PDF_MAX_ROWS) {
        doc.setFontSize(9);
        doc.text(
          `Showing first ${PDF_MAX_ROWS} of ${exportRows.length} rows (filtered)`,
          14,
          currentY
        );
        currentY += 5;
      }

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            "S.No",
            "Clicked At",
            "Creator",
            "Submission",
            "Country",
            "City",
            "Device",
            "Browser",
          ],
        ],
        body: pdfRows.map((row) => [
          row["S.No"],
          row["Clicked At"],
          row.Creator,
          row.Submission,
          row.Country,
          row.City,
          row.Device,
          row.Browser,
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`${getExportFilenamePrefix()}.pdf`);
  };

  const sortedCreatorRows = useMemo(
    () =>
      sortCreatorRows(
        buildCreatorRows(data.filteredClicks),
        creatorTableSort.column,
        creatorTableSort.direction
      ),
    [data.filteredClicks, creatorTableSort]
  );

  const handleCreatorTableSort = (column: CreatorTableSortColumn) => {
    setCreatorTableSort((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        column,
        direction: column === "creator" ? "asc" : "desc",
      };
    });
  };

  const updateClickFilter = (
    key: keyof ClickFilters,
    value: string
  ) => {
    setClickFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "country") {
        if (value !== FILTER_ALL && prev.state !== FILTER_ALL) {
          const stateStillValid = allClicks.some(
            (c) => c.country === value && c.state === prev.state
          );
          if (!stateStillValid) next.state = FILTER_ALL;
        }
        if (prev.city !== FILTER_ALL && value !== FILTER_ALL) {
          const cityStillValid = allClicks.some(
            (c) => c.country === value && c.city === prev.city
          );
          if (!cityStillValid) next.city = FILTER_ALL;
        }
      }
      if (key === "state" && prev.city !== FILTER_ALL && value !== FILTER_ALL) {
        const cityStillValid = allClicks.some(
          (c) =>
            (prev.country === FILTER_ALL || c.country === prev.country) &&
            c.state === value &&
            c.city === prev.city
        );
        if (!cityStillValid) next.city = FILTER_ALL;
      }
      return next;
    });
  };

  const clearClickFilters = () => setClickFilters(DEFAULT_CLICK_FILTERS);

  const creatorModalFilterOptions = useMemo(() => {
    if (!creatorAnalytics) {
      return {
        submissions: [],
        countries: [],
        states: [],
        cities: [],
        devices: [],
        browsers: [],
      };
    }
    return extractFilterOptions(
      creatorAnalytics.clicks,
      creatorModalFilters.country,
      creatorModalFilters.state
    );
  }, [creatorAnalytics, creatorModalFilters.country, creatorModalFilters.state]);

  const creatorModalFilteredClicks = useMemo(() => {
    if (!creatorAnalytics) return [];
    return creatorAnalytics.clicks.filter((click) =>
      matchesClickFilters(click, creatorModalFilters)
    );
  }, [creatorAnalytics, creatorModalFilters]);

  const updateCreatorModalFilter = (
    key: keyof ClickFilters,
    value: string
  ) => {
    setCreatorModalFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (
        key === "country" &&
        creatorAnalytics
      ) {
        if (value !== FILTER_ALL && prev.state !== FILTER_ALL) {
          const stateStillValid = creatorAnalytics.clicks.some(
            (c) => c.country === value && c.state === prev.state
          );
          if (!stateStillValid) next.state = FILTER_ALL;
        }
        if (prev.city !== FILTER_ALL && value !== FILTER_ALL) {
          const cityStillValid = creatorAnalytics.clicks.some(
            (c) => c.country === value && c.city === prev.city
          );
          if (!cityStillValid) next.city = FILTER_ALL;
        }
      }
      if (key === "state" && value !== FILTER_ALL && creatorAnalytics) {
        if (prev.city !== FILTER_ALL) {
          const cityStillValid = creatorAnalytics.clicks.some(
            (c) =>
              (prev.country === FILTER_ALL || c.country === prev.country) &&
              c.state === value &&
              c.city === prev.city
          );
          if (!cityStillValid) next.city = FILTER_ALL;
        }
      }
      return next;
    });
  };

  const loadCreatorAnalytics = async (creatorUsername: string) => {
    try {
      const clicks = await loadClicksForLink(clickSource, link.id, {
        creatorUsername,
      });
      setCreatorRawClicks(clicks);
      setSelectedCreator(creatorUsername);
      setCreatorModalFilters(DEFAULT_CLICK_FILTERS);
    } catch (error) {
      console.error("Error loading creator analytics:", error);
      toast.error(
        `Couldn't load creator clicks: ${describeError(error)}`,
        { id: "creator-load-error", duration: 8000 }
      );
    }
  };

  const includeSub = link.include_submission_in_url ?? false;
  const trackingUrlTemplate =
    typeof window !== "undefined"
      ? buildTrackingUrlTemplate({
          baseUrl: window.location.origin,
          brandSlug,
          projectSlug,
          shortCode: link.short_code,
          includeSubmissionInUrl: includeSub,
        })
      : "";
  const exampleUrl =
    typeof window !== "undefined"
      ? buildTrackingUrlExample({
          baseUrl: window.location.origin,
          brandSlug,
          projectSlug,
          shortCode: link.short_code,
          includeSubmissionInUrl: includeSub,
        })
      : "";

  const owner = clickSource.kind === "owner";
  const expired = link.expires_at ? new Date(link.expires_at) <= new Date() : false;
  const topOf = (record: Record<string, number>) =>
    Object.entries(record).sort((x, y) => y[1] - x[1])[0] ?? null;
  const topCreator = topOf(data.clicksByCreator);
  const topCity = topOf(data.clicksByCity);
  const humanInRange = trafficSummary.byType.human;

  const rangeState: DateRangeState = {
    preset: rangePreset,
    startDate,
    endDate,
    minDate: allTimeRange.startDate,
    maxDate: allTimeRange.endDate,
    label: dateRangeLabel,
    onPresetChange: applyPreset,
    onStartDateChange: handleStartDateChange,
    onEndDateChange: handleEndDateChange,
  };

  const header = owner ? (
    <AppHeader crumbs={crumbs} />
  ) : (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print-hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
          All links
        </Button>
        {projectName && (
          <span className="truncate text-sm font-medium text-slate-700">{projectName}</span>
        )}
      </div>
    </header>
  );

  const titleBlock = (
    <PageHeader
      title={link.link_title}
      meta={
        <>
          <Badge tone="primary">{link.platform}</Badge>
          {expired && <Badge tone="danger">Expired</Badge>}
          {link.utm_enabled && <Badge tone="info">UTM</Badge>}
        </>
      }
      description={
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          <a
            href={link.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.destination_url}
            className="truncate text-primary-700 hover:underline"
          >
            {link.destination_url}
          </a>
        </span>
      }
      actions={
        <>
          {trackingUrlTemplate && (
            <CopyButton text={trackingUrlTemplate} label="Copy tracking URL" size="md" />
          )}
          <DropdownMenu
            label="Export report"
            items={[
              {
                label: "Export PDF",
                description: "Summary, charts data and clicks",
                icon: FileText,
                onSelect: handleExportPdf,
                disabled: !canExport,
              },
              {
                label: "Export Excel",
                description: "Every click as a spreadsheet",
                icon: FileSpreadsheet,
                onSelect: handleExportExcel,
                disabled: !canExport,
              },
            ]}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                disabled={!canExport}
                className={buttonClasses({ variant: "secondary" })}
              >
                <Download className="h-[18px] w-[18px]" aria-hidden />
                <span>Export</span>
              </button>
            )}
          />
        </>
      }
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
          <LoadingBlock label="Loading analytics">
            <Skeleton className="mb-2 h-8 w-64 max-w-full" />
            <Skeleton className="mb-6 h-4 w-80 max-w-full" />
            <Skeleton className="mb-6 h-14" />
            <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 sm:h-24" />
              ))}
            </div>
            <Skeleton className="h-72" />
          </LoadingBlock>
        </main>
      </div>
    );
  }

  const setupPanel = (
    <LinkSetupPanel
      link={link}
      trackingUrlTemplate={trackingUrlTemplate}
      exampleUrl={exampleUrl}
      showQr={owner}
      qrProps={
        owner && typeof window !== "undefined"
          ? {
              baseUrl: window.location.origin,
              brandSlug,
              projectSlug,
              shortCode: link.short_code,
              includeSubmissionInUrl: includeSub,
              fileNamePrefix: getExportFilenamePrefix(),
            }
          : null
      }
    />
  );

  const tabs: TabItem<AnalyticsTab>[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "creators", label: "Creators", icon: Users, count: sortedCreatorRows.length },
    { id: "audience", label: "Audience", icon: Globe2 },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "setup", label: "Setup", icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {header}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
        {titleBlock}

        <AnalyticsToolbar
          range={rangeState}
          filters={clickFilters}
          filterOptions={filterOptions}
          onFilterChange={updateClickFilter}
          onClearFilters={clearClickFilters}
          hideBots={hideBots}
          onHideBotsChange={setHideBots}
          traffic={trafficSummary}
          idPrefix="link-analytics"
        />

        {loadError ? (
          <ErrorState
            title="Couldn't load click data"
            message={loadError}
            onRetry={loadAnalytics}
          />
        ) : allClicks.length === 0 ? (
          <div className="space-y-6">
            <EmptyState
              icon={MousePointerClick}
              title="No clicks yet"
              description="Share this link's tracking URL with creators. Clicks show up here within seconds."
              action={
                trackingUrlTemplate ? (
                  <CopyButton text={trackingUrlTemplate} label="Copy tracking URL" variant="primary" size="md" />
                ) : undefined
              }
            />
            {setupPanel}
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
              <StatCard
                label={hideBots ? "Genuine clicks" : "Total clicks"}
                value={data.totalClicks}
                icon={MousePointerClick}
                iconBg="bg-primary-50"
                iconColor="text-primary-600"
                sublabel={
                  hideBots
                    ? `of ${formatNumber(trafficSummary.total)} incl. bots`
                    : `${formatNumber(humanInRange)} genuine`
                }
              />
              <StatCard
                label="Unique visitors"
                value={data.uniqueVisitors}
                icon={UserCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                sublabel={
                  data.totalClicks
                    ? `${(data.totalClicks / Math.max(data.uniqueVisitors, 1)).toFixed(1)} clicks each`
                    : undefined
                }
              />
              <StatCard
                label="Top creator"
                value={topCreator ? topCreator[0] : "—"}
                icon={Users}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                sublabel={topCreator ? `${formatNumber(topCreator[1])} clicks` : undefined}
              />
              <StatCard
                label="Top city"
                value={topCity ? topCity[0] : "—"}
                icon={MapPin}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
                sublabel={topCity ? `${formatNumber(topCity[1])} clicks` : undefined}
              />
            </div>

            <Tabs
              tabs={tabs}
              value={activeTab}
              onChange={setActiveTab}
              idPrefix="link-analytics"
              label="Analytics sections"
              className="mb-5"
            />

            <TabPanel id="overview" active={activeTab} idPrefix="link-analytics" className="space-y-4">
              <ClicksAnalyticsChart
                weeklyData={data.clicksByWeek}
                startDate={startDate}
                endDate={endDate}
                totalClicksInRange={data.totalClicks}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <BreakdownCard
                  title="Top creators"
                  data={data.clicksByCreator}
                  icon={Users}
                  limit={5}
                  expandable={sortedCreatorRows.length <= 5}
                  footer={
                    sortedCreatorRows.length > 5 ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("creators")}
                        className="mt-3 self-start text-sm font-medium text-primary-700 hover:text-primary-800"
                      >
                        All {formatNumber(sortedCreatorRows.length)} creators →
                      </button>
                    ) : undefined
                  }
                />
                <BreakdownCard title="Top cities" data={data.clicksByCity} icon={MapPin} limit={5} />
                <TrafficQualityCard summary={trafficSummary} />
              </div>
            </TabPanel>

            <TabPanel id="creators" active={activeTab} idPrefix="link-analytics">
              <CreatorTable
                rows={sortedCreatorRows}
                sort={creatorTableSort}
                onSort={handleCreatorTableSort}
                onOpenCreator={loadCreatorAnalytics}
              />
            </TabPanel>

            <TabPanel
              id="audience"
              active={activeTab}
              idPrefix="link-analytics"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              <BreakdownCard title="Countries" data={data.clicksByCountry} icon={Globe2} />
              <BreakdownCard title="States" data={data.clicksByState} icon={MapPin} />
              <BreakdownCard title="Cities" data={data.clicksByCity} icon={Building2} />
              <BreakdownCard title="Devices" data={data.clicksByDevice} icon={Smartphone} />
              <BreakdownCard title="Operating systems" data={data.clicksByOs} icon={Monitor} />
              <BreakdownCard title="Browsers" data={data.clicksByBrowser} icon={AppWindow} />
              <BreakdownCard title="Referrers" data={data.clicksByReferrer} icon={Share2} />
              <BreakdownCard title="Submissions" data={data.clicksBySubmission} icon={Hash} order="natural" />
            </TabPanel>

            <TabPanel id="map" active={activeTab} idPrefix="link-analytics">
              <GeoInsightsPanelClient clicks={dateFilteredClicks} />
            </TabPanel>

            <TabPanel id="setup" active={activeTab} idPrefix="link-analytics">
              {setupPanel}
            </TabPanel>
          </>
        )}
      </main>

      <CreatorDetailDialog
        username={selectedCreator}
        clicks={creatorModalFilteredClicks}
        filters={creatorModalFilters}
        filterOptions={creatorModalFilterOptions}
        onFilterChange={updateCreatorModalFilter}
        onClearFilters={() => setCreatorModalFilters(DEFAULT_CLICK_FILTERS)}
        onClose={() => {
          setSelectedCreator(null);
          setCreatorRawClicks(null);
        }}
      />
    </div>
  );
}
