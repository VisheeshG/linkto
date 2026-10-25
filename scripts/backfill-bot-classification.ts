/**
 * Re-classifies historical clicks with the same rules the redirect handler
 * uses for new clicks, adding what the SQL migration cannot do on its own:
 *   - datacenter detection (needs an ASN / hosting lookup per IP)
 *   - visitor_hash for unique-visitor counts
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   [IP_API_KEY=...] [VISITOR_HASH_SALT=...] npm run backfill:bots -- [--dry-run]
 *
 * Use the same VISITOR_HASH_SALT as production so old and new clicks from the
 * same visitor hash identically. Without IP_API_KEY the free ip-api.com
 * endpoint is throttled to 45 lookups/minute, so large datasets take a while.
 * Safe to re-run: only rows without network data (asn IS NULL) are processed.
 */

import { createClient } from "@supabase/supabase-js";
import { classifyClick } from "../lib/bot-detection";
import { lookupGeo } from "../lib/geo";
import { computeVisitorHash } from "../lib/visitor";

const PAGE_SIZE = 1000;
const FREE_TIER_DELAY_MS = 1400; // 45 req/min

type ClickRow = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  traffic_type: string;
  visitor_hash: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const throttle = !process.env.IP_API_KEY;

  const networkCache = new Map<string, Awaited<ReturnType<typeof lookupGeo>>["network"]>();
  const counts: Record<string, number> = {};
  let processed = 0;
  let lastId = "00000000-0000-0000-0000-000000000000";

  for (;;) {
    const { data, error } = await supabase
      .from("link_clicks")
      .select("id, ip_address, user_agent, traffic_type, visitor_hash")
      .is("asn", null)
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (error) throw error;
    const rows = (data ?? []) as ClickRow[];
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      let network = null;
      if (row.ip_address) {
        if (!networkCache.has(row.ip_address)) {
          const geo = await lookupGeo(row.ip_address, new Headers());
          networkCache.set(row.ip_address, geo.network);
          if (throttle) await sleep(FREE_TIER_DELAY_MS);
        }
        network = networkCache.get(row.ip_address) ?? null;
      }

      // Header-based signals were never stored for old clicks, so only the
      // user agent and network are used here.
      const classification = classifyClick({
        userAgent: row.user_agent ?? "",
        network,
      });
      counts[classification.trafficType] = (counts[classification.trafficType] ?? 0) + 1;

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("link_clicks")
          .update({
            traffic_type: classification.trafficType,
            bot_reason: classification.reason,
            // Mark as looked up even when the provider returned nothing, so
            // re-runs skip the row.
            asn: network?.asn ?? "unknown",
            isp: network?.org || network?.isp || null,
            is_hosting: network?.isHosting ?? null,
            visitor_hash:
              row.visitor_hash ?? computeVisitorHash(row.ip_address, row.user_agent ?? ""),
          })
          .eq("id", row.id);
        if (updateError) throw updateError;
      }

      processed += 1;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed} clicks`, counts);
      }
    }
  }

  console.log(`${dryRun ? "[dry run] " : ""}Done. ${processed} clicks classified:`, counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
