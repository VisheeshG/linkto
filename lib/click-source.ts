import { supabase, LinkClick } from "@/lib/supabase";
import { fetchAllClicksForLinkId } from "@/lib/supabase-pagination";

/**
 * Where analytics read clicks from:
 * - owner:  the signed-in owner's Supabase session (RLS-protected).
 * - public: a shared project page, through /api/public/projects (enforces the
 *           project password; never returns IPs or user agents).
 */
export type ClickSource =
  | { kind: "owner" }
  | { kind: "public"; projectSlug: string; accessToken: string | null };

export const OWNER_CLICK_SOURCE: ClickSource = { kind: "owner" };

export async function loadClicksForLink(
  source: ClickSource,
  linkId: string,
  options?: { creatorUsername?: string }
): Promise<LinkClick[]> {
  if (source.kind === "owner") {
    return fetchAllClicksForLinkId(supabase, linkId, options);
  }

  const params = new URLSearchParams({ link_id: linkId });
  if (options?.creatorUsername) params.set("creator", options.creatorUsername);

  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(source.projectSlug)}/clicks?${params}`,
    {
      headers: source.accessToken
        ? { Authorization: `Bearer ${source.accessToken}` }
        : undefined,
      cache: "no-store",
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to load clicks (${response.status})`);
  }
  const data = (await response.json()) as { clicks: LinkClick[] };
  return data.clicks;
}
