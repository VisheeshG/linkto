// Server-side IP geolocation + network (ASN / hosting) lookup for click tracking.
//
// Provider order:
// 1. ip-api.com (Pro endpoint over HTTPS when IP_API_KEY is set; otherwise the
//    free endpoint, which is HTTP-only, limited to 45 req/min and
//    non-commercial — set IP_API_KEY in production).
// 2. ipapi.co as a fallback.
// 3. Vercel's request geo headers for location if both lookups fail.

import { normalizeAsn, type NetworkInfo } from "@/lib/bot-detection";
import { isLoopbackIp } from "@/lib/analytics";

export type GeoLookup = {
  country: string | null;
  state: string | null;
  city: string | null;
  network: NetworkInfo | null;
};

const EMPTY_LOOKUP: GeoLookup = {
  country: null,
  state: null,
  city: null,
  network: null,
};

const LOOKUP_TIMEOUT_MS = 2500;

const IP_API_FIELDS =
  "status,message,country,regionName,city,isp,org,as,hosting";

async function lookupIpApi(ip: string): Promise<GeoLookup | null> {
  const key = process.env.IP_API_KEY;
  const url = key
    ? `https://pro.ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}&key=${encodeURIComponent(key)}`
    : `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (data.status !== "success") return null;

  return {
    country: data.country || null,
    state: data.regionName || null,
    city: data.city || null,
    network: {
      asn: normalizeAsn(data.as),
      isp: data.isp || null,
      org: data.org || null,
      isHosting: typeof data.hosting === "boolean" ? data.hosting : null,
    },
  };
}

async function lookupIpapiCo(ip: string): Promise<GeoLookup | null> {
  const response = await fetch(
    `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
    { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) }
  );
  if (!response.ok) return null;
  const data = await response.json();
  if (data.error) return null;

  return {
    country: data.country_name || null,
    state: data.region || null,
    city: data.city || null,
    network: {
      asn: normalizeAsn(data.asn),
      isp: data.org || null,
      org: data.org || null,
      isHosting: null,
    },
  };
}

let regionNames: Intl.DisplayNames | null = null;

function countryNameFromCode(code: string): string | null {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Location from Vercel's edge geo headers (no network info available). */
export function geoFromPlatformHeaders(headers: Headers): GeoLookup {
  const countryCode = headers.get("x-vercel-ip-country");
  const city = headers.get("x-vercel-ip-city");
  return {
    country: countryCode ? countryNameFromCode(countryCode) : null,
    // Vercel only provides an ISO region code (e.g. "MH"), which does not
    // match the region names the dashboard groups by, so it is left empty.
    state: null,
    city: city ? safeDecode(city) : null,
    network: null,
  };
}

export async function lookupGeo(
  ip: string | null,
  headers: Headers
): Promise<GeoLookup> {
  if (ip && !isLoopbackIp(ip)) {
    for (const provider of [lookupIpApi, lookupIpapiCo]) {
      try {
        const result = await provider(ip);
        if (result) return result;
      } catch {
        // try the next provider
      }
    }
  }

  const fromHeaders = geoFromPlatformHeaders(headers);
  return fromHeaders.country || fromHeaders.city ? fromHeaders : EMPTY_LOOKUP;
}
