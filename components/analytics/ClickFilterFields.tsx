"use client";

import { Field, Select } from "@/components/ui";
import {
  FILTER_ALL,
  type ClickFilters,
  type extractFilterOptions,
} from "@/lib/click-filters";

export type FilterOptions = ReturnType<typeof extractFilterOptions>;

export const FILTER_LABELS: Record<keyof ClickFilters, string> = {
  submission: "Submission",
  country: "Country",
  state: "State",
  city: "City",
  device: "Device",
  browser: "Browser",
};

/** The six dimension filters as labelled selects (2 per row on phones). */
export function ClickFilterFields({
  filters,
  options,
  onChange,
  idPrefix,
}: {
  filters: ClickFilters;
  options: FilterOptions;
  onChange: (key: keyof ClickFilters, value: string) => void;
  idPrefix: string;
}) {
  const fields: { key: keyof ClickFilters; values: string[] }[] = [
    { key: "country", values: options.countries },
    { key: "state", values: options.states },
    { key: "city", values: options.cities },
    { key: "device", values: options.devices },
    { key: "browser", values: options.browsers },
    { key: "submission", values: options.submissions },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {fields.map(({ key, values }) => (
        <Field key={key} label={FILTER_LABELS[key]}>
          <Select
            id={`${idPrefix}-${key}`}
            value={filters[key]}
            disabled={values.length === 0 && filters[key] === FILTER_ALL}
            onChange={(e) => onChange(key, e.target.value)}
          >
            <option value={FILTER_ALL}>All</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      ))}
    </div>
  );
}

export function activeFilterEntries(filters: ClickFilters) {
  return (Object.keys(filters) as (keyof ClickFilters)[])
    .filter((key) => filters[key] !== FILTER_ALL)
    .map((key) => ({ key, label: FILTER_LABELS[key], value: filters[key] }));
}
