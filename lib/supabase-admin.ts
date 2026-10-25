import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export type ServiceKeyKind =
  | "missing"
  | "service_role"
  | "anon"
  | "secret"
  | "publishable"
  | "unknown";

/**
 * Classify the configured service key WITHOUT exposing it: legacy JWT keys
 * carry a non-secret `role` claim; new-style keys have a known prefix.
 * An anon/publishable key here would silently resolve nothing (there are no
 * public RLS policies on links/projects/brands), so it counts as misconfigured.
 */
export function classifyServiceKey(key: string | undefined | null): ServiceKeyKind {
  if (!key || !key.trim()) return "missing";
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) return "secret";
  if (trimmed.startsWith("sb_publishable_")) return "publishable";
  const parts = trimmed.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString("utf8")
      ) as { role?: unknown };
      if (payload.role === "service_role") return "service_role";
      if (payload.role === "anon") return "anon";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

/** Describes what is wrong with the admin client config, or null if usable. */
export function getSupabaseAdminConfigError(): string | null {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length > 0) return `missing env: ${missing.join(", ")}`;

  const kind = classifyServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (kind === "anon" || kind === "publishable") {
    return `SUPABASE_SERVICE_ROLE_KEY holds a ${kind} key, not the service_role/secret key`;
  }
  return null;
}

/**
 * Service-role client for server-only code (API routes, redirect handler).
 * Bypasses RLS — never import this from client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const configError = getSupabaseAdminConfigError();
  if (configError) {
    throw new Error(`Supabase admin client misconfigured: ${configError}`);
  }

  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return adminClient;
}
