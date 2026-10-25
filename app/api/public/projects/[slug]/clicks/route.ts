import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadAuthorizedProject } from "@/lib/public-project";
import { fetchAllClicksForLinkId } from "@/lib/supabase-pagination";

// GET /api/public/projects/{slug}/clicks?link_id=...[&creator=...]
// Click data for one link of a shared project (no IPs / user agents).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const linkId = request.nextUrl.searchParams.get("link_id");
    const creator = request.nextUrl.searchParams.get("creator");

    if (!linkId) {
      return NextResponse.json({ error: "link_id is required" }, { status: 400 });
    }

    const result = await loadAuthorizedProject(request, slug);
    if (result.response) return result.response;

    const admin = getSupabaseAdmin();
    const { data: link } = await admin
      .from("links")
      .select("id")
      .eq("id", linkId)
      .eq("project_id", result.project.id)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const clicks = await fetchAllClicksForLinkId(admin, link.id, {
      creatorUsername: creator || undefined,
    });

    return NextResponse.json(
      { clicks },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error loading public clicks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
