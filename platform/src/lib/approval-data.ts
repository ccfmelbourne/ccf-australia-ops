import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getApprovedRequestDetail, receiptFilename } from "@/lib/request-data";
import { sendApprovedRequestEmail } from "@/lib/notifications";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { assertValidSignatureImage, buildSignatureStorageKey, uploadSignature } from "@/lib/signature-storage";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

export interface PendingApprovalLineItemView {
  description: string;
  amount: string; // formatted
}

export interface PendingApprovalReceiptView {
  filename: string;
  // Signed URL, computed at render time -- same pattern getDraftRequest
  // already uses for the requester's own receipts (receipt-storage.ts's
  // getReceiptDownloadUrl), so an approver can actually open/check one
  // against the line-item list before deciding, not just see a count.
  viewUrl: string;
}

export interface PendingApprovalView {
  approvalId: string;
  role: string;
  requestId: string;
  voucherNo: string;
  requesterName: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  lineItems: PendingApprovalLineItemView[];
  receipts: PendingApprovalReceiptView[];
}

// Deliberately excludes bank details -- spec 0002's explicit access
// restriction: an approver needs to know the *amount*, not the *account
// number*, to do their job. Filtering to request.status: "IN_APPROVAL"
// (not just this row's own PENDING status) hides a row once its request
// has already been fully approved/rejected via a sibling decision, without
// needing to touch sibling rows.
export async function getPendingApprovalsForUser(userId: string): Promise<PendingApprovalView[]> {
  const approvals = await prisma.requiredApproval.findMany({
    where: {
      approverUserId: userId,
      status: "PENDING",
      request: { status: "IN_APPROVAL" },
    },
    include: {
      request: {
        include: { requester: true, lineItems: true, receipts: true },
      },
    },
    orderBy: { request: { submittedAt: "asc" } },
  });

  return Promise.all(
    approvals.map(async (a) => ({
      approvalId: a.id,
      role: a.role,
      requestId: a.request.id,
      voucherNo: a.request.voucherNo,
      requesterName: a.request.requester.name,
      requestType: a.request.requestType,
      ministryType: a.request.ministryType,
      totalAmount: formatAmount(a.request.totalAmount),
      lineItems: a.request.lineItems.map((li) => ({
        description: li.description,
        amount: formatAmount(li.amount),
      })),
      receipts: await Promise.all(
        a.request.receipts.map(async (rec) => ({
          filename: receiptFilename(rec.storageKey),
          viewUrl: await getReceiptDownloadUrl(rec.storageKey),
        })),
      ),
    })),
  );
}

// A single rejection ends the whole chain (matches spec 0002's
// rejectReturn action). An approval only moves the request to APPROVED
// once every RequiredApproval row for it is APPROVED. Not wrapped in an
// interactive transaction -- this codebase's proven-safe pattern is plain
// sequential calls (see request-data.ts's top-of-file note on why
// interactive transactions were dropped in this stack).
export async function decideApproval(
  approvalId: string,
  userId: string,
  decision: "APPROVED" | "REJECTED",
  comments: string | null,
  signatureBuffer: Buffer | null,
): Promise<void> {
  const approval = await prisma.requiredApproval.findUnique({
    where: { id: approvalId },
    include: { request: true },
  });
  if (
    !approval ||
    approval.approverUserId !== userId ||
    approval.status !== "PENDING" ||
    approval.request.status !== "IN_APPROVAL"
  ) {
    throw new Error("Approval not found.");
  }
  if (decision === "APPROVED" && !signatureBuffer) {
    throw new Error("A signature is required to approve.");
  }

  let signatureStorageKey: string | null = null;
  if (decision === "APPROVED" && signatureBuffer) {
    assertValidSignatureImage(signatureBuffer);
    signatureStorageKey = buildSignatureStorageKey(approvalId);
    await uploadSignature(signatureStorageKey, signatureBuffer);
  }

  await prisma.requiredApproval.update({
    where: { id: approvalId },
    data: { status: decision, decidedAt: new Date(), comments, signatureStorageKey },
  });

  if (decision === "REJECTED") {
    await prisma.reimbursementRequest.update({
      where: { id: approval.reimbursementRequestId },
      data: { status: "REJECTED_RETURNED" },
    });
  } else {
    const remaining = await prisma.requiredApproval.count({
      where: { reimbursementRequestId: approval.reimbursementRequestId, status: { not: "APPROVED" } },
    });
    if (remaining === 0) {
      await prisma.reimbursementRequest.update({
        where: { id: approval.reimbursementRequestId },
        data: { status: "APPROVED" },
      });
      // Per ADR 0001, a notification failure must never undo or block the
      // approval decision it's reporting on -- caught and logged, not
      // rethrown.
      try {
        const detail = await getApprovedRequestDetail(approval.reimbursementRequestId);
        if (detail) {
          await sendApprovedRequestEmail(detail);
        }
      } catch (err) {
        console.error("Failed to send approved-request notification:", err);
      }
    }
  }

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: approval.reimbursementRequestId,
      actorUserId: userId,
      action: "APPROVAL_DECIDED",
      // comments included here (not just on the RequiredApproval row
      // itself) so a rejection's reason can be read back the same way
      // requestChanges's is -- request-data.ts's getDraftRequest sources
      // both from AuditLogEntry uniformly.
      details: { role: approval.role, decision, comments },
    },
  });
}

// Sends the request back to the requester to fix something, rather than
// terminating it (REJECTED) or deciding it (APPROVED). Deliberately
// lightweight -- it doesn't touch any RequiredApproval row, including this
// one, which is left exactly as it is (still PENDING). All of the "how do
// we re-enter approval" logic lives in submitRequest instead (request-data.ts),
// which on resubmission preserves any *other* role's already-APPROVED
// decision when nothing that matters changed, rather than forcing everyone
// to re-approve just because one approver flagged something.
export async function requestChanges(approvalId: string, userId: string, comments: string): Promise<void> {
  const approval = await prisma.requiredApproval.findUnique({
    where: { id: approvalId },
    include: { request: true },
  });
  if (
    !approval ||
    approval.approverUserId !== userId ||
    approval.status !== "PENDING" ||
    approval.request.status !== "IN_APPROVAL"
  ) {
    throw new Error("Approval not found.");
  }

  await prisma.reimbursementRequest.update({
    where: { id: approval.reimbursementRequestId },
    data: { status: "NEEDS_CLARIFICATION" },
  });

  // The durable record of why -- request-data.ts's getDraftRequest reads
  // this back to show the requester, since the RequiredApproval row that
  // would otherwise carry this comment is deliberately left untouched.
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: approval.reimbursementRequestId,
      actorUserId: userId,
      action: "CHANGES_REQUESTED",
      details: { role: approval.role, comments },
    },
  });
}
