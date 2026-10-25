"use client";

import { BarChart3, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";
import { useState, useEffect } from "react";

interface ClicksAnalyticsChartProps {
  weeklyData: { week: string; clicks: number }[];
  startDate: string;
  endDate: string;
  totalClicksInRange?: number;
}

// Format large numbers with Indian numbering system
function formatNumber(num: number): string {
  if (num >= 10000000) {
    // 1 crore and above
    return `${(num / 10000000).toFixed(2)}Cr`;
  } else if (num >= 100000) {
    // 1 lakh and above
    return `${(num / 100000).toFixed(2)}L`;
  } else if (num >= 1000) {
    // 1 thousand and above
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toString();
}

type ChartPoint = { label: string; tooltipLabel: string; clicks: number };

/**
 * Long ranges are grouped so bars stay readable: daily up to ~2 months,
 * weekly up to ~1 year, then 30-day buckets.
 */
function bucketDays(days: { week: string; clicks: number }[]): {
  points: ChartPoint[];
  unit: "day" | "week" | "month";
} {
  const size = days.length <= 62 ? 1 : days.length <= 400 ? 7 : 30;
  if (size === 1) {
    return {
      points: days.map((d) => ({ label: d.week, tooltipLabel: d.week, clicks: d.clicks })),
      unit: "day",
    };
  }
  const points: ChartPoint[] = [];
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size);
    const first = chunk[0].week;
    const last = chunk[chunk.length - 1].week;
    points.push({
      label: first,
      tooltipLabel: first === last ? first : `${first} – ${last}`,
      clicks: chunk.reduce((sum, d) => sum + d.clicks, 0),
    });
  }
  return { points, unit: size === 7 ? "week" : "month" };
}

// Format with commas for display
function formatNumberWithCommas(num: number): string {
  return num.toLocaleString("en-IN");
}

export function ClicksAnalyticsChart({
  weeklyData,
  startDate,
  endDate,
  totalClicksInRange,
}: ClicksAnalyticsChartProps) {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Always show the chart, even if there are no clicks
  if (weeklyData.length === 0) {
    return null;
  }

  const totalClicks =
    totalClicksInRange ??
    weeklyData.reduce((sum, day) => sum + day.clicks, 0);

  const isMobile = windowWidth < 640;
  const { points, unit } = bucketDays(weeklyData);
  // Bars size themselves to the card; only very dense charts on phones scroll
  // horizontally (keeping each bar slot at least ~7px wide).
  const minChartWidth = isMobile ? points.length * 7 : 0;
  const fontSize = isMobile ? "0.625rem" : "0.75rem";

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Clicks over time
            </h3>
            <p className="text-xs text-slate-600">
              {`${dayjs(startDate).format("MMM D, YYYY")} - ${dayjs(
                endDate
              ).format("MMM D, YYYY")}`}
              {unit !== "day" && ` · ${unit === "week" ? "weekly" : "monthly"} totals`}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
          {/* Statistics Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-md text-slate-600 font-medium whitespace-nowrap">
                  Total Clicks:
                </p>
                <p className="text-lg sm:text-xl font-bold text-slate-900">
                  {formatNumberWithCommas(totalClicks)}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="w-full h-56 sm:h-64 lg:h-72 overflow-x-auto overflow-y-hidden">
        <div style={{ minWidth: minChartWidth ? `${minChartWidth}px` : undefined, height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 8, right: isMobile ? 4 : 12, left: isMobile ? -16 : -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                style={{ fontSize }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={isMobile ? 16 : 24}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize }}
                allowDecimals={false}
                width={isMobile ? 36 : 48}
                tickLine={false}
                tickFormatter={formatNumber}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                }}
                labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                labelFormatter={(_label, payload) =>
                  (payload?.[0]?.payload as ChartPoint | undefined)?.tooltipLabel ?? _label
                }
                formatter={(value: number) => [
                  formatNumberWithCommas(value),
                  "Clicks",
                ]}
              />
              <Bar
                dataKey="clicks"
                fill="url(#colorClicks)"
                radius={[6, 6, 0, 0]}
                name="Clicks"
                maxBarSize={40}
              />
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
