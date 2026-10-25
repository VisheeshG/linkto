import type { LinkClick } from "@/lib/supabase";

// Pure helpers for the per-link analytics view: dimension filters and the
// creator activity table.

export const FILTER_ALL = "all";

export type ClickFilters = {
  submission: string;
  country: string;
  state: string;
  city: string;
  device: string;
  browser: string;
};

export const DEFAULT_CLICK_FILTERS: ClickFilters = {
  submission: FILTER_ALL,
  country: FILTER_ALL,
  state: FILTER_ALL,
  city: FILTER_ALL,
  device: FILTER_ALL,
  browser: FILTER_ALL,
};

export function sortSubmissionValues(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const aIsNumeric = !isNaN(Number(a));
    const bIsNumeric = !isNaN(Number(b));
    if (aIsNumeric && bIsNumeric) return Number(a) - Number(b);
    if (aIsNumeric) return -1;
    if (bIsNumeric) return 1;
    return a.localeCompare(b);
  });
}

export function matchesClickFilters(click: LinkClick, filters: ClickFilters): boolean {
  if (
    filters.submission !== FILTER_ALL &&
    (click.submission_number ?? "") !== filters.submission
  ) {
    return false;
  }
  if (filters.country !== FILTER_ALL && click.country !== filters.country) {
    return false;
  }
  if (filters.state !== FILTER_ALL && click.state !== filters.state) {
    return false;
  }
  if (filters.city !== FILTER_ALL && click.city !== filters.city) {
    return false;
  }
  if (
    filters.device !== FILTER_ALL &&
    click.device_type !== filters.device
  ) {
    return false;
  }
  if (filters.browser !== FILTER_ALL && click.browser !== filters.browser) {
    return false;
  }
  return true;
}

export function extractFilterOptions(
  clicks: LinkClick[],
  countryFilter: string,
  stateFilter: string
): {
  submissions: string[];
  countries: string[];
  states: string[];
  cities: string[];
  devices: string[];
  browsers: string[];
} {
  const submissions = new Set<string>();
  const countries = new Set<string>();
  const states = new Set<string>();
  const cities = new Set<string>();
  const devices = new Set<string>();
  const browsers = new Set<string>();

  clicks.forEach((click) => {
    if (click.submission_number) submissions.add(click.submission_number);
    if (click.country) countries.add(click.country);
    if (
      click.state &&
      (countryFilter === FILTER_ALL || click.country === countryFilter)
    ) {
      states.add(click.state);
    }
    if (
      click.city &&
      (countryFilter === FILTER_ALL || click.country === countryFilter) &&
      (stateFilter === FILTER_ALL || click.state === stateFilter)
    ) {
      cities.add(click.city);
    }
    if (click.device_type) devices.add(click.device_type);
    if (click.browser) browsers.add(click.browser);
  });

  return {
    submissions: sortSubmissionValues([...submissions]),
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    states: [...states].sort((a, b) => a.localeCompare(b)),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    devices: [...devices].sort((a, b) => a.localeCompare(b)),
    browsers: [...browsers].sort((a, b) => a.localeCompare(b)),
  };
}

export function hasActiveFilters(filters: ClickFilters): boolean {
  return Object.values(filters).some((v) => v !== FILTER_ALL);
}

export type CreatorTableSortColumn =
  | "lastClick"
  | "creator"
  | "country"
  | "state"
  | "city"
  | "totalClicks"
  | "totalSubmissions";
export type SortDirection = "asc" | "desc";

export type CreatorTableRow = {
  username: string;
  totalClicks: number;
  lastClick: string;
  submissions: Set<string>;
  countries: Set<string>;
  states: Set<string>;
  cities: Set<string>;
};

export function sortedLocationValues(values: Set<string>): string[] {
  return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function compareLocationSets(a: Set<string>, b: Set<string>): number {
  const aLabel = sortedLocationValues(a).join(", ");
  const bLabel = sortedLocationValues(b).join(", ");
  if (!aLabel && !bLabel) return 0;
  if (!aLabel) return 1;
  if (!bLabel) return -1;
  return aLabel.localeCompare(bLabel);
}

export function buildCreatorRows(clicks: LinkClick[]): CreatorTableRow[] {
  const creatorMap = new Map<string, CreatorTableRow>();

  clicks.forEach((click) => {
    if (!click.creator_username) return;

    const existing = creatorMap.get(click.creator_username);
    if (existing) {
      existing.totalClicks++;
      if (click.submission_number)
        existing.submissions.add(click.submission_number);
      if (click.country) existing.countries.add(click.country);
      if (click.state) existing.states.add(click.state);
      if (click.city) existing.cities.add(click.city);
      if (click.clicked_at && click.clicked_at > existing.lastClick) {
        existing.lastClick = click.clicked_at;
      }
    } else {
      creatorMap.set(click.creator_username, {
        username: click.creator_username,
        totalClicks: 1,
        lastClick: click.clicked_at || "",
        submissions: new Set(
          click.submission_number ? [click.submission_number] : []
        ),
        countries: new Set(click.country ? [click.country] : []),
        states: new Set(click.state ? [click.state] : []),
        cities: new Set(click.city ? [click.city] : []),
      });
    }
  });

  return Array.from(creatorMap.values());
}

export function sortCreatorRows(
  rows: CreatorTableRow[],
  column: CreatorTableSortColumn,
  direction: SortDirection
): CreatorTableRow[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "lastClick":
        cmp =
          new Date(a.lastClick || 0).getTime() -
          new Date(b.lastClick || 0).getTime();
        break;
      case "creator":
        cmp = a.username.localeCompare(b.username);
        break;
      case "country":
        cmp = compareLocationSets(a.countries, b.countries);
        break;
      case "state":
        cmp = compareLocationSets(a.states, b.states);
        break;
      case "city":
        cmp = compareLocationSets(a.cities, b.cities);
        break;
      case "totalClicks":
        cmp = a.totalClicks - b.totalClicks;
        break;
      case "totalSubmissions":
        cmp = a.submissions.size - b.submissions.size;
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}
