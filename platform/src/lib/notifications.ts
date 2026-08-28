import { Resend } from "resend";
// Relative import (not the "@/lib/..." alias) so this module — and its test
// — resolve under plain `node --test`, not just Next's bundler.
import { FINANCE_STATUS_LABELS, type FinanceStatus } from "./status-transitions.ts";

// Per ADR 0001, email is a notification channel only — it tells a human
// something needs their attention, it never carries the authoritative data.
// So a delivery failure here must never block the Finance status transition
// it's reporting on; callers should catch and log rather than let a
// rejected promise stop their flow.

export interface StatusChangeNotification {
  requesterEmail: string;
  requesterName: string;
  voucherNo: string;
  totalAmount: string; // formatted, e.g. "245.80"
  toStatus: FinanceStatus;
}

export function buildStatusChangeEmail(notification: StatusChangeNotification): {
  subject: string;
  text: string;
} {
  const { requesterName, voucherNo, totalAmount, toStatus } = notification;
  const statusLabel = FINANCE_STATUS_LABELS[toStatus];

  return {
    subject: `Reimbursement ${voucherNo}: ${statusLabel}`,
    text: [
      `Hi ${requesterName},`,
      "",
      `Your reimbursement request ${voucherNo} ($${totalAmount}) is now: ${statusLabel}.`,
      "",
      "This is an automated notification — please contact Finance if you have questions.",
    ].join("\n"),
  };
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set. See .env.example.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromAddress(): string {
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!from) {
    throw new Error("EMAIL_FROM_ADDRESS is not set. See .env.example.");
  }
  return from;
}

export async function sendStatusChangeEmail(
  notification: StatusChangeNotification,
): Promise<void> {
  const { subject, text } = buildStatusChangeEmail(notification);
  const { error } = await getResendClient().emails.send({
    from: getFromAddress(),
    to: notification.requesterEmail,
    subject,
    text,
  });
  if (error) {
    throw new Error(`Resend failed to send status change email: ${error.message}`);
  }
}
