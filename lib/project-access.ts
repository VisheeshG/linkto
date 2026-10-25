// Server-only: access control for shared (public) project analytics pages.

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** Failed attempts allowed per client per project within the window. */
export const MAX_FAILED_ATTEMPTS = 10;
export const ATTEMPT_WINDOW_MINUTES = 15;

type TokenPayload = {
  /** project id */
  p: string;
  /** password id the token was issued for */
  pw: string;
  /** expiry, unix seconds */
  exp: number;
};

function getSecret(): string {
  const secret =
    process.env.PROJECT_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("PROJECT_ACCESS_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function signAccessToken(
  projectId: string,
  passwordId: string,
  now = Date.now()
): { token: string; expiresAt: string } {
  const exp = Math.floor(now / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const payload: TokenPayload = { p: projectId, pw: passwordId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${encoded}.${sign(encoded)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/** Returns the password id the token was issued for, or null if invalid / expired. */
export function verifyAccessToken(
  token: string | null | undefined,
  projectId: string,
  now = Date.now()
): string | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TokenPayload;
    if (payload.p !== projectId) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    return typeof payload.pw === "string" ? payload.pw : null;
  } catch {
    return null;
  }
}

export function getAccessTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }
  return null;
}

export type ProjectAccess =
  | { allowed: true; hasPasswords: boolean }
  | { allowed: false; hasPasswords: true };

/**
 * A project without passwords is public. A protected project requires a valid
 * token whose password still exists (deleting a password revokes its tokens).
 */
export async function checkProjectAccess(
  admin: SupabaseClient,
  projectId: string,
  token: string | null
): Promise<ProjectAccess> {
  const { data: passwords, error } = await admin
    .from("project_passwords")
    .select("id")
    .eq("project_id", projectId);
  if (error) throw error;

  if (!passwords || passwords.length === 0) {
    return { allowed: true, hasPasswords: false };
  }

  const passwordId = verifyAccessToken(token, projectId);
  if (passwordId && passwords.some((p) => p.id === passwordId)) {
    return { allowed: true, hasPasswords: true };
  }
  return { allowed: false, hasPasswords: true };
}

export function hashClient(ip: string | null): string {
  return createHash("sha256")
    .update(`${getSecret()}|${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

export async function isRateLimited(
  admin: SupabaseClient,
  projectId: string,
  clientHash: string
): Promise<boolean> {
  const since = new Date(
    Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();
  const { count, error } = await admin
    .from("password_attempts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("client_hash", clientHash)
    .eq("succeeded", false)
    .gte("attempted_at", since);
  if (error) throw error;
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordPasswordAttempt(
  admin: SupabaseClient,
  projectId: string,
  clientHash: string,
  succeeded: boolean
): Promise<void> {
  const { error } = await admin
    .from("password_attempts")
    .insert({ project_id: projectId, client_hash: clientHash, succeeded });
  if (error) console.error("Failed to record password attempt:", error);
}
