import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  handleTrackingRedirect,
  linkNotFoundResponse,
  resolveTrackingPath,
  serviceUnavailableResponse,
} from "@/lib/tracking-redirect";

/**
 * Tracking redirects (single dynamic tree to satisfy Next.js segment naming):
 * - Branded: /{brandSlug}/{projectSlug}/{shortCode}/{creator}[/sub1]
 * - Legacy:  /{projectSlug}/{shortCode}/{creator}[/sub1]
 *
 * HEAD requests are served by this GET handler too; they are recorded and
 * classified as bot traffic.
 *
 * 404 only when the link genuinely does not exist. Misconfiguration or a
 * database error returns 503 and logs the cause with a "[redirect]" prefix.
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      projectSlug: string;
      path: string[];
    }>;
  }
) {
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error(
      "[redirect] config error:",
      error instanceof Error ? error.message : error
    );
    return serviceUnavailableResponse();
  }

  try {
    const { projectSlug: firstSegment, path } = await params;
    const { result, additionalParams } = await resolveTrackingPath(
      supabase,
      firstSegment,
      path
    );

    if (result.status === "error") {
      console.error(
        `[redirect] could not resolve /${[firstSegment, ...path].join("/")}: ${result.error}`
      );
      return serviceUnavailableResponse();
    }
    if (result.status === "not_found") {
      return linkNotFoundResponse();
    }

    return handleTrackingRedirect(
      request,
      supabase,
      result.link,
      additionalParams
    );
  } catch (error) {
    console.error("[redirect] unexpected error:", error);
    return serviceUnavailableResponse();
  }
}
