import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveGoogleProfile } from "@/lib/google-oauth";
import { createUserSession } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  const codeVerifier = cookieStore.get("google_oauth_code_verifier")?.value;
  cookieStore.delete("google_oauth_state");
  cookieStore.delete("google_oauth_code_verifier");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return NextResponse.redirect(new URL("/requester-login?error=invalid_state", request.url));
  }

  const profile = await resolveGoogleProfile(code, codeVerifier);

  // Same "identity == User row by email" pattern as
  // getOrCreateAccountantUser in src/app/finance/actions.ts.
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { googleSub: profile.sub, picture: profile.picture },
    create: {
      email: profile.email,
      name: profile.name,
      googleSub: profile.sub,
      picture: profile.picture,
    },
  });

  await createUserSession(user.id);

  return NextResponse.redirect(new URL("/", request.url));
}
