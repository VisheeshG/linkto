import { supabase } from "@/lib/supabase";
import {
  countClicksForLinkIds,
  fetchAllClicksForLinkIds,
  fetchAllLinksForProjectIds,
} from "@/lib/supabase-pagination";

export type ProjectStats = {
  linkCount: number;
  clickCount: number;
};

const emptyStats = (): ProjectStats => ({ linkCount: 0, clickCount: 0 });

export { fetchAllClicksForLinkIds };

type StatsOptions = {
  /** Count only clicks classified as human ("Hide bot clicks"). */
  humanOnly?: boolean;
};

export async function fetchStatsForProjectIds(
  projectIds: string[],
  options?: StatsOptions
): Promise<ProjectStats> {
  if (projectIds.length === 0) {
    return emptyStats();
  }

  const allLinks = await fetchAllLinksForProjectIds(supabase, projectIds);
  const linkCount = allLinks.length;

  if (linkCount === 0) {
    return emptyStats();
  }

  const clickCount = await countClicksForLinkIds(
    supabase,
    allLinks.map((l) => l.id),
    options
  );
  return { linkCount, clickCount };
}

export async function fetchStatsMapForProjectIds(
  projectIds: string[],
  options?: StatsOptions
): Promise<Record<string, ProjectStats>> {
  const result: Record<string, ProjectStats> = {};
  for (const id of projectIds) {
    result[id] = emptyStats();
  }
  if (projectIds.length === 0) return result;

  const allLinks = await fetchAllLinksForProjectIds(supabase, projectIds);

  if (!allLinks.length) return result;

  const linkIdsByProject: Record<string, string[]> = {};
  for (const link of allLinks) {
    result[link.project_id].linkCount += 1;
    if (!linkIdsByProject[link.project_id]) {
      linkIdsByProject[link.project_id] = [];
    }
    linkIdsByProject[link.project_id].push(link.id);
  }

  await Promise.all(
    Object.entries(linkIdsByProject).map(async ([projectId, linkIds]) => {
      result[projectId].clickCount = await countClicksForLinkIds(
        supabase,
        linkIds,
        options
      );
    })
  );

  return result;
}
