import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthorizationRequest } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE_MAX_AGE = 60 * 10; // 10 minutes -- just long enough for the redirect round-trip

export async function GET() {
  const { url, state, codeVerifier } = buildAuthorizationRequest();
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
  cookieStore.set("google_oauth_state", state, cookieOpts);
  cookieStore.set("google_oauth_code_verifier", codeVerifier, cookieOpts);
  return NextResponse.redirect(url);
}
