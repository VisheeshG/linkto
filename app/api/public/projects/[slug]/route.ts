import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadAuthorizedProject } from "@/lib/public-project";
import { PUBLIC_LINK_COLUMNS } from "@/lib/click-columns";
import { countClicksForLinkIds, fetchAllPages } from "@/lib/supabase-pagination";
import type { Link } from "@/lib/supabase";

// GET /api/public/projects/{slug}
// Shared project page data. Password-protected projects require
// `Authorization: Bearer <token>` from POST /api/verify-project-password.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = await loadAuthorizedProject(request, slug);
    if (result.response) return result.response;
    const { project, hasPasswords } = result;

    const admin = getSupabaseAdmin();

    const [brandRes, links] = await Promise.all([
      project.brand_id
        ? admin.from("brands").select("slug").eq("id", project.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
      fetchAllPages<Link>(async (from, to) =>
        admin
          .from("links")
          .select(PUBLIC_LINK_COLUMNS)
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
    ]);

    const linkIds = links.map((l) => l.id);
    const [totalClicks, humanClicks] = await Promise.all([
      countClicksForLinkIds(admin, linkIds),
      countClicksForLinkIds(admin, linkIds, { humanOnly: true }),
    ]);

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          slug: project.slug,
        },
        brandSlug: brandRes.data?.slug ?? null,
        hasPasswords,
        links,
        stats: { totalClicks, humanClicks },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error loading public project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
