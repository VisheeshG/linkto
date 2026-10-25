import { NextResponse } from "next/server";
import {
  classifyServiceKey,
  getSupabaseAdmin,
  getSupabaseAdminConfigError,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/health
// Reports whether the service-role client is configured and can query the
// database. Never returns or logs secret values (only the key's kind).
export async function GET() {
  const base = {
    serviceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    serviceKeyKind: classifyServiceKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  };

  const unhealthy = (error: string) => {
    console.error(`[health] ${error}`);
    return NextResponse.json(
      { ...base, database: "error" as const, error },
      { status: 503, headers: NO_STORE }
    );
  };

  const configError = getSupabaseAdminConfigError();
  if (configError) return unhealthy(`config error: ${configError}`);

  try {
    const { error } = await getSupabaseAdmin()
      .from("projects")
      .select("id", { count: "exact", head: true });
    if (error) {
      const detail =
        [error.code, error.message].filter(Boolean).join(" ") || "query failed";
      return unhealthy(`database error: ${detail}`);
    }
    return NextResponse.json(
      { ...base, database: "ok" as const },
      { headers: NO_STORE }
    );
  } catch (error) {
    return unhealthy(
      `unexpected error: ${error instanceof Error ? error.message : "unknown"}`
    );
  }
}
