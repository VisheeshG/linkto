import { createHash } from "crypto";

/**
 * Stable, non-reversible visitor fingerprint (IP + user agent) used for
 * unique-click counts and burst detection without exposing the raw IP.
 */
export function computeVisitorHash(ip: string | null, userAgent: string): string | null {
  if (!ip) return null;
  const salt = process.env.VISITOR_HASH_SALT || "linkto-visitor";
  return createHash("sha256")
    .update(`${salt}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
