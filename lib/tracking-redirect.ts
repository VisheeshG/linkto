import { NextRequest, NextResponse, after } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getClientIpFromRequest } from "@/lib/analytics";
import {
  buildMobileAppRedirectHtml,
  resolveMobileAppRedirect,
} from "@/lib/mobile-app-redirect";
import { isValidSubmissionSegment } from "@/lib/slug-utils";
import { parseUserAgent } from "@/lib/user-agent";
import {
  BURST_WINDOW_SECONDS,
  classifyClick,
} from "@/lib/bot-detection";
import { lookupGeo } from "@/lib/geo";
import { computeVisitorHash } from "@/lib/visitor";
import { applyUtmParameters } from "@/lib/utm";
import type { ResolvedLink } from "@/lib/link-resolution";

export type { ResolvedLink, ResolveResult } from "@/lib/link-resolution";
export {
  resolveLinkByBrandProjectAndShortCode,
  resolveLinkByProjectSlugAndShortCode,
  resolveTrackingPath,
} from "@/lib/link-resolution";

export function parseCreatorAndSubmission(
  additionalParams: string[],
  link: Pick<ResolvedLink, "submission_number">
): { creatorUsername: string | null; submissionNumber: string | null; valid: boolean } {
  const creatorUsername = additionalParams[0] || null;
  const second = additionalParams[1];

  if (second !== undefined && second !== "") {
    if (!isValidSubmissionSegment(second)) {
      return { creatorUsername, submissionNumber: null, valid: false };
    }
    return {
      creatorUsername,
      submissionNumber: second,
      valid: true,
    };
  }

  return {
    creatorUsername,
    submissionNumber: link.submission_number,
    valid: true,
  };
}

export function isLinkExpired(link: Pick<ResolvedLink, "expires_at">, now = new Date()): boolean {
  return !!link.expires_at && new Date(link.expires_at).getTime() <= now.getTime();
}

function messagePage(status: number, title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title} · Linkto</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    main { text-align: center; padding: 1.5rem; max-width: 28rem; }
    h1 { font-size: 1.5rem; color: #0f172a; margin: 0 0 .5rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="/">Go to Linkto</a></p>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function linkNotFoundResponse(): NextResponse {
  return messagePage(
    404,
    "Link not found",
    "This tracking link doesn&#39;t exist or has been removed."
  );
}

/**
 * Server misconfiguration or database failure. Deliberately distinct from
 * "not found" so a broken deploy is visible (503) instead of looking like
 * deleted links.
 */
export function serviceUnavailableResponse(): NextResponse {
  const res = messagePage(
    503,
    "Temporarily unavailable",
    "We couldn&#39;t open this link right now. Please try again in a few minutes."
  );
  res.headers.set("Retry-After", "60");
  return res;
}

function linkExpiredResponse(): NextResponse {
  return messagePage(
    410,
    "Link expired",
    "This tracking link is no longer active."
  );
}

type ClickContext = {
  link: ResolvedLink;
  creatorUsername: string | null;
  submissionNumber: string | null;
  userAgent: string;
  ip: string | null;
  method: string;
  acceptLanguage: string | null;
  referrer: string | null;
  headers: Headers;
};

/** Geo lookup + bot classification + insert. Runs after the response is sent. */
export async function recordClick(
  supabase: SupabaseClient,
  ctx: ClickContext
): Promise<void> {
  const { deviceType, browser, os } = parseUserAgent(ctx.userAgent);
  const visitorHash = computeVisitorHash(ctx.ip, ctx.userAgent);

  const [geo, recentClicks] = await Promise.all([
    lookupGeo(ctx.ip, ctx.headers),
    visitorHash
      ? supabase
          .from("link_clicks")
          .select("id", { count: "exact", head: true })
          .eq("link_id", ctx.link.id)
          .eq("visitor_hash", visitorHash)
          .gte(
            "clicked_at",
            new Date(Date.now() - BURST_WINDOW_SECONDS * 1000).toISOString()
          )
          .then(({ count }) => count ?? 0)
      : Promise.resolve(0),
  ]);

  const classification = classifyClick({
    userAgent: ctx.userAgent,
    method: ctx.method,
    acceptLanguage: ctx.acceptLanguage,
    network: geo.network,
    recentClicksFromVisitor: recentClicks,
  });

  const { error } = await supabase.from("link_clicks").insert({
    link_id: ctx.link.id,
    platform_name: ctx.link.platform,
    creator_username: ctx.creatorUsername,
    submission_number: ctx.submissionNumber,
    user_agent: ctx.userAgent,
    ip_address: ctx.ip,
    referrer: ctx.referrer,
    country: geo.country,
    state: geo.state,
    city: geo.city,
    device_type: deviceType,
    browser,
    os,
    asn: geo.network?.asn ?? null,
    isp: geo.network?.org || geo.network?.isp || null,
    is_hosting: geo.network?.isHosting ?? null,
    visitor_hash: visitorHash,
    traffic_type: classification.trafficType,
    bot_reason: classification.reason,
    clicked_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Tracking error:", error);
  }
}

export function handleTrackingRedirect(
  request: NextRequest,
  supabase: SupabaseClient,
  link: ResolvedLink,
  additionalParams: string[]
): NextResponse {
  const parsed = parseCreatorAndSubmission(additionalParams, link);
  if (!parsed.valid) {
    return linkNotFoundResponse();
  }

  if (isLinkExpired(link)) {
    return linkExpiredResponse();
  }

  const userAgent = request.headers.get("user-agent") || "";
  const { deviceType, os } = parseUserAgent(userAgent);

  // Record the click after the response is sent so the visitor never waits
  // on geolocation or the database.
  after(() =>
    recordClick(supabase, {
      link,
      creatorUsername: parsed.creatorUsername,
      submissionNumber: parsed.submissionNumber,
      userAgent,
      ip: getClientIpFromRequest(request),
      method: request.method,
      acceptLanguage: request.headers.get("accept-language"),
      referrer: request.headers.get("referer"),
      headers: request.headers,
    }).catch((error) => console.error("Tracking error:", error))
  );

  const destinationUrl = link.utm_enabled
    ? applyUtmParameters(link.destination_url, {
        platform: link.platform,
        projectSlug: link.project_slug,
        creatorUsername: parsed.creatorUsername,
        submissionNumber: parsed.submissionNumber,
      })
    : link.destination_url;

  const isMobileDevice = deviceType === "mobile" || deviceType === "tablet";

  if (link.open_app_on_mobile && isMobileDevice) {
    const appTargets = resolveMobileAppRedirect(destinationUrl, os);
    if (appTargets && (appTargets.appUrl || appTargets.androidIntent)) {
      return new NextResponse(buildMobileAppRedirectHtml(appTargets), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  return NextResponse.redirect(destinationUrl, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}
