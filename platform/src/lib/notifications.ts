import { Resend } from "resend";
import { downloadReceiptBytes } from "@/lib/receipt-storage";
import { renderVoucherPdf } from "@/lib/voucher-pdf";
import { buildApprovedRequestEmail } from "@/lib/notification-content";
import type { ApprovedRequestDetail } from "@/lib/request-data";

// Per ADR 0001, email is a notification channel only — it tells a human
// something needs their attention, it never carries the authoritative data.
// A delivery failure here must never block whatever it's reporting on;
// callers should catch and log rather than let a rejected promise stop
// their flow.

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

function getFinanceNotificationEmail(): string {
  const to = process.env.FINANCE_NOTIFICATION_EMAIL;
  if (!to) {
    throw new Error("FINANCE_NOTIFICATION_EMAIL is not set. See .env.example.");
  }
  return to;
}

// Fetches each receipt's raw bytes once and embeds them into the voucher PDF
// (voucher-pdf.tsx) -- one consolidated document, not a PDF plus a separate
// copy of every receipt file. A raw attachment is only added back for a
// receipt voucher-pdf.tsx couldn't embed (e.g. HEIC, listed by name on the
// voucher page itself) -- that's the only way Finance can still get that
// file. Never a link, always a real attachment.
export async function sendApprovedRequestEmail(detail: ApprovedRequestDetail): Promise<void> {
  const { subject, text } = buildApprovedRequestEmail(detail);
  const receiptFiles = await Promise.all(
    detail.receipts.map(async (r) => {
      const { buffer, contentType } = await downloadReceiptBytes(r.storageKey);
      return { filename: r.filename, buffer, contentType };
    }),
  );
  const { buffer: voucherPdf, unembeddableReceiptFilenames } = await renderVoucherPdf(detail, receiptFiles);
  const fallbackAttachments = receiptFiles
    .filter((file) => unembeddableReceiptFilenames.includes(file.filename))
    .map((file) => ({ filename: file.filename, content: file.buffer }));

  await getResendClient().emails.send({
    from: getFromAddress(),
    to: getFinanceNotificationEmail(),
    subject,
    text,
    attachments: [{ filename: `${detail.voucherNo}.pdf`, content: voucherPdf }, ...fallbackAttachments],
  });
}
