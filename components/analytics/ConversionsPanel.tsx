"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Eye,
  MousePointerClick,
  ShoppingBag,
  Target,
  UserPlus,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Skeleton,
  buttonClasses,
} from "@/components/ui";
import type { ClickSource } from "@/lib/click-source";
import { loadConversions } from "@/lib/conversion-source";
import {
  buildFunnel,
  dateKeysToRange,
  formatRate,
  formatRevenue,
  type ConversionData,
  type Funnel,
} from "@/lib/conversions";
import { describeError } from "@/lib/describe-error";
import { formatNumber } from "@/lib/format";

type Props = {
  source: ClickSource;
  /** Links to report on. `null` on a shared report means the whole project. */
  linkIds: string[] | null;
  /** "YYYY-MM-DD" bounds; omit both for all time. */
  startDate?: string | null;
  endDate?: string | null;
  hideBots: boolean;
  /** Shown when location / device filters are active (they don't apply here). */
  filtersActive?: boolean;
  /** Section heading, for pages where the panel is not inside a tab. */
  title?: string;
  /** Render nothing until there is at least one event (shared reports). */
  hideWhenEmpty?: boolean;
};

const STEPS = [
  { key: "clicks", label: "Clicks", icon: MousePointerClick, hint: "People who clicked a creator's link" },
  { key: "visits", label: "Visits", icon: Eye, hint: "Landed on the site with tracking installed" },
  { key: "signups", label: "Signups", icon: UserPlus, hint: "Created an account" },
  { key: "purchases", label: "Purchases", icon: ShoppingBag, hint: "Paid for something" },
] as const;

const count = (n: number, noun: string) => `${formatNumber(n)} ${noun}${n === 1 ? "" : "s"}`;

/**
 * Clicks → visits → signups → purchases for a set of links, with a
 * per-creator breakdown. Counts come pre-grouped from the database.
 */
export function ConversionsPanel({
  source,
  linkIds,
  startDate,
  endDate,
  hideBots,
  filtersActive = false,
  title,
  hideWhenEmpty = false,
}: Props) {
  const [data, setData] = useState<ConversionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkKey = linkIds ? linkIds.join(",") : null;
  const owner = source.kind === "owner";

  const load = useCallback(async () => {
    setError(null);
    try {
      const { from, to } = dateKeysToRange(startDate, endDate);
      const ids = linkKey === null ? null : linkKey ? linkKey.split(",") : [];
      setData(await loadConversions(source, ids, { from, to, humanOnly: hideBots }));
    } catch (err) {
      console.error("Error loading conversions:", err);
      setError(describeError(err));
    }
  }, [source, linkKey, startDate, endDate, hideBots]);

  useEffect(() => {
    load();
  }, [load]);

  const funnel: Funnel | null = useMemo(() => (data ? buildFunnel(data) : null), [data]);

  const heading = title ? (
    <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
  ) : null;

  if (hideWhenEmpty && !funnel?.hasEvents) return null;

  if (error) {
    return (
      <section>
        {heading}
        <ErrorState title="Couldn't load conversions" message={error} onRetry={load} />
      </section>
    );
  }

  if (!funnel) {
    return (
      <section>
        {heading}
        <LoadingBlock label="Loading conversions">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 sm:h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </LoadingBlock>
      </section>
    );
  }

  if (!funnel.hasEvents) {
    return (
      <section>
        {heading}
        <EmptyState
          icon={Target}
          title="No visits, signups or purchases yet"
          description={
            owner
              ? "Clicks are tracked already. To see what people do after the click, add the Linkto snippet to the brand's website. It takes about 10 minutes and is copy-paste."
              : "Clicks are tracked already. Signups and purchases appear here once conversion tracking is installed on the website."
          }
          action={
            owner ? (
              <>
                <Link href="/dashboard/integration" className={buttonClasses({ variant: "primary" })}>
                  Set up conversion tracking
                </Link>
                <Link href="/guide" target="_blank" className={buttonClasses({ variant: "secondary" })}>
                  Read the guide
                </Link>
              </>
            ) : undefined
          }
        />
      </section>
    );
  }

  const { totals } = funnel;
  const max = Math.max(totals.clicks, totals.visits, totals.signups, totals.purchases, 1);
  const creatorsWithActivity = funnel.creators.filter(
    (c) => c.visits || c.signups || c.purchases || c.clicks
  );

  return (
    <section className="space-y-4">
      {heading}
      {filtersActive && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Location and device filters apply to clicks only. Conversions below cover the whole date range.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Visits"
          value={totals.visits}
          icon={Eye}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          sublabel={`${formatRate(totals.visits, totals.clicks)} of clicks`}
        />
        <StatCard
          label="Signups"
          value={totals.signups}
          icon={UserPlus}
          iconBg="bg-primary-50"
          iconColor="text-primary-600"
          sublabel={`${formatRate(totals.signups, totals.clicks)} of clicks`}
        />
        <StatCard
          label="Purchases"
          value={totals.purchases}
          icon={ShoppingBag}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sublabel={`${formatRate(totals.purchases, totals.clicks)} of clicks`}
        />
        <StatCard
          label="Revenue"
          value={formatRevenue(totals.revenue)}
          icon={Banknote}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sublabel={
            totals.purchases
              ? `${formatNumber(totals.purchases)} ${totals.purchases === 1 ? "order" : "orders"}`
              : undefined
          }
          title={formatRevenue(totals.revenue)}
        />
      </div>

      <Card className="print-avoid-break">
        <CardHeader
          title="Funnel"
          description={`${hideBots ? "Genuine clicks" : "All clicks"} and what happened after them`}
          icon={Target}
        />
        <ol className="space-y-3">
          {STEPS.map((step) => {
            const value = totals[step.key];
            return (
              <li key={step.key} title={step.hint}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <step.icon className="h-4 w-4 text-slate-500" aria-hidden />
                    {step.label}
                  </span>
                  <span className="tabular-nums text-slate-900">
                    <span className="font-semibold">{formatNumber(value)}</span>
                    {step.key !== "clicks" && (
                      <span className="ml-2 text-slate-600">
                        {formatRate(value, totals.clicks)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${value ? Math.max((value / max) * 100, 1) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        {funnel.customEvents.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Other events</h3>
            <ul className="flex flex-wrap gap-2">
              {funnel.customEvents.map((event) => (
                <li
                  key={event.name}
                  className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  <span className="font-mono text-xs">{event.name}</span>
                  <span className="ml-2 font-semibold tabular-nums text-slate-900">
                    {formatNumber(event.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card padded={false} className="print-avoid-break">
        <div className="p-4 pb-3 sm:p-5 sm:pb-3">
          <CardHeader
            title="Results by creator"
            description="Who drove visits, signups and sales"
            icon={UserPlus}
            className="mb-0"
          />
        </div>

        {/* Phones: list */}
        <ul className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
          {creatorsWithActivity.map((row) => (
            <li key={row.creator} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium text-slate-900">{row.creator}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatRevenue(row.revenue)}
                </p>
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                {count(row.clicks, "click")} · {count(row.visits, "visit")} ·{" "}
                {count(row.signups, "signup")} · {count(row.purchases, "purchase")}
              </p>
            </li>
          ))}
        </ul>

        {/* Tablet/desktop: table */}
        <div
          className="hidden max-h-[560px] overflow-auto border-t border-slate-100 sm:block"
          tabIndex={0}
          role="region"
          aria-label="Conversions by creator table"
        >
          <table className="min-w-full text-sm">
            <caption className="sr-only">Conversions by creator</caption>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                {["Creator", "Clicks", "Visits", "Signups", "Purchases", "Revenue", "Click → purchase"].map(
                  (label, i) => (
                    <th
                      key={label}
                      scope="col"
                      className={`whitespace-nowrap px-4 py-2.5 font-semibold text-slate-700 ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creatorsWithActivity.map((row) => (
                <tr key={row.creator} className="hover:bg-slate-50">
                  <th scope="row" className="max-w-[16rem] truncate px-4 py-2.5 text-left font-medium text-slate-900">
                    {row.creator}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.clicks)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.visits)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.signups)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.purchases)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {formatRevenue(row.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {formatRate(row.purchases, row.clicks)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
