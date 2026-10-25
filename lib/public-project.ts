// Server-only helpers shared by the /api/public/projects routes.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  checkProjectAccess,
  getAccessTokenFromRequest,
} from "@/lib/project-access";

export type PublicProject = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  brand_id: string | null;
};

/**
 * Loads a project by slug and enforces its password protection.
 * Returns either the project or a ready-to-send error response.
 */
export async function loadAuthorizedProject(
  request: Request,
  slug: string
): Promise<
  | { project: PublicProject; hasPasswords: boolean; response?: undefined }
  | { project?: undefined; response: NextResponse }
> {
  const admin = getSupabaseAdmin();
  const { data: project, error } = await admin
    .from("projects")
    .select("id, name, description, slug, brand_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!project) {
    return {
      response: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }

  const access = await checkProjectAccess(
    admin,
    project.id,
    getAccessTokenFromRequest(request)
  );

  if (!access.allowed) {
    return {
      response: NextResponse.json(
        {
          error: "Password required",
          requiresPassword: true,
          project: { name: project.name },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { project, hasPasswords: access.hasPasswords };
}
