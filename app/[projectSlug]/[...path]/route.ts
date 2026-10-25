import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  handleTrackingRedirect,
  linkNotFoundResponse,
  resolveLinkByBrandProjectAndShortCode,
  resolveLinkByProjectSlugAndShortCode,
} from "@/lib/tracking-redirect";

/**
 * Tracking redirects (single dynamic tree to satisfy Next.js segment naming):
 * - Branded: /{brandSlug}/{projectSlug}/{shortCode}/{creator}[/sub1]
 * - Legacy:  /{projectSlug}/{shortCode}/{creator}[/sub1]
 *
 * HEAD requests are served by this GET handler too; they are recorded and
 * classified as bot traffic.
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
  try {
    const supabase = getSupabaseAdmin();
    const { projectSlug: firstSegment, path } = await params;

    if (path.length >= 3) {
      const brandedLink = await resolveLinkByBrandProjectAndShortCode(
        supabase,
        firstSegment,
        path[0],
        path[1]
      );

      if (brandedLink) {
        return handleTrackingRedirect(
          request,
          supabase,
          brandedLink,
          path.slice(2)
        );
      }
    }

    const linkData = await resolveLinkByProjectSlugAndShortCode(
      supabase,
      firstSegment,
      path[0]
    );

    if (!linkData) {
      return linkNotFoundResponse();
    }

    return handleTrackingRedirect(request, supabase, linkData, path.slice(1));
  } catch (error) {
    console.error("Redirect error:", error);
    return linkNotFoundResponse();
  }
}
