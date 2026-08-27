import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Slice-1 scope: a single, env-configured Finance/accountant identity — just
// enough to demonstrate "someone acting as Finance opens the queue," per the
// project decision-maker's explicit call to keep auth minimal for the first
// vertical slice. Real multi-user auth (accounts, roles, NextAuth or
// similar) is a separate later slice once there's more than one Finance
// user to distinguish — see .ai/PROJECT.md "Phase Transition".

const COOKIE_NAME = "finance_session";
const SESSION_VALUE = "finance-accountant";

function getSessionSecret(): string {
  const secret = process.env.FINANCE_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "FINANCE_SESSION_SECRET is not set. See .env.example — required to sign the Finance login session.",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function buildCookieValue(): string {
  return `${SESSION_VALUE}.${sign(SESSION_VALUE)}`;
}

function isValidCookieValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const [value, signature] = raw.split(".");
  if (!value || !signature || value !== SESSION_VALUE) return false;
  const expected = sign(value);
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}

export function verifyFinancePassword(candidate: string): boolean {
  const expected = process.env.FINANCE_ACCOUNTANT_PASSWORD;
  if (!expected) {
    throw new Error(
      "FINANCE_ACCOUNTANT_PASSWORD is not set. See .env.example.",
    );
  }
  const expectedBuf = Buffer.from(expected);
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) return false;
  return timingSafeEqual(expectedBuf, candidateBuf);
}

export async function createFinanceSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function destroyFinanceSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isFinanceAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidCookieValue(cookieStore.get(COOKIE_NAME)?.value);
}

export function getFinanceAccountantName(): string {
  return process.env.FINANCE_ACCOUNTANT_NAME ?? "Finance";
}

export function getFinanceAccountantEmail(): string {
  const email = process.env.FINANCE_ACCOUNTANT_EMAIL;
  if (!email) {
    throw new Error("FINANCE_ACCOUNTANT_EMAIL is not set. See .env.example.");
  }
  return email;
}
