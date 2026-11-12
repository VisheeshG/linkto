import { supabase } from "@/lib/supabase";
import type { ClickSource } from "@/lib/click-source";
import {
  loadConversionData,
  type ConversionData,
  type ConversionRange,
} from "@/lib/conversions";

/**
 * Conversion data for the signed-in owner (row level security) or for a
 * shared report (through /api/public/projects, which checks the password).
 * On a shared report, omit linkIds to cover the whole project.
 */
export async function loadConversions(
  source: ClickSource,
  linkIds: string[] | null,
  range: ConversionRange
): Promise<ConversionData> {
  if (source.kind === "owner") {
    return loadConversionData(supabase, linkIds ?? [], range);
  }

  const params = new URLSearchParams();
  for (const id of linkIds ?? []) params.append("link_id", id);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  if (range.humanOnly) params.set("human", "1");

  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(source.projectSlug)}/conversions?${params}`,
    {
      headers: source.accessToken
        ? { Authorization: `Bearer ${source.accessToken}` }
        : undefined,
      cache: "no-store",
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to load conversions (${response.status})`);
  }
  return (await response.json()) as ConversionData;
}
