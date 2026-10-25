import { SupabaseClient } from "@supabase/supabase-js";
import { Link, LinkClick } from "@/lib/supabase";
import { CLICK_ANALYTICS_COLUMNS } from "@/lib/click-columns";

/** PostgREST default max rows per request */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type PageQuery<T> = (from: number, to: number) => Promise<PageResult<T>>;

export async function fetchAllPages<T>(queryPage: PageQuery<T>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryPage(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;

    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    offset += SUPABASE_PAGE_SIZE;
  }

  return all;
}

const LINK_ID_IN_CHUNK = 80;

type CountOptions = {
  /** Only count clicks classified as human (excludes bots / datacenter / suspicious). */
  humanOnly?: boolean;
};

async function countClicksForLinkIdChunk(
  client: SupabaseClient,
  linkIds: string[],
  options?: CountOptions
): Promise<number> {
  if (linkIds.length === 0) return 0;

  let query = client
    .from("link_clicks")
    .select("id", { count: "exact", head: true })
    .in("link_id", linkIds);
  if (options?.humanOnly) {
    query = query.eq("traffic_type", "human");
  }

  const { count, error } = await query;

  if (error) throw error;
  return count ?? 0;
}

export async function countClicksForLinkIds(
  client: SupabaseClient,
  linkIds: string[],
  options?: CountOptions
): Promise<number> {
  if (linkIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < linkIds.length; i += LINK_ID_IN_CHUNK) {
    const chunk = linkIds.slice(i, i + LINK_ID_IN_CHUNK);
    total += await countClicksForLinkIdChunk(client, chunk, options);
  }
  return total;
}

export async function fetchAllClicksForLinkIds(
  client: SupabaseClient,
  linkIds: string[]
): Promise<LinkClick[]> {
  if (linkIds.length === 0) return [];

  const all: LinkClick[] = [];
  for (let i = 0; i < linkIds.length; i += LINK_ID_IN_CHUNK) {
    const chunk = linkIds.slice(i, i + LINK_ID_IN_CHUNK);
    const chunkClicks = await fetchAllPages(async (from, to) =>
      client
        .from("link_clicks")
        .select(CLICK_ANALYTICS_COLUMNS)
        .in("link_id", chunk)
        .order("clicked_at", { ascending: false })
        .range(from, to)
    );
    all.push(...chunkClicks);
  }

  all.sort(
    (a, b) =>
      new Date(b.clicked_at).getTime() - new Date(a.clicked_at).getTime()
  );
  return all;
}

export async function fetchAllClicksForLinkId(
  client: SupabaseClient,
  linkId: string,
  options?: { creatorUsername?: string }
): Promise<LinkClick[]> {
  return fetchAllPages(async (from, to) => {
    let query = client
      .from("link_clicks")
      .select(CLICK_ANALYTICS_COLUMNS)
      .eq("link_id", linkId)
      .order("clicked_at", { ascending: false });

    if (options?.creatorUsername) {
      query = query.eq("creator_username", options.creatorUsername);
    }

    return query.range(from, to);
  });
}

export async function fetchAllLinksForProjectId(
  client: SupabaseClient,
  projectId: string
): Promise<Link[]> {
  return fetchAllPages(async (from, to) =>
    client
      .from("links")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(from, to)
  );
}

export async function fetchAllLinkIdsForProjectId(
  client: SupabaseClient,
  projectId: string
): Promise<string[]> {
  const rows = await fetchAllPages(async (from, to) =>
    client
      .from("links")
      .select("id")
      .eq("project_id", projectId)
      .range(from, to)
  );
  return rows.map((r) => r.id);
}

export async function fetchAllLinksForProjectIds(
  client: SupabaseClient,
  projectIds: string[]
): Promise<Link[]> {
  if (projectIds.length === 0) return [];

  const PROJECT_ID_CHUNK = 50;
  const all: Link[] = [];

  for (let i = 0; i < projectIds.length; i += PROJECT_ID_CHUNK) {
    const chunk = projectIds.slice(i, i + PROJECT_ID_CHUNK);
    const chunkLinks = await fetchAllPages(async (from, to) =>
      client
        .from("links")
        .select("*")
        .in("project_id", chunk)
        .order("created_at", { ascending: false })
        .range(from, to)
    );
    all.push(...chunkLinks);
  }

  all.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return all;
}

export async function fetchAllLinkIdsForProjectIds(
  client: SupabaseClient,
  projectIds: string[]
): Promise<string[]> {
  if (projectIds.length === 0) return [];

  const rows = await fetchAllPages(async (from, to) =>
    client
      .from("links")
      .select("id, project_id")
      .in("project_id", projectIds)
      .range(from, to)
  );
  return rows.map((r) => r.id);
}

/** The archive table has no foreign key to links, so it is not cascaded. */
export async function deleteAllArchivedClicksForLinkIds(
  client: SupabaseClient,
  linkIds: string[]
): Promise<void> {
  const LINK_ID_CHUNK = 100;

  for (let i = 0; i < linkIds.length; i += LINK_ID_CHUNK) {
    const chunk = linkIds.slice(i, i + LINK_ID_CHUNK);
    const { error } = await client
      .from("link_clicks_archive")
      .delete()
      .in("link_id", chunk);

    if (error) throw error;
  }
}
