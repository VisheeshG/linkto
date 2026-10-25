import { NextRequest, NextResponse } from "next/server";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import {
  deleteAllArchivedClicksForLinkIds,
  fetchAllLinkIdsForProjectId,
} from "@/lib/supabase-pagination";

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    /schema cache|does not exist/i.test(error.message ?? "")
  );
}

// DELETE /api/projects/[projectId] - Delete a project and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // links, link_clicks and project_passwords are removed by ON DELETE
    // CASCADE. The optional archive table has no foreign key, so clean it up
    // explicitly first.
    let linkIds: string[] = [];
    try {
      linkIds = await fetchAllLinkIdsForProjectId(admin, projectId);
      await deleteAllArchivedClicksForLinkIds(admin, linkIds);
    } catch (archiveError) {
      if (!isMissingTableError(archiveError as PostgrestError)) {
        console.error("Error deleting link_clicks_archive:", archiveError);
        return NextResponse.json(
          {
            error:
              archiveError instanceof Error
                ? archiveError.message
                : "Error deleting archived clicks",
          },
          { status: 500 }
        );
      }
    }

    const { error: deleteProjectError, count } = await admin
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", projectId);

    if (deleteProjectError) {
      console.error("Error deleting project:", deleteProjectError);
      return NextResponse.json(
        { error: deleteProjectError.message },
        { status: 500 }
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: "Project could not be deleted" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
