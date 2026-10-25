"use client";

export type LinkExtras = {
  utm_enabled: boolean;
  /** ISO timestamp, or null for a link that never expires. */
  expires_at: string | null;
};

/** ISO timestamp -> value for <input type="datetime-local"> (viewer's local time). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO timestamp (or null when empty). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type LinkAdvancedOptionsProps = {
  idPrefix: string;
  utmEnabled: boolean;
  onUtmEnabledChange: (value: boolean) => void;
  /** datetime-local input value */
  expiresAt: string;
  onExpiresAtChange: (value: string) => void;
};

export function LinkAdvancedOptions({
  idPrefix,
  utmEnabled,
  onUtmEnabledChange,
  expiresAt,
  onExpiresAtChange,
}: LinkAdvancedOptionsProps) {
  return (
    <div className="rounded-xl border-2 border-slate-200 p-3 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={utmEnabled}
          onChange={(e) => onUtmEnabledChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="block text-sm font-bold text-slate-700">
            Add UTM tags to the destination
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Appends <span className="font-mono">utm_source=linkto</span>,{" "}
            <span className="font-mono">utm_medium</span> (platform),{" "}
            <span className="font-mono">utm_campaign</span> (project) and{" "}
            <span className="font-mono">utm_content</span> (creator) so the
            destination&apos;s own analytics can attribute visits. Existing UTM
            parameters on the URL are kept.
          </span>
        </span>
      </label>

      <div>
        <label
          htmlFor={`${idPrefix}-expires-at`}
          className="block text-sm font-bold text-slate-700 mb-1.5"
        >
          Expires at <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id={`${idPrefix}-expires-at`}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => onExpiresAtChange(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {expiresAt && (
            <button
              type="button"
              onClick={() => onExpiresAtChange("")}
              className="px-3 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          After this time the tracking link shows a &quot;Link expired&quot; page
          instead of redirecting.
        </p>
      </div>
    </div>
  );
}
