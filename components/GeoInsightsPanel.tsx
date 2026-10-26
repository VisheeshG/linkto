"use client";

import { ComponentType, useEffect, useMemo, useState } from "react";
import { LinkClick } from "@/lib/supabase";
import { Globe, MapPin, Table2, X } from "lucide-react";
import { Dialog } from "@/components/ui";
import dynamic from "next/dynamic";

const LeafletMapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;
const LeafletTileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;
const LeafletMarker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  {
    ssr: false,
  },
) as unknown as ComponentType<Record<string, unknown>>;
const LeafletTooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;
const LeafletPopup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;
const LeafletGeoJSON = dynamic(
  () => import("react-leaflet").then((m) => m.GeoJSON),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;

type GeoTab = "pins" | "choropleth" | "demographic";
type GeoDataScope = "states" | "countries" | "cities";

const MAX_MAP_ROWS = 250;
const DEFAULT_CENTER: [number, number] = [22.9734, 78.6569];
const DEFAULT_ZOOM = 2;
const MAX_VISIBLE_SUBMISSIONS = 2;
const MAP_SHELL_CLASS =
  "relative w-full h-[min(560px,65vh)] min-h-[480px] rounded-xl border border-slate-200 overflow-hidden bg-slate-50 geo-map-shell";
const MAP_LAYER_CLASS = "absolute inset-0 z-0 h-full w-full";
const LEGEND_LABELS = [
  "0",
  "1-10",
  "10-30",
  "30-50",
  "50-100",
  "100-200",
  "200-300",
  "300-500",
  "500-1000",
  "1000+",
];
const LEGEND_COLORS = [
  "#e2e8f0",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#172554",
];

type ResolvedPin = {
  key: string;
  name: string;
  clicks: number;
  lat: number;
  lon: number;
  scope: GeoDataScope;
};

type SubmissionClickStat = {
  submission: string;
  clicks: number;
};

type CreatorDetailRow = {
  creator: string;
  totalClicks: number;
  submissions: SubmissionClickStat[];
};

type PinDetailsTarget = {
  locationName: string;
  scope: GeoDataScope;
};

type WorldGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, string | undefined>;
    geometry: unknown;
  }>;
};

function sortCounts(entries: [string, number][]) {
  return entries.sort((a, b) => b[1] - a[1]);
}

function normalizeCountryName(name: string): string {
  const normalized = name.trim().toLowerCase();
  const aliases: Record<string, string> = {
    usa: "united states of america",
    "united states": "united states of america",
    us: "united states of america",
    uk: "united kingdom",
    "russian federation": "russia",
  };
  return aliases[normalized] ?? normalized;
}

function sortSubmissionValues(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const aIsNumeric = !isNaN(Number(a));
    const bIsNumeric = !isNaN(Number(b));
    if (aIsNumeric && bIsNumeric) return Number(a) - Number(b);
    if (aIsNumeric) return -1;
    if (bIsNumeric) return 1;
    return a.localeCompare(b);
  });
}

function filterClicksForLocation(
  clicks: LinkClick[],
  scope: GeoDataScope,
  locationName: string,
): LinkClick[] {
  return clicks.filter((click) => {
    if (scope === "countries") return click.country === locationName;
    if (scope === "states") return click.state === locationName;
    if (scope === "cities") {
      const key = [click.city, click.state, click.country]
        .filter(Boolean)
        .join(", ");
      return key === locationName;
    }
    return false;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMapTooltipHtml(
  locationName: string,
  totalClicks: number,
): string {
  const safeName = escapeHtml(locationName);
  return `<div class="map-hover-tooltip-inner"><p class="map-hover-tooltip-title">${safeName}</p><p class="map-hover-tooltip-stats">Total Clicks: ${totalClicks}</p></div>`;
}

function formatSubmissionLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^sub\d+$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d+$/.test(trimmed)) return `sub${trimmed}`;
  return trimmed;
}

function buildCreatorDetailRows(clicks: LinkClick[]): CreatorDetailRow[] {
  const map = new Map<
    string,
    { totalClicks: number; submissions: Map<string, number> }
  >();

  clicks.forEach((click) => {
    const creator = click.creator_username?.trim() || "Unknown";
    const existing = map.get(creator);
    if (existing) {
      existing.totalClicks += 1;
      if (click.submission_number) {
        const key = click.submission_number.trim();
        existing.submissions.set(key, (existing.submissions.get(key) ?? 0) + 1);
      }
    } else {
      const submissions = new Map<string, number>();
      if (click.submission_number) {
        const key = click.submission_number.trim();
        submissions.set(key, 1);
      }
      map.set(creator, { totalClicks: 1, submissions });
    }
  });

  return Array.from(map.entries())
    .map(([creator, data]) => ({
      creator,
      totalClicks: data.totalClicks,
      submissions: sortSubmissionValues([...data.submissions.keys()]).map(
        (submission) => ({
          submission,
          clicks: data.submissions.get(submission) ?? 0,
        }),
      ),
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks);
}

function getRangeColor(value: number): string {
  if (value <= 0) return "#f1f5f9";
  if (value <= 10) return "#dbeafe";
  if (value <= 30) return "#bfdbfe";
  if (value <= 50) return "#93c5fd";
  if (value <= 100) return "#60a5fa";
  if (value <= 200) return "#3b82f6";
  if (value <= 300) return "#2563eb";
  if (value <= 500) return "#1d4ed8";
  if (value <= 1000) return "#1e40af";
  return "#172554";
}

export function GeoInsightsPanel({ clicks }: { clicks: LinkClick[] }) {
  const [activeTab, setActiveTab] = useState<GeoTab>("pins");
  const [dataScope, setDataScope] = useState<GeoDataScope>("countries");
  const [resolvedPins, setResolvedPins] = useState<ResolvedPin[]>([]);
  const [isResolvingPins, setIsResolvingPins] = useState(false);
  const [worldGeoJson, setWorldGeoJson] = useState<WorldGeoJson | null>(null);
  const [markerIcon, setMarkerIcon] = useState<unknown>(null);
  const [pinDetailsTarget, setPinDetailsTarget] =
    useState<PinDetailsTarget | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMarkerIcon() {
      try {
        const L = await import("leaflet");
        const icon = L.icon({
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          tooltipAnchor: [16, -28],
          shadowSize: [41, 41],
        });
        if (active) setMarkerIcon(icon);
      } catch {
        if (active) setMarkerIcon(null);
      }
    }
    loadMarkerIcon();
    return () => {
      active = false;
    };
  }, []);

  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach((click) => {
      if (!click.country) return;
      map.set(click.country, (map.get(click.country) ?? 0) + 1);
    });
    return sortCounts(Array.from(map.entries()));
  }, [clicks]);

  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach((click) => {
      if (!click.state) return;
      map.set(click.state, (map.get(click.state) ?? 0) + 1);
    });
    return sortCounts(Array.from(map.entries()));
  }, [clicks]);

  const demographicRows = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach((click) => {
      let key: string | null = null;
      if (dataScope === "states") {
        key = click.state ?? null;
      } else if (dataScope === "countries") {
        key = click.country ?? null;
      } else if (dataScope === "cities") {
        key = click.city
          ? [click.city, click.state, click.country].filter(Boolean).join(", ")
          : null;
      } else {
        key = click.state || click.country || click.city || null;
      }

      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return sortCounts(Array.from(map.entries())).map(([name, total]) => ({
      name,
      total,
    }));
  }, [clicks, dataScope]);

  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach((click) => {
      if (!click.city) return;
      const parts = [click.city, click.state, click.country].filter(Boolean);
      const key = parts.join(", ");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return sortCounts(Array.from(map.entries()));
  }, [clicks]);

  const scopeCounts = useMemo(() => {
    if (dataScope === "states") return stateCounts;
    if (dataScope === "countries") return countryCounts;
    return cityCounts;
  }, [dataScope, stateCounts, countryCounts, cityCounts]);

  const pinRows = useMemo(() => {
    const rows: Array<{ key: string; name: string; clicks: number }> = [];
    scopeCounts
      .slice(0, 180)
      .forEach(([name, count]) =>
        rows.push({ key: `${dataScope}:${name}`, name, clicks: count }),
      );
    return rows.slice(0, MAX_MAP_ROWS);
  }, [scopeCounts, dataScope]);

  useEffect(() => {
    let active = true;

    async function resolvePins() {
      if (activeTab !== "pins") return;
      if (pinRows.length === 0) {
        setResolvedPins([]);
        return;
      }

      setIsResolvingPins(true);
      const next: ResolvedPin[] = [];

      for (const row of pinRows.slice(0, 70)) {
        try {
          const query = encodeURIComponent(row.name);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
          );
          if (!response.ok) continue;
          const result = (await response.json()) as Array<{
            lat: string;
            lon: string;
          }>;
          if (!result?.[0]) continue;
          const lat = Number(result[0].lat);
          const lon = Number(result[0].lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          next.push({
            key: row.key,
            name: row.name,
            clicks: row.clicks,
            lat,
            lon,
            scope: dataScope,
          });
        } catch {
          // Continue resolving remaining pins even if one fails.
        }
      }

      if (active) {
        setResolvedPins(next);
        setIsResolvingPins(false);
      }
    }

    resolvePins();
    return () => {
      active = false;
    };
  }, [activeTab, pinRows, dataScope]);

  const choroplethChartData = useMemo(() => {
    const map = new Map<string, number>();
    clicks.forEach((click) => {
      if (!click.country) return;
      if (dataScope === "states" && !click.state) return;
      if (dataScope === "cities" && !click.city) return;
      map.set(click.country, (map.get(click.country) ?? 0) + 1);
    });
    Array.from(map.entries()).forEach(([country, count]) => {
      map.set(normalizeCountryName(country), count);
    });
    return map;
  }, [clicks, dataScope]);

  useEffect(() => {
    let active = true;
    async function loadGeoJson() {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
        );
        if (!response.ok) return;
        const data = (await response.json()) as WorldGeoJson;
        if (active) setWorldGeoJson(data);
      } catch {
        // Keep the tab usable even if geojson fails.
      }
    }
    if (activeTab === "choropleth" && !worldGeoJson) {
      loadGeoJson();
    }
    return () => {
      active = false;
    };
  }, [activeTab, worldGeoJson]);

  const pinDetailsRows = useMemo(() => {
    if (!pinDetailsTarget) return [];
    const locationClicks = filterClicksForLocation(
      clicks,
      pinDetailsTarget.scope,
      pinDetailsTarget.locationName,
    );
    return buildCreatorDetailRows(locationClicks);
  }, [clicks, pinDetailsTarget]);

  const validResolvedPins = useMemo(
    () =>
      resolvedPins.filter(
        (pin): pin is ResolvedPin =>
          !!pin &&
          Number.isFinite(pin.lat) &&
          Number.isFinite(pin.lon) &&
          typeof pin.name === "string",
      ),
    [resolvedPins],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Globe className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Where clicks came from
          </h3>
          <p className="text-sm text-slate-600">
            Countries, states and cities by clicks
          </p>
        </div>
      </div>

      <>
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-1 mb-3" role="group" aria-label="Location level">
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "countries", label: "Countries" },
              { id: "states", label: "States" },
              { id: "cities", label: "Cities" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDataScope(item.id as GeoDataScope)}
                aria-pressed={dataScope === item.id}
                className={`w-full px-2 py-1.5 text-sm font-medium rounded-md transition ${
                  dataScope === item.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 mb-4" role="group" aria-label="View">
          {[
            { id: "pins", label: "Pins", icon: MapPin },
            { id: "choropleth", label: "Heat map", icon: Globe },
            { id: "demographic", label: "Table", icon: Table2 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as GeoTab)}
              aria-pressed={activeTab === id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                activeTab === id
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "demographic" && (
          <div className="mb-4 space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-[360px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">
                        {dataScope === "countries"
                          ? "Country"
                          : dataScope === "cities"
                            ? "City"
                            : "State"}
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-700">
                        Total Clicks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {demographicRows.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-800">{row.name}</td>
                        <td className="px-3 py-2 text-right text-slate-900 font-medium">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                    {demographicRows.length === 0 && (
                      <tr>
                        <td
                          className="px-3 py-4 text-center text-slate-500"
                          colSpan={2}
                        >
                          No state-level data for current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab !== "demographic" && (
          <div className={MAP_SHELL_CLASS}>
            {activeTab === "pins" && validResolvedPins.length > 0 && (
              <div className={MAP_LAYER_CLASS}>
                <LeafletMapContainer
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <LeafletTileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {validResolvedPins.map((pin) => {
                    return (
                      <LeafletMarker
                        key={pin.key}
                        position={[pin.lat, pin.lon]}
                        icon={markerIcon ?? undefined}
                      >
                        <LeafletTooltip
                          direction="top"
                          offset={[0, -14]}
                          opacity={1}
                          sticky={false}
                          className="map-hover-tooltip"
                        >
                          <MapHoverTooltip
                            locationName={pin.name}
                            totalClicks={pin.clicks}
                          />
                        </LeafletTooltip>
                        <LeafletPopup>
                          <PinMapPopup
                            pin={pin}
                            onViewDetails={() =>
                              setPinDetailsTarget({
                                locationName: pin.name,
                                scope: pin.scope,
                              })
                            }
                          />
                        </LeafletPopup>
                      </LeafletMarker>
                    );
                  })}
                </LeafletMapContainer>
              </div>
            )}

            {activeTab === "pins" && isResolvingPins && (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                Resolving locations for map pins...
              </div>
            )}

            {activeTab === "choropleth" && countryCounts.length > 0 && (
              <div className={MAP_LAYER_CLASS}>
                <LeafletMapContainer
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <LeafletTileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {worldGeoJson && (
                    <LeafletGeoJSON
                      data={worldGeoJson}
                      style={(feature: unknown) => {
                        const typedFeature = feature as {
                          properties?: Record<string, string | undefined>;
                        };
                        const name =
                          typedFeature?.properties?.name ||
                          typedFeature?.properties?.ADMIN ||
                          typedFeature?.properties?.NAME ||
                          "";
                        const count = choroplethChartData.get(
                          normalizeCountryName(String(name)),
                        );
                        return {
                          color: "#94a3b8",
                          weight: 0.7,
                          fillColor: getRangeColor(count ?? 0),
                          fillOpacity: 0.9,
                        };
                      }}
                      onEachFeature={(feature: unknown, layer: unknown) => {
                        const typedFeature = feature as {
                          properties?: Record<string, string | undefined>;
                        };
                        const typedLayer = layer as {
                          bindTooltip: (
                            html: string,
                            options?: {
                              sticky?: boolean;
                              direction?: string;
                              className?: string;
                              opacity?: number;
                            },
                          ) => void;
                        };
                        const name =
                          typedFeature?.properties?.name ||
                          typedFeature?.properties?.ADMIN ||
                          typedFeature?.properties?.NAME ||
                          "Unknown";
                        const count = choroplethChartData.get(
                          normalizeCountryName(String(name)),
                        );
                        const displayName = String(name);
                        const totalClicks = count ?? 0;
                        typedLayer.bindTooltip(
                          buildMapTooltipHtml(displayName, totalClicks),
                          {
                            sticky: true,
                            direction: "top",
                            className: "map-hover-tooltip",
                            opacity: 1,
                          },
                        );
                      }}
                    />
                  )}
                </LeafletMapContainer>

                <div className="absolute left-3 bottom-3 z-[500] pointer-events-none">
                  <div className="pointer-events-auto bg-white/95 border border-slate-200 rounded-xl px-4 py-3 shadow-md w-[min(calc(100%-1.5rem),640px)]">
                    <p className="text-xl font-semibold text-slate-700 mb-2 leading-none">
                      Users
                    </p>
                    <div className="flex items-center gap-0.5 h-4">
                      {LEGEND_COLORS.map((color, idx) => (
                        <span
                          key={color}
                          className={`h-4 flex-1 ${
                            idx === 0 ? "rounded-l-md" : ""
                          } ${idx === LEGEND_COLORS.length - 1 ? "rounded-r-md" : ""}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between gap-1 text-[11px] text-slate-600">
                      {LEGEND_LABELS.map((label) => (
                        <span
                          key={label}
                          className="text-center whitespace-nowrap"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {((activeTab === "pins" &&
              !isResolvingPins &&
              validResolvedPins.length === 0) ||
              (activeTab === "choropleth" &&
                choroplethChartData.size === 0)) && (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                No location data for selected filters.
              </div>
            )}
            {activeTab === "choropleth" &&
              choroplethChartData.size > 0 &&
              !worldGeoJson && (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                  Loading choropleth map...
                </div>
              )}

            {pinDetailsTarget && activeTab === "pins" && (
              <PinLocationDetailsModal
                locationName={pinDetailsTarget.locationName}
                rows={pinDetailsRows}
                onClose={() => setPinDetailsTarget(null)}
              />
            )}
          </div>
        )}
      </>
    </div>
  );
}

function MapHoverTooltip({
  locationName,
  totalClicks,
}: {
  locationName: string;
  totalClicks: number;
}) {
  return (
    <div className="map-hover-tooltip-inner">
      <p className="map-hover-tooltip-title">{locationName}</p>
      <p className="map-hover-tooltip-stats">Total Clicks: {totalClicks}</p>
    </div>
  );
}

function PinMapPopup({
  pin,
  onViewDetails,
}: {
  pin: ResolvedPin;
  onViewDetails: () => void;
}) {
  return (
    <div className="text-sm min-w-[150px]">
      <p className="font-semibold text-slate-900">{pin.name}</p>
      <p className="text-slate-600 mt-0.5">Clicks: {pin.clicks}</p>
      <button
        type="button"
        onClick={onViewDetails}
        className="mt-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
      >
        View Users
      </button>
    </div>
  );
}

function SubmissionBadge({
  submission,
  clicks,
}: {
  submission: string;
  clicks: number;
}) {
  const label = formatSubmissionLabel(submission);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 pl-2.5 pr-1.5 py-1 text-xs font-medium text-orange-800"
      title={`${label}: ${clicks} click${clicks === 1 ? "" : "s"}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
        {clicks}
      </span>
    </span>
  );
}

function CreatorSubmissionsOverflowModal({
  creator,
  submissions,
  onClose,
}: {
  creator: string;
  submissions: SubmissionClickStat[];
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} title={creator} description="All submissions" size="sm">
      <div className="flex flex-wrap gap-2">
        {submissions.map(({ submission, clicks }) => (
          <SubmissionBadge key={submission} submission={submission} clicks={clicks} />
        ))}
      </div>
    </Dialog>
  );
}

function CreatorSubmissionsCell({
  creator,
  submissions,
}: {
  creator: string;
  submissions: SubmissionClickStat[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = submissions.slice(0, MAX_VISIBLE_SUBMISSIONS);
  const hiddenCount = submissions.length - visible.length;
  const hasOverflow = hiddenCount > 0;

  if (submissions.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 max-w-full">
        {visible.map(({ submission, clicks }) => (
          <SubmissionBadge
            key={submission}
            submission={submission}
            clicks={clicks}
          />
        ))}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 hover:border-primary-300 transition"
          >
            +{hiddenCount} more
          </button>
        )}
      </div>
      {showAll && (
        <CreatorSubmissionsOverflowModal
          creator={creator}
          submissions={submissions}
          onClose={() => setShowAll(false)}
        />
      )}
    </>
  );
}

function PinLocationDetailsModal({
  locationName,
  rows,
  onClose,
}: {
  locationName: string;
  rows: CreatorDetailRow[];
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[1000] flex flex-col">
      <div
        className="clickable-backdrop absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl isolate">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {locationName}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Creator click breakdown
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="overflow-auto min-h-0 flex-1 px-4 sm:px-6 pb-4">
          {rows.length === 0 ? (
            <p className="py-8 text-sm text-slate-500 text-center">
              No creator data for this location.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-[1]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Creator Name
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 w-28 sm:w-36">
                      Total Clicks
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 min-w-[12rem]">
                      Submissions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row, index) => (
                    <tr
                      key={row.creator}
                      className={
                        index % 2 === 1 ? "bg-slate-50/60" : "bg-white"
                      }
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900 align-top">
                        {row.creator}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        <span className="tabular-nums text-base font-bold text-slate-900">
                          {row.totalClicks}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top relative">
                        <CreatorSubmissionsCell
                          creator={row.creator}
                          submissions={row.submissions}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
