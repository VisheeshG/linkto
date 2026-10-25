"use client";

import { Filter, X } from "lucide-react";
import {
  ClickFilters,
  FILTER_ALL,
  extractFilterOptions,
} from "@/lib/click-filters";

export type AnalyticsViewMode = "map" | "detailed";

export function AnalyticsFiltersBar({
  filters,
  options,
  onFilterChange,
  onClear,
  hasActive,
  totalUnfiltered,
  totalFiltered,
  compact = false,
  viewMode,
  onViewModeChange,
}: {
  filters: ClickFilters;
  options: ReturnType<typeof extractFilterOptions>;
  onFilterChange: (key: keyof ClickFilters, value: string) => void;
  onClear: () => void;
  hasActive: boolean;
  totalUnfiltered: number;
  totalFiltered: number;
  compact?: boolean;
  viewMode?: AnalyticsViewMode;
  onViewModeChange?: (mode: AnalyticsViewMode) => void;
}) {
  const selectClass =
    "w-full px-3 py-2 text-sm font-medium border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white hover:border-slate-400 transition-colors";

  const filterFields: {
    key: keyof ClickFilters;
    label: string;
    values: string[];
    disabled?: boolean;
  }[] = [
    { key: "submission", label: "Submission", values: options.submissions },
    { key: "country", label: "Country", values: options.countries },
    {
      key: "state",
      label: "State",
      values: options.states,
      disabled:
        filters.country !== FILTER_ALL && options.states.length === 0,
    },
    {
      key: "city",
      label: "City",
      values: options.cities,
      disabled:
        (filters.country !== FILTER_ALL || filters.state !== FILTER_ALL) &&
        options.cities.length === 0,
    },
    { key: "device", label: "Device", values: options.devices },
    { key: "browser", label: "Browser", values: options.browsers },
  ];

  if (
    totalUnfiltered === 0 &&
    !filterFields.some((f) => f.values.length > 0)
  ) {
    return null;
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border border-slate-200/60 mb-6 sm:mb-8 ${
        compact ? "p-3 sm:p-4" : "p-4 sm:p-6"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg">
            <Filter className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Filters
            </h3>
            <p className="text-xs text-slate-600">
              Showing {totalFiltered} of {totalUnfiltered} clicks
            </p>
          </div>
        </div>
        {viewMode && onViewModeChange && !compact ? (
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange("detailed")}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                viewMode === "detailed"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Detailed View
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("map")}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                viewMode === "map"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Map View
            </button>
          </div>
        ) : hasActive ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-semibold text-violet-600 hover:text-violet-800 px-4 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors border border-violet-200 self-start sm:self-auto shrink-0"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
        {filterFields.map(({ key, label, values, disabled }) => (
          <div key={key}>
            <label
              htmlFor={`filter-${compact ? "modal-" : ""}${key}`}
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              {label}
            </label>
            <select
              id={`filter-${compact ? "modal-" : ""}${key}`}
              value={filters[key]}
              disabled={disabled || values.length === 0}
              onChange={(e) => onFilterChange(key, e.target.value)}
              className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value={FILTER_ALL}>All</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {hasActive && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Active:
          </span>
          {filterFields.map(({ key, label }) => {
            const value = filters[key];
            if (value === FILTER_ALL) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 rounded-full text-xs font-semibold"
              >
                {label}: {value}
                <button
                  type="button"
                  onClick={() => onFilterChange(key, FILTER_ALL)}
                  className="hover:text-violet-950"
                  aria-label={`Clear ${label} filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-sm font-semibold text-violet-600 hover:text-violet-800 px-4 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors border border-violet-200"
          >
            Clear all filters
          </button>
        </div>
      )}

    </div>
  );
}
