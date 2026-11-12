import { NextRequest, NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  ATTRIBUTION_WINDOW_DAYS,
  describeRecordStatus,
  parseEventPayload,
  type NormalizedEvent,
  type RecordStatus,
} from "@/lib/conversion-events";
import {
  findSiteByPublicKey,
  findSiteBySecretKey,
  type SiteAuth,
} from "@/lib/tracking-sites";

/**
 * POST /api/v1/events — records a visit, signup, purchase or custom event
 * and credits it to the creator behind the click. See docs/conversion-tracking.md.
 *
 * Two callers:
 * - Browser snippet (/t.js): `site` (public key) in the body. Sent as
 *   text/plain so it needs no CORS preflight.
 * - Server: `Authorization: Bearer lt_sec_…`. Trusted, and may identify the
 *   customer by `user_id` alone.
 */

const MAX_BODY_BYTES = 4096;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// A visit can reach us before the click row is written (the click is stored
// after the redirect response, once geolocation finishes), so an unknown
// click from the browser is retried briefly before giving up.
const PENDING_CLICK_RETRY_DELAYS_MS = [1000, 2500];

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function recordEvent(
  supabase: SupabaseClient,
  site: SiteAuth,
  event: NormalizedEvent,
  source: "browser" | "server"
): Promise<RecordStatus> {
  const { data, error } = await supabase.rpc("record_conversion_event", {
    p_site_id: site.id,
    p_owner_id: site.userId,
    p_click_id: event.clickId,
    p_external_user_id: event.userId,
    p_event_type: event.eventType,
    p_event_name: event.eventName,
    p_amount: event.amount,
    p_currency: event.currency,
    p_order_id: event.orderId,
    p_event_id: event.eventId,
    p_source: source,
    p_window_days: ATTRIBUTION_WINDOW_DAYS,
  });
  if (error) throw error;
  return data as RecordStatus;
}

const TEST_COLUMNS = {
  visit: "test_visit_at",
  signup: "test_signup_at",
  purchase: "test_purchase_at",
} as const;

/** Test clicks tick the setup checklist on the Integration page; nothing is stored. */
async function recordTestEvent(
  supabase: SupabaseClient,
  site: SiteAuth,
  event: NormalizedEvent
): Promise<void> {
  if (event.eventType === "custom") return;
  const { error } = await supabase
    .from("tracking_sites")
    .update({ [TEST_COLUMNS[event.eventType]]: new Date().toISOString() })
    .eq("id", site.id);
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error("[events] config error:", error instanceof Error ? error.message : error);
    return json(503, { ok: false, error: "Temporarily unavailable" });
  }

  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json(413, { ok: false, error: "Body too large" });
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json(400, { ok: false, error: "Body must be valid JSON" });
    }

    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const source: "browser" | "server" = bearer ? "server" : "browser";

    let site: SiteAuth | null;
    if (bearer) {
      site = await findSiteBySecretKey(supabase, bearer);
      if (!site) return json(401, { ok: false, error: "Invalid secret key" });
    } else {
      const publicKey = (body as { site?: unknown } | null)?.site;
      if (typeof publicKey !== "string" || !publicKey) {
        return json(401, {
          ok: false,
          error: "Missing key: send `site` in the body or an Authorization header",
        });
      }
      site = await findSiteByPublicKey(supabase, publicKey);
      if (!site) return json(401, { ok: false, error: "Unknown site key" });
    }

    const parsed = parseEventPayload(body, { defaultCurrency: site.defaultCurrency });
    if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
    const event = parsed.event;

    // Customers are only looked up by user ID for trusted (server) callers;
    // a browser could otherwise claim to be any customer.
    if (source === "browser" && !event.clickId) {
      return json(400, { ok: false, error: "click_id is required" });
    }

    if (event.test) {
      await recordTestEvent(supabase, site, event);
      return json(200, { ok: true, test: true, status: "test", event: event.eventType });
    }

    const status = await recordEvent(supabase, site, event, source);

    if (status === "unknown_click" && source === "browser" && event.eventType === "visit") {
      after(async () => {
        for (const delay of PENDING_CLICK_RETRY_DELAYS_MS) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          try {
            if ((await recordEvent(supabase, site, event, source)) !== "unknown_click") return;
          } catch (error) {
            console.error("[events] retry failed:", error);
            return;
          }
        }
      });
      return json(202, { ok: true, status: "pending" });
    }

    const { http, message } = describeRecordStatus(status);
    return json(http, { ok: http < 400, status, message });
  } catch (error) {
    console.error("[events] unexpected error:", error);
    return json(500, { ok: false, error: "Internal error" });
  }
}
