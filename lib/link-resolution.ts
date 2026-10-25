import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedLink = {
  id: string;
  destination_url: string;
  platform: string;
  submission_number: string | null;
  open_app_on_mobile?: boolean;
  include_submission_in_url?: boolean;
  utm_enabled?: boolean;
  expires_at?: string | null;
  project_slug: string;
};

/**
 * Outcome of resolving a tracking link. "error" means the database could not
 * answer (misconfigured key, missing table/column, network) and must NOT be
 * shown to visitors as "link not found".
 */
export type ResolveResult =
  | { status: "found"; link: ResolvedLink }
  | { status: "not_found" }
  | { status: "error"; error: string };

type DbError = { message?: string; code?: string; details?: string; hint?: string } | null;

function describeError(step: string, error: NonNullable<DbError>): string {
  const parts = [error.code, error.message, error.details, error.hint].filter(Boolean);
  return `${step}: ${parts.join(" | ") || "unknown database error"}`;
}

function fail(step: string, error: NonNullable<DbError>): ResolveResult {
  const message = describeError(step, error);
  console.error(`[redirect] ${message}`);
  return { status: "error", error: message };
}

type ProjectRow = { id: string; slug: string };

/**
 * Links are selected with `*` (not an explicit column list) so a production
 * schema that lacks one of the optional feature columns still redirects;
 * missing optional columns fall back to defaults here.
 */
function toResolvedLink(row: Record<string, unknown>, projectSlug: string): ResolvedLink {
  return {
    id: row.id as string,
    destination_url: row.destination_url as string,
    platform: (row.platform as string) ?? "",
    submission_number: (row.submission_number as string | null | undefined) ?? null,
    open_app_on_mobile: (row.open_app_on_mobile as boolean | undefined) ?? false,
    include_submission_in_url: (row.include_submission_in_url as boolean | undefined) ?? false,
    utm_enabled: (row.utm_enabled as boolean | undefined) ?? false,
    expires_at: (row.expires_at as string | null | undefined) ?? null,
    project_slug: projectSlug,
  };
}

async function findLinkInProjects(
  supabase: SupabaseClient,
  projects: ProjectRow[],
  shortCode: string
): Promise<ResolveResult> {
  if (projects.length === 0) return { status: "not_found" };

  const { data, error } = await supabase
    .from("links")
    .select("*")
    .in(
      "project_id",
      projects.map((p) => p.id)
    )
    .eq("short_code", shortCode)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) return fail("links lookup", error);

  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return { status: "not_found" };

  const project = projects.find((p) => p.id === row.project_id) ?? projects[0];
  return { status: "found", link: toResolvedLink(row, project.slug) };
}

/** Legacy URL: /{projectSlug}/{shortCode}/... (project slugs are globally unique). */
export async function resolveLinkByProjectSlugAndShortCode(
  supabase: SupabaseClient,
  projectSlug: string,
  shortCode: string
): Promise<ResolveResult> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .limit(1);

  if (error) return fail("project lookup (legacy)", error);
  return findLinkInProjects(supabase, (data as ProjectRow[] | null) ?? [], shortCode);
}

/**
 * Branded URL: /{brandSlug}/{projectSlug}/{shortCode}/...
 * Brand slugs are only unique per user, so several brands may share a slug;
 * the project slug (globally unique) disambiguates.
 */
export async function resolveLinkByBrandProjectAndShortCode(
  supabase: SupabaseClient,
  brandSlug: string,
  projectSlug: string,
  shortCode: string
): Promise<ResolveResult> {
  const { data: brands, error: brandError } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brandSlug);

  if (brandError) return fail("brand lookup", brandError);

  const brandIds = ((brands as { id: string }[] | null) ?? []).map((b) => b.id);
  if (brandIds.length === 0) return { status: "not_found" };

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .in("brand_id", brandIds);

  if (projectError) return fail("project lookup (branded)", projectError);
  return findLinkInProjects(supabase, (projects as ProjectRow[] | null) ?? [], shortCode);
}

/**
 * Full resolution for a catch-all path under the first segment.
 * Branded form is tried first when there are at least 3 path segments, then
 * the legacy form. An error only wins if no form found the link.
 */
export async function resolveTrackingPath(
  supabase: SupabaseClient,
  firstSegment: string,
  path: string[]
): Promise<{ result: ResolveResult; additionalParams: string[] }> {
  let firstError: ResolveResult | null = null;

  if (path.length >= 3) {
    const branded = await resolveLinkByBrandProjectAndShortCode(
      supabase,
      firstSegment,
      path[0],
      path[1]
    );
    if (branded.status === "found") {
      return { result: branded, additionalParams: path.slice(2) };
    }
    if (branded.status === "error") firstError = branded;
  }

  if (!path[0]) {
    return { result: firstError ?? { status: "not_found" }, additionalParams: [] };
  }

  const legacy = await resolveLinkByProjectSlugAndShortCode(supabase, firstSegment, path[0]);
  if (legacy.status === "found" || legacy.status === "error") {
    return { result: legacy, additionalParams: path.slice(1) };
  }

  return { result: firstError ?? legacy, additionalParams: path.slice(1) };
}
