import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// HMAC-signed cookie carrying an arbitrary userId (requesters/approvers
// sign in via Google -- see google-oauth.ts).

const COOKIE_NAME = "app_session";

function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "APP_SESSION_SECRET is not set. See .env.example -- required to sign the app session.",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function buildCookieValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function parseCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  const separatorIndex = raw.lastIndexOf(".");
  if (separatorIndex === -1) return null;
  const userId = raw.slice(0, separatorIndex);
  const signature = raw.slice(separatorIndex + 1);
  if (!userId || !signature) return null;
  const expected = sign(userId);
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== givenBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, givenBuf)) return null;
  return userId;
}

export async function createUserSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildCookieValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function destroyUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return parseCookieValue(cookieStore.get(COOKIE_NAME)?.value);
}

export interface UserProfileView {
  name: string;
  picture: string | null;
}

// Deliberately here, not in request-data.ts/approval-data.ts -- a user's
// own display info (greeting, avatar) isn't Reimbursement or Approval
// business logic, it's the same "who is this session" concern the rest
// of this file already owns, just resolved past the cookie into the
// actual User row.
export async function getUserProfile(userId: string): Promise<UserProfileView | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, picture: true },
  });
}
