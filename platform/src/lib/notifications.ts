import { Resend } from "resend";

// Per ADR 0001, email is a notification channel only — it tells a human
// something needs their attention, it never carries the authoritative data.
// A delivery failure here must never block whatever it's reporting on;
// callers should catch and log rather than let a rejected promise stop
// their flow.
//
// Generic Resend helpers only -- Finance no longer drives in-app status
// transitions (retired along with the rest of the Finance login/queue
// system), so the status-change email this file used to send has no
// caller left. Kept here as the shared Resend client/from-address setup
// for whatever the next email (e.g. the eventual "send Finance the
// approved form" notification) turns out to be.

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set. See .env.example.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getFromAddress(): string {
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!from) {
    throw new Error("EMAIL_FROM_ADDRESS is not set. See .env.example.");
  }
  return from;
}
