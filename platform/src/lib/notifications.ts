import { Resend } from "resend";
import { downloadReceiptBytes } from "@/lib/receipt-storage";
import { downloadSignatureBytes } from "@/lib/signature-storage";
import { renderVoucherPdf } from "@/lib/voucher-pdf";
import {
  buildApprovedRequestEmail,
  buildStaleDraftReminderEmail,
  buildNewApprovalNotificationEmail,
  buildPendingApprovalReminderEmail,
} from "@/lib/notification-content";
import type {
  StaleDraftReminderDetail,
  ApprovalNotificationDetail,
  PendingApprovalReminderDetail,
} from "@/lib/notification-content";
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
  const [receiptFiles, signaturesByRole, requesterSignature] = await Promise.all([
    Promise.all(
      detail.receipts.map(async (r) => {
        const { buffer, contentType } = await downloadReceiptBytes(r.storageKey);
        return { filename: r.filename, buffer, contentType };
      }),
    ),
    Promise.all(
      detail.approvals
        .filter((a) => a.signatureStorageKey)
        .map(async (a) => ({
          role: a.role,
          buffer: await downloadSignatureBytes(a.signatureStorageKey as string),
        })),
    ).then((entries) => new Map(entries.map((e) => [e.role, e.buffer]))),
    detail.requesterSignatureStorageKey
      ? downloadSignatureBytes(detail.requesterSignatureStorageKey)
      : Promise.resolve(null),
  ]);
  // An AUTO_SATISFIED approval (the requester is also that tier's
  // designated approver -- request-data.ts's submitRequest) never has its
  // own signatureStorageKey, since they never click "Approve" on their own
  // request. Confirmed with the decision-maker: the voucher should still
  // show a real signature there rather than leaving it blank, reusing the
  // same one they already drew for "Requisitioned By" -- it's the same
  // person's attestation either way, and this doesn't add a second signing
  // action.
  for (const a of detail.approvals) {
    if (a.status === "AUTO_SATISFIED" && requesterSignature) {
      signaturesByRole.set(a.role, requesterSignature);
    }
  }
  const { buffer: voucherPdf, unembeddableReceiptFilenames } = await renderVoucherPdf(
    detail,
    receiptFiles,
    signaturesByRole,
    requesterSignature,
  );
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

export async function sendStaleDraftReminderEmail(
  requesterEmail: string,
  detail: StaleDraftReminderDetail,
): Promise<void> {
  const { subject, text } = buildStaleDraftReminderEmail(detail);
  await getResendClient().emails.send({
    from: getFromAddress(),
    to: requesterEmail,
    subject,
    text,
  });
}

// `to` accepts multiple addresses -- a claimable COS1/COS2 slot has no
// single approver until someone claims it, so that case goes to the
// whole COS_POOL (approval-routing.ts) at once, not one person.
export async function sendNewApprovalNotificationEmail(
  to: string[],
  detail: ApprovalNotificationDetail,
): Promise<void> {
  const { subject, text } = buildNewApprovalNotificationEmail(detail);
  await getResendClient().emails.send({ from: getFromAddress(), to, subject, text });
}

export async function sendPendingApprovalReminderEmail(
  to: string[],
  detail: PendingApprovalReminderDetail,
): Promise<void> {
  const { subject, text } = buildPendingApprovalReminderEmail(detail);
  await getResendClient().emails.send({ from: getFromAddress(), to, subject, text });
}
