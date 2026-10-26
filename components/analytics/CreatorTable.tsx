"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, Input } from "@/components/ui";
import {
  sortedLocationValues,
  type CreatorTableRow,
  type CreatorTableSortColumn,
  type SortDirection,
} from "@/lib/click-filters";
import { formatNumber, formatRelative } from "@/lib/format";

const COLUMNS: { key: CreatorTableSortColumn; label: string; numeric?: boolean }[] = [
  { key: "creator", label: "Creator" },
  { key: "totalClicks", label: "Clicks", numeric: true },
  { key: "lastClick", label: "Last click" },
  { key: "city", label: "Cities" },
  { key: "country", label: "Countries" },
  { key: "totalSubmissions", label: "Submissions", numeric: true },
];

function places(values: Set<string>, max = 2): string {
  const list = sortedLocationValues(values);
  if (list.length === 0) return "—";
  return list.length > max ? `${list.slice(0, max).join(", ")} +${list.length - max}` : list.join(", ");
}

/**
 * Who drove the clicks. Sortable table from `sm` up, tappable list on phones;
 * both open the creator detail.
 */
export function CreatorTable({
  rows,
  sort,
  onSort,
  onOpenCreator,
}: {
  rows: CreatorTableRow[];
  sort: { column: CreatorTableSortColumn; direction: SortDirection };
  onSort: (column: CreatorTableSortColumn) => void;
  onOpenCreator: (username: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.username.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const maxClicks = rows.reduce((m, r) => Math.max(m, r.totalClicks), 0);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No creator clicks in this range"
        description="Try a wider date range, or clear filters."
      />
    );
  }

  return (
    <Card padded={false}>
      <div className="p-4 sm:p-5 pb-3 sm:pb-3">
        <CardHeader
          title="Creators"
          description={`${formatNumber(rows.length)} creators drove clicks in this range`}
          icon={Users}
          className="mb-3"
        />
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <label htmlFor="creator-search" className="sr-only">
            Search creators
          </label>
          <Input
            id="creator-search"
            type="search"
            placeholder="Search creators"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-slate-600">No creators match “{query}”.</p>
      ) : (
        <>
          {/* Phones: list */}
          <ul className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
            {filtered.map((row) => (
              <li key={row.username}>
                <button
                  type="button"
                  onClick={() => onOpenCreator(row.username)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{row.username}</p>
                    <p className="truncate text-xs text-slate-600">
                      {places(row.cities)} · {formatRelative(row.lastClick) ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatNumber(row.totalClicks)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          {/* Tablet/desktop: table */}
          <div className="hidden max-h-[560px] overflow-auto border-t border-slate-100 sm:block" tabIndex={0} role="region" aria-label="Clicks by creator table">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Clicks by creator</caption>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  {COLUMNS.map(({ key, label, numeric }) => {
                    const active = sort.column === key;
                    const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <th
                        key={key}
                        scope="col"
                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        className={`whitespace-nowrap px-4 py-2.5 font-semibold text-slate-700 ${numeric ? "text-right" : "text-left"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(key)}
                          className="inline-flex items-center gap-1 hover:text-primary-700"
                        >
                          {label}
                          <Icon className={`h-3.5 w-3.5 ${active ? "text-primary-600" : "text-slate-400"}`} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.username} className="hover:bg-slate-50">
                    <th scope="row" className="max-w-[16rem] truncate px-4 py-2.5 text-left font-medium text-slate-900">
                      {row.username}
                    </th>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-16 rounded-full bg-slate-100 lg:block" aria-hidden>
                          <div
                            className="h-1.5 rounded-full bg-primary-500"
                            style={{ width: `${maxClicks ? (row.totalClicks / maxClicks) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatNumber(row.totalClicks)}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700" title={row.lastClick ? new Date(row.lastClick).toLocaleString() : undefined}>
                      {formatRelative(row.lastClick) ?? "—"}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-700">{places(row.cities)}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-slate-700">{places(row.countries)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {row.submissions.size || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenCreator(row.username)}
                        className="whitespace-nowrap text-sm font-medium text-primary-700 hover:text-primary-800"
                        aria-label={`View details for ${row.username}`}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
