import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientIpFromRequest } from "@/lib/analytics";
import {
  ATTEMPT_WINDOW_MINUTES,
  hashClient,
  isRateLimited,
  recordPasswordAttempt,
  signAccessToken,
} from "@/lib/project-access";

// Public API to verify a password for a shared project.
// POST /api/verify-project-password  { project_slug, password }
// Returns a signed access token (24h) used by /api/public/projects/*.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const projectSlug = body?.project_slug;
    const password = body?.password;

    if (typeof projectSlug !== "string" || typeof password !== "string" || !projectSlug || !password) {
      return NextResponse.json(
        { error: "project_slug and password are required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("slug", projectSlug)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const clientHash = hashClient(getClientIpFromRequest(request));
    if (await isRateLimited(admin, project.id, clientHash)) {
      return NextResponse.json(
        {
          valid: false,
          error: `Too many attempts. Try again in ${ATTEMPT_WINDOW_MINUTES} minutes.`,
        },
        { status: 429 }
      );
    }

    const { data: passwords, error: passwordsError } = await admin
      .from("project_passwords")
      .select("id, password_hash")
      .eq("project_id", project.id);

    if (passwordsError) {
      console.error("Error fetching passwords:", passwordsError);
      return NextResponse.json(
        { error: "Failed to verify password" },
        { status: 500 }
      );
    }

    if (!passwords || passwords.length === 0) {
      return NextResponse.json({ valid: true, hasPasswords: false });
    }

    let matchedPasswordId: string | null = null;
    for (const pwd of passwords) {
      if (await bcrypt.compare(password, pwd.password_hash)) {
        matchedPasswordId = pwd.id;
        break;
      }
    }

    await recordPasswordAttempt(admin, project.id, clientHash, !!matchedPasswordId);

    if (!matchedPasswordId) {
      return NextResponse.json(
        { valid: false, hasPasswords: true, error: "Invalid password" },
        { status: 401 }
      );
    }

    const { token, expiresAt } = signAccessToken(project.id, matchedPasswordId);
    return NextResponse.json({
      valid: true,
      hasPasswords: true,
      accessToken: token,
      expiresAt,
    });
  } catch (error) {
    console.error("Error verifying password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
