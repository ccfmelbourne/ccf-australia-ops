import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Generalizes finance-auth.ts's HMAC-signed cookie pattern to carry an
// arbitrary userId instead of one fixed shared identity. Uses a separate
// cookie name (app_session) so this session is fully independent of
// Finance's own finance_session cookie -- no shared state, no migration
// needed for Finance's existing login.

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
