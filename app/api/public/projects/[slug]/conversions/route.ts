import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { loadAuthorizedProject } from "@/lib/public-project";
import { loadConversionData } from "@/lib/conversions";
import { fetchAllLinkIdsForProjectId } from "@/lib/supabase-pagination";

function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// GET /api/public/projects/{slug}/conversions[?link_id=…&from=…&to=…&human=1]
// Funnel data for a shared project: grouped counts only, never individual
// events, customers or order IDs. Without link_id it covers every link.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = await loadAuthorizedProject(request, slug);
    if (result.response) return result.response;

    const admin = getSupabaseAdmin();
    const projectLinkIds = await fetchAllLinkIdsForProjectId(admin, result.project.id);

    const query = request.nextUrl.searchParams;
    const requested = query.getAll("link_id");
    const allowed = new Set(projectLinkIds);
    if (requested.some((id) => !allowed.has(id))) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const data = await loadConversionData(
      admin,
      requested.length ? requested : projectLinkIds,
      {
        from: isoOrNull(query.get("from")),
        to: isoOrNull(query.get("to")),
        humanOnly: query.get("human") === "1",
      }
    );

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading public conversions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
