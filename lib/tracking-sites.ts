// Server-only: resolves the site (and owner) behind an integration key.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TtlCache } from "@/lib/ttl-cache";

export const PUBLIC_KEY_PREFIX = "lt_pub_";
export const SECRET_KEY_PREFIX = "lt_sec_";

export type SiteAuth = {
  id: string;
  userId: string;
  defaultCurrency: string;
};

const FOUND_TTL_MS = 60_000;
const MISSING_TTL_MS = 10_000;

// Keyed by the public key or the secret's hash, never the secret itself.
const siteCache = new TtlCache<SiteAuth | null>(2000);

export function hashSecretKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function clearSiteCache(): void {
  siteCache.clear();
}

async function lookup(
  supabase: SupabaseClient,
  column: "public_key" | "secret_key_hash",
  value: string
): Promise<SiteAuth | null> {
  const cacheKey = `${column}:${value}`;
  const cached = siteCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from("tracking_sites")
    .select("id, user_id, default_currency")
    .eq(column, value)
    .limit(1);
  if (error) throw error;

  const row = (data as { id: string; user_id: string; default_currency: string }[] | null)?.[0];
  const site = row
    ? { id: row.id, userId: row.user_id, defaultCurrency: row.default_currency }
    : null;
  siteCache.set(cacheKey, site, site ? FOUND_TTL_MS : MISSING_TTL_MS);
  return site;
}

/** Site for a public key (`lt_pub_…`), as sent by the browser snippet. */
export function findSiteByPublicKey(
  supabase: SupabaseClient,
  publicKey: string
): Promise<SiteAuth | null> {
  if (!publicKey.startsWith(PUBLIC_KEY_PREFIX) || publicKey.length > 80) {
    return Promise.resolve(null);
  }
  return lookup(supabase, "public_key", publicKey);
}

/** Site for a secret key (`lt_sec_…`), as sent by a server. */
export function findSiteBySecretKey(
  supabase: SupabaseClient,
  secretKey: string
): Promise<SiteAuth | null> {
  if (!secretKey.startsWith(SECRET_KEY_PREFIX) || secretKey.length > 120) {
    return Promise.resolve(null);
  }
  return lookup(supabase, "secret_key_hash", hashSecretKey(secretKey));
}
