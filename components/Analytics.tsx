"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, LinkClick } from "@/lib/supabase";
import {
  ClickSource,
  OWNER_CLICK_SOURCE,
  loadClicksForLink,
} from "@/lib/click-source";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MousePointerClick,
  Monitor,
  Users,
  Eye,
  X,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  UserCheck,
} from "lucide-react";
import { ClicksAnalyticsChart } from "./ClicksAnalyticsChart";
import { GeoInsightsPanelClient } from "./GeoInsightsPanelLazy";
import { AnalyticsDateRangePicker } from "./AnalyticsDateRangePicker";
import {
  AggregatedClickAnalytics,
  aggregateClicks,
  filterBotClicks,
  filterClicksInDateRange,
  summarizeTraffic,
} from "@/lib/click-aggregation";
import { parseDateKey } from "@/lib/analytics-time";
import { useHideBotClicks } from "@/hooks/useHideBotClicks";
import { BotFilterBar } from "./BotFilterBar";
import { AnalyticsFiltersBar, AnalyticsViewMode } from "./AnalyticsFiltersBar";
import { AnalyticsStatsCard as StatsCard } from "./AnalyticsStatsCard";
import {
  ClickFilters,
  CreatorTableSortColumn,
  DEFAULT_CLICK_FILTERS,
  FILTER_ALL,
  SortDirection,
  buildCreatorRows,
  extractFilterOptions,
  hasActiveFilters,
  matchesClickFilters,
  sortCreatorRows,
  sortedLocationValues,
} from "@/lib/click-filters";
import { TrackingQrCode } from "./TrackingQrCode";
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

function renderCreatorLocationCell(values: Set<string>) {
  const list = sortedLocationValues(values);
  if (list.length === 0) {
    return <span className="text-slate-400">-</span>;
  }
  const label = list.join(", ");
  return (
    <span
      className="block max-w-[10rem] sm:max-w-[12rem] truncate text-slate-700"
      title={label}
    >
      {label}
    </span>
  );
}

interface AnalyticsProps {
  link: Link;
  onBack: () => void;
  projectSlug: string;
  brandSlug?: string | null;
  /** Defaults to the signed-in owner's Supabase session. */
  clickSource?: ClickSource;
}


export function Analytics({
  link,
  onBack,
  projectSlug,
  brandSlug = null,
  clickSource = OWNER_CLICK_SOURCE,
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
  }>({ column: "lastClick", direction: "desc" });
  const [analyticsViewMode, setAnalyticsViewMode] =
    useState<AnalyticsViewMode>("detailed");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const clicks = await loadClicksForLink(clickSource, link.id);
      setAllClicks(clicks);
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error(
        `Couldn't load click data: ${describeError(error)}`,
        { id: "analytics-load-error", duration: 8000 }
      );
    } finally {
      setLoading(false);
    }
  }, [clickSource, link.id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const filteredClicks = useMemo(
    () => visibleClicks.filter((click) => matchesClickFilters(click, clickFilters)),
    [visibleClicks, clickFilters]
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
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 animate-pulse shadow-lg">
            <MousePointerClick className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-700 font-semibold text-lg">
            Loading analytics...
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Please wait while we fetch your data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 top-0 z-40 shadow-sm">
        <div className="max-w-7xl flex flex-row gap-3 mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <button
            onClick={onBack}
            className="group flex items-center space-x-2 text-sm sm:text-base text-slate-600 hover:text-blue-600 mb-3 sm:mb-4 transition-all duration-200 hover:translate-x-[-4px]"
          >
            <div className="p-1 rounded-lg group-hover:bg-blue-50 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            {/* <span className="font-medium">Back to Links</span> */}
          </button>

          <div>
            <div className="flex flex-row gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                {link.link_title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border border-blue-300">
                  {link.platform}
                </span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <span className="text-slate-600 font-semibold">
                  Destination:
                </span>
                <a
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline break-all font-medium transition-colors"
                >
                  {link.destination_url}
                </a>
              </div>
            </div>
          </div>
          <div className="relative ml-auto self-start" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download Report
              <ChevronDown className="h-4 w-4" />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-4 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <FileText className="h-4 w-4 text-red-600" />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <BotFilterBar
          hideBots={hideBots}
          onChange={setHideBots}
          summary={trafficSummary}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-slate-200/60 p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1 font-medium">
                  Total Clicks
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">
                  {data.totalClicks}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-slate-200/60 p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs sm:text-sm text-slate-600 mb-1 font-medium"
                  title="Distinct visitors (same network + browser counted once)"
                >
                  Unique Visitors
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">
                  {data.uniqueVisitors}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-slate-200/60 p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1 font-medium">
                  Creators
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">
                  {Object.keys(data.clicksByCreator).length}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-slate-200/60 p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1 font-medium">
                  Devices
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900">
                  {Object.keys(data.clicksByDevice).length}
                </p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-cyan-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Monitor className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <MousePointerClick className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                Tracking URL Format
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Use this format to track different creators for this platform
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-600 mb-2 font-medium">Format:</p>
              <code className="block bg-white px-3 sm:px-4 py-3 rounded-xl font-mono text-xs sm:text-sm text-slate-800 overflow-x-auto shadow-sm border border-slate-200">
                {trackingUrlTemplate}
              </code>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-2 font-medium">
                Example:
              </p>
              <code className="block bg-gradient-to-r from-white to-blue-50 px-3 sm:px-4 py-3 rounded-xl font-mono text-xs sm:text-sm text-blue-600 overflow-x-auto shadow-sm border border-blue-200">
                {exampleUrl}
              </code>
            </div>
          </div>
        </div>

        {clickSource.kind === "owner" && typeof window !== "undefined" && (
          <TrackingQrCode
            baseUrl={window.location.origin}
            brandSlug={brandSlug}
            projectSlug={projectSlug}
            shortCode={link.short_code}
            includeSubmissionInUrl={includeSub}
            fileNamePrefix={getExportFilenamePrefix()}
          />
        )}

        <AnalyticsFiltersBar
          filters={clickFilters}
          options={filterOptions}
          onFilterChange={updateClickFilter}
          onClear={clearClickFilters}
          hasActive={hasActiveFilters(clickFilters)}
          totalUnfiltered={allClicks.length}
          totalFiltered={filteredClicks.length}
          viewMode={analyticsViewMode}
          onViewModeChange={setAnalyticsViewMode}
        />

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{dateRangeLabel}</span>
              {" · "}
              {data.totalClicks.toLocaleString()} clicks in range
            </p>
          </div>
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

        {analyticsViewMode === "map" ? (
          <GeoInsightsPanelClient clicks={dateFilteredClicks} />
        ) : (
          <>
            <ClicksAnalyticsChart
              weeklyData={data.clicksByWeek}
              startDate={startDate}
              endDate={endDate}
              totalClicksInRange={data.totalClicks}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <StatsCard
                title="Clicks by Link Title"
                data={data.clicksByLinkTitle}
                color="blue"
              />
              <StatsCard
                title="Clicks by Creator"
                data={data.clicksByCreator}
                color="emerald"
              />
              <StatsCard
                title="Clicks by Submission"
                data={data.clicksBySubmission}
                color="orange"
              />
              <StatsCard
                title="Clicks by Country"
                data={data.clicksByCountry}
                color="cyan"
              />
              <StatsCard
                title="Clicks by State"
                data={data.clicksByState}
                color="amber"
              />
              <StatsCard
                title="Clicks by City"
                data={data.clicksByCity}
                color="violet"
              />
              <StatsCard
                title="Clicks by Device"
                data={data.clicksByDevice}
                color="green"
              />
              <StatsCard
                title="Clicks by Browser"
                data={data.clicksByBrowser}
                color="slate"
              />
              <StatsCard
                title="Clicks by OS"
                data={data.clicksByOs}
                color="cyan"
              />
              <StatsCard
                title="Clicks by Referrer"
                data={data.clicksByReferrer}
                color="blue"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Recent Clicks by Creator
              </h3>
              <p className="text-xs text-slate-600">
                Overview of creator activity
              </p>
            </div>
          </div>
          {data.filteredClicks.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                <MousePointerClick className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                {allClicks.length === 0
                  ? "No clicks recorded yet"
                  : "No clicks match the current filters"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {allClicks.length === 0
                  ? "Start sharing your tracking links to see analytics"
                  : "Try adjusting or clearing your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-[500px] overflow-y-auto">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                      {(
                        [
                          {
                            key: "lastClick" as const,
                            label: "Last Click",
                          },
                          { key: "creator" as const, label: "Creator" },
                          { key: "country" as const, label: "Country" },
                          { key: "state" as const, label: "State" },
                          { key: "city" as const, label: "City" },
                          {
                            key: "totalClicks" as const,
                            label: "Total Clicks",
                          },
                          {
                            key: "totalSubmissions" as const,
                            label: "Total Submissions",
                          },
                        ] as const
                      ).map(({ key, label }) => {
                        const isActive = creatorTableSort.column === key;
                        const SortIcon = isActive
                          ? creatorTableSort.direction === "asc"
                            ? ArrowUp
                            : ArrowDown
                          : ArrowUpDown;
                        return (
                          <th
                            key={key}
                            aria-sort={
                              isActive
                                ? creatorTableSort.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                            className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap"
                          >
                            <button
                              type="button"
                              onClick={() => handleCreatorTableSort(key)}
                              className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors group/sort"
                            >
                              {label}
                              <SortIcon
                                className={`w-3.5 h-3.5 flex-shrink-0 ${
                                  isActive
                                    ? "text-blue-600"
                                    : "text-slate-400"
                                }`}
                              />
                            </button>
                          </th>
                        );
                      })}
                      <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCreatorRows.map((creator) => (
                        <tr
                          key={creator.username}
                          className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200 group"
                        >
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap font-medium">
                            {creator.lastClick ? (
                              new Date(creator.lastClick).toLocaleDateString(
                                "en-GB"
                              )
                            ) : (
                              <span className="text-red-500">No timestamp</span>
                            )}
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-semibold">
                            <div className="flex items-center gap-2">
                              {/* <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                {creator.username.charAt(0).toUpperCase()}
                              </div> */}
                              <span>{creator.username}</span>
                            </div>
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            {renderCreatorLocationCell(creator.countries)}
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            {renderCreatorLocationCell(creator.states)}
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            {renderCreatorLocationCell(creator.cities)}
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 rounded-full font-bold shadow-sm">
                              {creator.totalClicks}
                            </span>
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                            {creator.submissions.size > 0 ? (
                              <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-bold shadow-sm">
                                {creator.submissions.size}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-4 whitespace-nowrap">
                            <button
                              onClick={() =>
                                loadCreatorAnalytics(creator.username)
                              }
                              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg group-hover:scale-105"
                              title={`View detailed analytics for ${creator.username}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Creator Analytics Modal */}
      {selectedCreator && creatorAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="clickable-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSelectedCreator(null);
              setCreatorRawClicks(null);
            }}
          />
          <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="top-0 bg-gradient-to-r from-white to-blue-50/30 border-b border-slate-200 p-4 sm:p-6 z-10 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {selectedCreator.charAt(0).toUpperCase()}
                  </div> */}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                      Analytics for {selectedCreator}
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Detailed analytics for this creator&apos;s activity
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCreator(null);
                    setCreatorRawClicks(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all duration-200 hover:shadow-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <AnalyticsFiltersBar
                filters={creatorModalFilters}
                options={creatorModalFilterOptions}
                onFilterChange={updateCreatorModalFilter}
                onClear={() => setCreatorModalFilters(DEFAULT_CLICK_FILTERS)}
                hasActive={hasActiveFilters(creatorModalFilters)}
                totalUnfiltered={creatorAnalytics.clicks.length}
                totalFiltered={creatorModalFilteredClicks.length}
                compact
              />
            </div>

            <div className="p-4 sm:p-6">
              {(() => {
                const filteredClicks = creatorModalFilteredClicks;

                // Calculate filtered analytics
                const filteredAnalytics = {
                  totalClicks: filteredClicks.length,
                  clicksBySubmission: {} as Record<string, number>,
                  clicksByCountry: {} as Record<string, number>,
                  clicksByState: {} as Record<string, number>,
                  clicksByCity: {} as Record<string, number>,
                  clicksByDevice: {} as Record<string, number>,
                  clicksByBrowser: {} as Record<string, number>,
                };

                filteredClicks.forEach((click) => {
                  if (click.submission_number) {
                    filteredAnalytics.clicksBySubmission[
                      click.submission_number
                    ] =
                      (filteredAnalytics.clicksBySubmission[
                        click.submission_number
                      ] || 0) + 1;
                  }
                  if (click.country) {
                    filteredAnalytics.clicksByCountry[click.country] =
                      (filteredAnalytics.clicksByCountry[click.country] || 0) +
                      1;
                  }
                  if (click.state) {
                    filteredAnalytics.clicksByState[click.state] =
                      (filteredAnalytics.clicksByState[click.state] || 0) + 1;
                  }
                  if (click.city) {
                    filteredAnalytics.clicksByCity[click.city] =
                      (filteredAnalytics.clicksByCity[click.city] || 0) + 1;
                  }
                  if (click.device_type) {
                    filteredAnalytics.clicksByDevice[click.device_type] =
                      (filteredAnalytics.clicksByDevice[click.device_type] ||
                        0) + 1;
                  }
                  if (click.browser) {
                    filteredAnalytics.clicksByBrowser[click.browser] =
                      (filteredAnalytics.clicksByBrowser[click.browser] || 0) +
                      1;
                  }
                });

                return (
                  <>
                    {/* Summary Stats - Filtered based on selected submission */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-600 mb-1 font-medium">
                              Total Clicks
                            </p>
                            <p className="text-2xl font-bold text-slate-900">
                              {filteredAnalytics.totalClicks}
                            </p>
                          </div>
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <MousePointerClick className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-600 mb-1 font-medium">
                              Browsers
                            </p>
                            <p className="text-2xl font-bold text-slate-900">
                              {
                                Object.keys(filteredAnalytics.clicksByBrowser)
                                  .length
                              }
                            </p>
                          </div>
                          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                            <Monitor className="w-5 h-5 text-emerald-600" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-600 mb-1 font-medium">
                              Submissions
                            </p>
                            <p className="text-2xl font-bold text-slate-900">
                              {
                                Object.keys(
                                  filteredAnalytics.clicksBySubmission
                                ).length
                              }
                            </p>
                          </div>
                          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                            <Monitor className="w-5 h-5 text-orange-600" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-600 mb-1 font-medium">
                              Devices
                            </p>
                            <p className="text-2xl font-bold text-slate-900">
                              {
                                Object.keys(filteredAnalytics.clicksByDevice)
                                  .length
                              }
                            </p>
                          </div>
                          <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                            <Monitor className="w-5 h-5 text-cyan-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Stats - Filtered based on selected submission */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      <StatsCard
                        title="Clicks by Submission"
                        data={filteredAnalytics.clicksBySubmission}
                        color="orange"
                      />
                      <StatsCard
                        title="Clicks by Country"
                        data={filteredAnalytics.clicksByCountry}
                        color="cyan"
                      />
                      <StatsCard
                        title="Clicks by State"
                        data={filteredAnalytics.clicksByState}
                        color="amber"
                      />
                      <StatsCard
                        title="Clicks by City"
                        data={filteredAnalytics.clicksByCity}
                        color="violet"
                      />
                      <StatsCard
                        title="Clicks by Device"
                        data={filteredAnalytics.clicksByDevice}
                        color="green"
                      />
                      <StatsCard
                        title="Clicks by Browser"
                        data={filteredAnalytics.clicksByBrowser}
                        color="slate"
                      />
                    </div>
                  </>
                );
              })()}

              {/* Clicks Table */}
              {(() => {
                const filteredClicks = creatorModalFilteredClicks;

                return (
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4 sm:mb-5">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {hasActiveFilters(creatorModalFilters)
                            ? "Filtered Clicks"
                            : "All Clicks"}
                        </h3>
                        <p className="text-xs text-slate-600">
                          Detailed click information
                        </p>
                      </div>
                    </div>
                    {filteredClicks.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                          <MousePointerClick className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm sm:text-base text-slate-600 font-medium">
                          No clicks recorded for this filter
                        </p>
                      </div>
                    ) : creatorModalFilters.submission === FILTER_ALL ? (
                      // Single table when not filtering by a specific submission
                      <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl max-h-[500px] overflow-y-auto">
                        <div className="inline-block min-w-full align-middle">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                                <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                  Date
                                </th>
                                <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                  Submission
                                </th>
                                <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                  Country
                                </th>
                                <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                  Device
                                </th>
                                <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                  Browser
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredClicks
                                .sort((a, b) => {
                                  // Sort by time (most recent first)
                                  if (!a.clicked_at) return 1;
                                  if (!b.clicked_at) return -1;
                                  return (
                                    new Date(b.clicked_at).getTime() -
                                    new Date(a.clicked_at).getTime()
                                  );
                                })
                                .map((click) => (
                                  <tr
                                    key={click.id}
                                    className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent transition-all duration-200"
                                  >
                                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                                      {click.clicked_at ? (
                                        <div className="text-black">
                                          {new Date(
                                            click.clicked_at
                                          ).toLocaleDateString("en-GB")}
                                        </div>
                                      ) : (
                                        <span className="text-red-500 font-medium">
                                          No timestamp
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                                      <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 rounded-full text-xs font-bold shadow-sm">
                                        {click.submission_number || "-"}
                                      </span>
                                    </td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                      {click.country || (
                                        <span className="text-slate-400">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                      {click.device_type || (
                                        <span className="text-slate-400">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                      {click.browser || (
                                        <span className="text-slate-400">
                                          -
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {(() => {
                          // Group clicks by submission number
                          const submissionMap = new Map<string, LinkClick[]>();

                          filteredClicks.forEach((click) => {
                            const submission =
                              click.submission_number || "No Submission";
                            if (!submissionMap.has(submission)) {
                              submissionMap.set(submission, []);
                            }
                            submissionMap.get(submission)!.push(click);
                          });

                          // Sort submissions - numeric ones first in ascending order, then others
                          const sortedSubmissions = Array.from(
                            submissionMap.entries()
                          ).sort((a, b) => {
                            const aIsNumeric = !isNaN(Number(a[0]));
                            const bIsNumeric = !isNaN(Number(b[0]));

                            if (aIsNumeric && bIsNumeric) {
                              return Number(a[0]) - Number(b[0]);
                            }
                            if (aIsNumeric) return -1;
                            if (bIsNumeric) return 1;
                            return a[0].localeCompare(b[0]);
                          });

                          return sortedSubmissions.map(
                            ([submission, clicks]) => (
                              <div
                                key={submission}
                                className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
                              >
                                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 sm:px-5 py-3 sm:py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">
                                          {submission}
                                        </span>
                                      </div>
                                      <h4 className="text-base font-bold text-white">
                                        Submission: {submission}
                                      </h4>
                                    </div>
                                    <span className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-bold shadow-lg">
                                      {clicks.length}{" "}
                                      {clicks.length === 1 ? "click" : "clicks"}
                                    </span>
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="min-w-full bg-white">
                                    <thead>
                                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                                        <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                          Date
                                        </th>
                                        <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                          Country
                                        </th>
                                        <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                          Device
                                        </th>
                                        <th className="text-left py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                                          Browser
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {clicks
                                        .sort((a, b) => {
                                          // Sort clicks within submission by time (most recent first)
                                          if (!a.clicked_at) return 1;
                                          if (!b.clicked_at) return -1;
                                          return (
                                            new Date(b.clicked_at).getTime() -
                                            new Date(a.clicked_at).getTime()
                                          );
                                        })
                                        .map((click) => (
                                          <tr
                                            key={click.id}
                                            className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50/50 hover:to-transparent transition-all duration-200"
                                          >
                                            <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                              {click.clicked_at ? (
                                                <div className="text-slate-900">
                                                  {new Date(
                                                    click.clicked_at
                                                  ).toLocaleDateString("en-GB")}
                                                </div>
                                              ) : (
                                                <span className="text-red-500 font-medium">
                                                  No timestamp
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                              {click.country || (
                                                <span className="text-slate-400">
                                                  -
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                              {click.device_type || (
                                                <span className="text-slate-400">
                                                  -
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-3 sm:py-4 px-3 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap font-medium">
                                              {click.browser || (
                                                <span className="text-slate-400">
                                                  -
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
