"use client";

import { useState } from "react";
import { CalendarDays, Filter, X } from "lucide-react";
import { Button, Dialog, Input, Select, Switch } from "@/components/ui";
import {
  DATE_RANGE_PRESET_OPTIONS,
  type DateRangePreset,
} from "@/lib/analytics-date-range";
import { FILTER_ALL, type ClickFilters } from "@/lib/click-filters";
import { formatNumber } from "@/lib/format";
import type { TrafficSummary } from "@/lib/click-aggregation";
import {
  ClickFilterFields,
  activeFilterEntries,
  type FilterOptions,
} from "./ClickFilterFields";

export type DateRangeState = {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  minDate?: string;
  maxDate?: string;
  label: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
};

/**
 * Everything that changes the numbers, in one place: date range, dimension
 * filters (as removable chips), and the bot toggle. Sticky under the app
 * header from `sm` up.
 */
export function AnalyticsToolbar({
  range,
  filters,
  filterOptions,
  onFilterChange,
  onClearFilters,
  hideBots,
  onHideBotsChange,
  traffic,
  idPrefix = "analytics",
  showFilters = true,
}: {
  range: DateRangeState;
  filters?: ClickFilters;
  filterOptions?: FilterOptions;
  onFilterChange?: (key: keyof ClickFilters, value: string) => void;
  onClearFilters?: () => void;
  hideBots: boolean;
  onHideBotsChange: (value: boolean) => void;
  traffic: TrafficSummary;
  idPrefix?: string;
  showFilters?: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chips = filters ? activeFilterEntries(filters) : [];
  const hidden = traffic.total - traffic.byType.human;

  return (
    <div className="sm:sticky sm:top-14 z-30 -mx-4 mb-6 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border print-hidden">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays className="hidden h-4 w-4 shrink-0 text-slate-500 sm:block" aria-hidden />
          <label htmlFor={`${idPrefix}-range`} className="sr-only">
            Date range
          </label>
          <Select
            id={`${idPrefix}-range`}
            value={range.preset}
            onChange={(e) => range.onPresetChange(e.target.value as DateRangePreset)}
            className="h-9 w-auto min-w-[9.5rem]"
          >
            {DATE_RANGE_PRESET_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <span className="hidden text-sm text-slate-600 md:inline whitespace-nowrap">
            {range.label}
          </span>
        </div>

        {showFilters && filters && filterOptions && onFilterChange && (
          <Button
            variant={chips.length ? "subtle" : "secondary"}
            size="sm"
            icon={Filter}
            onClick={() => setFiltersOpen(true)}
            className="h-9"
          >
            Filters
            {chips.length > 0 && (
              <span className="rounded-full bg-primary-600 px-1.5 text-xs text-white tabular-nums">
                {chips.length}
              </span>
            )}
          </Button>
        )}

        <Switch
          className="ml-auto"
          checked={hideBots}
          onChange={onHideBotsChange}
          label="Hide bots"
          description={
            hidden > 0
              ? hideBots
                ? `${formatNumber(hidden)} hidden`
                : `${formatNumber(hidden)} look automated`
              : "None detected"
          }
        />
      </div>

      {range.preset === "custom" && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${idPrefix}-start`} className="mb-1 block text-xs font-medium text-slate-700">
              From
            </label>
            <Input
              id={`${idPrefix}-start`}
              type="date"
              value={range.startDate}
              min={range.minDate}
              max={range.endDate || range.maxDate}
              onChange={(e) => range.onStartDateChange(e.target.value)}
              className="h-9 w-auto"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-end`} className="mb-1 block text-xs font-medium text-slate-700">
              To
            </label>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={range.endDate}
              min={range.startDate || range.minDate}
              max={range.maxDate}
              onChange={(e) => range.onEndDateChange(e.target.value)}
              className="h-9 w-auto"
            />
          </div>
        </div>
      )}

      {chips.length > 0 && onFilterChange && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-xs font-medium text-primary-800 ring-1 ring-inset ring-primary-200"
            >
              <span className="truncate">
                {chip.label}: {chip.value}
              </span>
              <button
                type="button"
                onClick={() => onFilterChange(chip.key, FILTER_ALL)}
                aria-label={`Remove ${chip.label} filter`}
                className="rounded-full p-0.5 hover:bg-primary-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {filters && filterOptions && onFilterChange && (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filter clicks"
          description="Narrow every number on this page."
          footer={
            <>
              {onClearFilters && (
                <Button variant="secondary" onClick={onClearFilters} disabled={chips.length === 0}>
                  Clear all
                </Button>
              )}
              <Button onClick={() => setFiltersOpen(false)}>Done</Button>
            </>
          }
        >
          <ClickFilterFields
            filters={filters}
            options={filterOptions}
            onChange={onFilterChange}
            idPrefix={`${idPrefix}-filter`}
          />
        </Dialog>
      )}
    </div>
  );
}
