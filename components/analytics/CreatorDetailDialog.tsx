"use client";

import { useMemo, useState } from "react";
import { Filter, Globe2, MapPin, Monitor, Hash, Chrome } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import type { LinkClick } from "@/lib/supabase";
import { countClicksByDimension, countUniqueVisitors } from "@/lib/click-aggregation";
import type { ClickFilters } from "@/lib/click-filters";
import { formatNumber } from "@/lib/format";
import { BreakdownCard } from "./BreakdownCard";
import { ClickFilterFields, activeFilterEntries, type FilterOptions } from "./ClickFilterFields";

const PAGE = 100;

/** One creator's clicks: KPIs, filters, breakdowns and the raw click log. */
export function CreatorDetailDialog({
  username,
  clicks,
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  onClose,
}: {
  username: string | null;
  /** Creator clicks after bot + dimension filters. */
  clicks: LinkClick[];
  filters: ClickFilters;
  filterOptions: FilterOptions;
  onFilterChange: (key: keyof ClickFilters, value: string) => void;
  onClearFilters: () => void;
  onClose: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const counts = useMemo(() => countClicksByDimension(clicks), [clicks]);
  const sorted = useMemo(
    () => [...clicks].sort((a, b) => (b.clicked_at ?? "").localeCompare(a.clicked_at ?? "")),
    [clicks]
  );
  const activeCount = activeFilterEntries(filters).length;

  const kpis = [
    { label: "Clicks", value: clicks.length },
    { label: "Unique visitors", value: countUniqueVisitors(clicks) },
    { label: "Cities", value: Object.keys(counts.clicksByCity).length },
    { label: "Submissions", value: Object.keys(counts.clicksBySubmission).length },
  ];

  return (
    <Dialog
      open={username !== null}
      onClose={onClose}
      title={username ?? ""}
      description="Clicks from this creator's tracking link"
      size="lg"
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-slate-50 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-600">{kpi.label}</dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900">{formatNumber(kpi.value)}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeCount ? "subtle" : "secondary"}
              size="sm"
              icon={Filter}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              {activeCount ? `Filters (${activeCount})` : "Filter"}
            </Button>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-sm font-medium text-slate-700 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {showFilters && (
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <ClickFilterFields
                filters={filters}
                options={filterOptions}
                onChange={onFilterChange}
                idPrefix="creator-filter"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BreakdownCard title="Submissions" data={counts.clicksBySubmission} icon={Hash} order="natural" limit={6} />
          <BreakdownCard title="Cities" data={counts.clicksByCity} icon={MapPin} limit={6} />
          <BreakdownCard title="Countries" data={counts.clicksByCountry} icon={Globe2} limit={6} />
          <BreakdownCard title="Devices" data={counts.clicksByDevice} icon={Monitor} limit={6} />
          <BreakdownCard title="Browsers" data={counts.clicksByBrowser} icon={Chrome} limit={6} />
        </div>

        <section aria-labelledby="creator-clicks-heading">
          <h3 id="creator-clicks-heading" className="mb-2 text-sm font-semibold text-slate-900">
            Click log
          </h3>
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-600">No clicks match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200" tabIndex={0} role="region" aria-labelledby="creator-clicks-heading">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Time", "Submission", "City", "Country", "Device", "Browser"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.slice(0, visible).map((click) => (
                    <tr key={click.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {click.clicked_at
                          ? new Date(click.clicked_at).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{click.submission_number || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{click.city || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{click.country || "—"}</td>
                      <td className="px-3 py-2 capitalize text-slate-700">{click.device_type || "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{click.browser || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sorted.length > visible && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setVisible((v) => v + PAGE)}>
              Show {Math.min(PAGE, sorted.length - visible)} more
            </Button>
          )}
        </section>
      </div>
    </Dialog>
  );
}
