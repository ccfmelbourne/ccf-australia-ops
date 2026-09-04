import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSession } from "@/lib/user-session";
import { DEV_TEST_APPROVER_EMAIL, DEV_TEST_REQUESTER_EMAIL } from "@/lib/approval-routing";

export const dynamic = "force-dynamic";

// Local-testing-only bypass for Google Sign-In -- upserts a synthetic test
// user and signs in as them directly, no Google round-trip needed. Returns
// 404 in production so this can never be reached on the deployed app, even
// though it shares the same database as local dev (see
// DEV_TEST_APPROVER_EMAIL in approval-routing.ts for how the approver
// identity stays inert there).
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const as = request.nextUrl.searchParams.get("as") === "approver" ? "approver" : "requester";
  const identity =
    as === "approver"
      ? { email: DEV_TEST_APPROVER_EMAIL, name: "Dev Test Approver" }
      : { email: DEV_TEST_REQUESTER_EMAIL, name: "Dev Test Requester" };

  // status explicitly ACTIVE (not left to the schema's SUSPENDED default)
  // -- these synthetic identities only ever exist to test the app itself,
  // so there's no real "suspend a dev test user" scenario to defend
  // against, and NODE_ENV already keeps this route unreachable in
  // production.
  const user = await prisma.user.upsert({
    where: { email: identity.email },
    update: { status: "ACTIVE" },
    create: { email: identity.email, name: identity.name, status: "ACTIVE" },
  });

  await createUserSession(user.id);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
