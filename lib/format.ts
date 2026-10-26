/** 12,34,567 (Indian digit grouping, used across the app). */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

/** Compact form for tight spaces: 950, 12.4K, 1.2L, 3.4Cr. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e7) return `${trim(value / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(value / 1e5)}L`;
  if (abs >= 1e3) return `${trim(value / 1e3)}K`;
  return String(value);
}

/** "2h ago", "3d ago", or a short date for older values. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: new Date(iso).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

/** Percentage with no decimals, safe for zero totals. */
export function formatPercent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
