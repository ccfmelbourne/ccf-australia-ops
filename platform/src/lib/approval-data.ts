import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

export interface PendingApprovalLineItemView {
  description: string;
  amount: string; // formatted
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
  receiptCount: number;
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

  return approvals.map((a) => ({
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
    receiptCount: a.request.receipts.length,
  }));
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

  await prisma.requiredApproval.update({
    where: { id: approvalId },
    data: { status: decision, decidedAt: new Date(), comments },
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
    }
  }

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: approval.reimbursementRequestId,
      actorUserId: userId,
      action: "APPROVAL_DECIDED",
      details: { role: approval.role, decision },
    },
  });
}
