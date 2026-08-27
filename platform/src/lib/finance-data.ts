import { prisma } from "@/lib/prisma";
import { assertValidTransition, type FinanceStatus } from "@/lib/status-transitions";
import type {
  ApprovalHistoryEntryView,
  QueueItemView,
  RequestDetailView,
} from "@/types/finance";

// Finance-side statuses this slice actually surfaces in the queue — DRAFT/
// SUBMITTED/IN_APPROVAL/APPROVED requests aren't Finance's concern yet.
const FINANCE_STATUSES: FinanceStatus[] = [
  "READY_FOR_PROCESSING",
  "NEEDS_CLARIFICATION",
  "PROCESSING",
  "PROCESSED",
  "REJECTED_RETURNED",
];

function formatAmount(amount: { toString(): string }): string {
  return Number(amount.toString()).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function getFinanceQueue(): Promise<QueueItemView[]> {
  const requests = await prisma.reimbursementRequest.findMany({
    where: { status: { in: FINANCE_STATUSES } },
    include: { requester: true },
    orderBy: { submittedAt: "asc" },
  });

  return requests.map((r) => ({
    id: r.id,
    voucherNo: r.voucherNo,
    requesterName: r.requester.name,
    ministryType: r.ministryType,
    totalAmount: formatAmount(r.totalAmount),
    status: r.status as FinanceStatus,
    submittedAt: r.submittedAt?.toISOString() ?? null,
  }));
}

export async function getRequestDetail(id: string): Promise<RequestDetailView | null> {
  const r = await prisma.reimbursementRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      lineItems: true,
      receipts: true,
      requiredApprovals: { include: { approver: true } },
    },
  });
  if (!r) return null;

  const approvalHistory: ApprovalHistoryEntryView[] = r.requiredApprovals.map((a) => ({
    id: a.id,
    role: a.role,
    approverName: a.approver?.name ?? null,
    status: a.status,
    decidedAt: a.decidedAt?.toISOString() ?? null,
  }));

  return {
    id: r.id,
    voucherNo: r.voucherNo,
    requesterName: r.requester.name,
    requestType: r.requestType,
    ministryType: r.ministryType,
    totalAmount: formatAmount(r.totalAmount),
    status: r.status as FinanceStatus,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    lineItems: r.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      amount: formatAmount(li.amount),
    })),
    receipts: r.receipts.map((rec) => ({
      id: rec.id,
      storageKey: rec.storageKey,
      uploadedAt: rec.uploadedAt.toISOString(),
    })),
    approvalHistory,
  };
}

export async function transitionRequestStatus(
  requestId: string,
  toStatus: FinanceStatus,
  actorUserId: string,
): Promise<void> {
  const current = await prisma.reimbursementRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true },
  });

  // Validated again here (not just in the UI/action layer) so this function
  // is safe to call directly, e.g. from a future API route or test.
  assertValidTransition(current.status as FinanceStatus, toStatus);

  await prisma.$transaction([
    prisma.reimbursementRequest.update({
      where: { id: requestId },
      data: { status: toStatus },
    }),
    prisma.auditLogEntry.create({
      data: {
        reimbursementRequestId: requestId,
        actorUserId,
        action: `FINANCE_STATUS_${toStatus}`,
        details: { from: current.status, to: toStatus },
      },
    }),
  ]);
}
