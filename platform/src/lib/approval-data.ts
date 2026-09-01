import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getApprovedRequestDetail, receiptFilename } from "@/lib/request-data";
import { sendApprovedRequestEmail } from "@/lib/notifications";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { assertValidSignatureImage, buildSignatureStorageKey, uploadSignature } from "@/lib/signature-storage";
import { getTier, REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS } from "@/lib/approval-routing";
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

// A tier-4 request's REGIONAL_DIRECTOR row can be satisfied two ways
// (specs/0001's confirmed Regional Director / COS-committee override
// rule) -- every other role still needs a flat APPROVED, but
// REGIONAL_DIRECTOR itself counts as satisfied if either it's directly
// APPROVED, or a RegionalDirectorOverride exists with all 3 committee
// members unanimous (withinBudget). Kept as the one place this decision is
// made, per spec 0002's "Approval branching" note, rather than duplicating
// this logic at each call site.
function isFullyApproved(
  requiredApprovals: { role: string; status: string }[],
  override: { withinBudget: boolean } | null,
): boolean {
  const nonRegional = requiredApprovals.filter((a) => a.role !== "REGIONAL_DIRECTOR");
  if (!nonRegional.every((a) => a.status === "APPROVED")) return false;
  const regional = requiredApprovals.find((a) => a.role === "REGIONAL_DIRECTOR");
  if (!regional) return true; // tier < 4, no such row exists at all
  return regional.status === "APPROVED" || override?.withinBudget === true;
}

// Two places can newly complete a request's approval: a regular
// decideApproval("APPROVED") call, and overrideApprove's third/final
// committee vote. Both call this instead of duplicating the
// finalize-and-notify logic.
async function finalizeIfFullyApproved(requestId: string): Promise<void> {
  const [requiredApprovals, override] = await Promise.all([
    prisma.requiredApproval.findMany({ where: { reimbursementRequestId: requestId } }),
    prisma.regionalDirectorOverride.findUnique({ where: { reimbursementRequestId: requestId } }),
  ]);
  if (!isFullyApproved(requiredApprovals, override)) return;

  await prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });
  // Per ADR 0001, a notification failure must never undo or block the
  // approval decision it's reporting on -- caught and logged, not
  // rethrown.
  try {
    const detail = await getApprovedRequestDetail(requestId);
    if (detail) {
      await sendApprovedRequestEmail(detail);
    }
  } catch (err) {
    console.error("Failed to send approved-request notification:", err);
  }
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
    await finalizeIfFullyApproved(approval.reimbursementRequestId);
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

// Starts the tier-4 committee-override path (specs/0001) as an alternative
// to waiting on the Regional Director -- callable by the requester or any
// of the three fixed committee members (REGIONAL_DIRECTOR_OVERRIDE_
// COMMITTEE_EMAILS, approval-routing.ts), per the decision-maker's call to
// widen this beyond just the requester. Doesn't touch the REGIONAL_DIRECTOR
// RequiredApproval row -- it stays PENDING and can still be decided
// directly; the two paths are alternatives, not a cancellation of one by
// the other.
export async function requestOverride(requestId: string, userId: string): Promise<void> {
  const request = await prisma.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: { regionalOverride: true },
  });
  if (!request || request.status !== "IN_APPROVAL") {
    throw new Error("Request not found.");
  }
  if (getTier(Number(request.totalAmount)) !== 4) {
    throw new Error("The committee override only applies to tier-4 (over $5,000) requests.");
  }
  if (request.regionalOverride) {
    throw new Error("A committee override has already been requested for this request.");
  }
  const regionalRow = await prisma.requiredApproval.findUnique({
    where: { reimbursementRequestId_role: { reimbursementRequestId: requestId, role: "REGIONAL_DIRECTOR" } },
  });
  if (!regionalRow || regionalRow.status !== "PENDING") {
    throw new Error("Regional Director approval is no longer pending.");
  }

  const committeeUsers = await prisma.user.findMany({
    where: { email: { in: [...REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS] } },
  });
  if (committeeUsers.length !== REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS.length) {
    throw new Error("The override committee is not fully set up.");
  }
  if (userId !== request.requesterId && !committeeUsers.some((u) => u.id === userId)) {
    throw new Error("Only the requester or a committee member can request this override.");
  }

  await prisma.regionalDirectorOverride.create({
    data: {
      reimbursementRequestId: requestId,
      approvals: { create: committeeUsers.map((u) => ({ approverUserId: u.id })) },
    },
  });

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: requestId,
      actorUserId: userId,
      action: "OVERRIDE_REQUESTED",
    },
  });
}

// One of the three committee members casts their vote. Unanimous approval
// *is* the within-budget attestation (per spec 0001, no separate
// budget-plan lookup) -- the third "yes" both flips withinBudget and
// (via finalizeIfFullyApproved) can complete the whole request if every
// other role is already APPROVED too. A "no" just records a no; V1
// deliberately doesn't add any retry/escalation flow beyond what the
// requester/committee can already see in the request's progress view.
export async function overrideApprove(
  overrideApprovalId: string,
  userId: string,
  approved: boolean,
): Promise<void> {
  const overrideApproval = await prisma.overrideApproval.findUnique({
    where: { id: overrideApprovalId },
    include: { override: true },
  });
  if (!overrideApproval || overrideApproval.approverUserId !== userId || overrideApproval.decidedAt !== null) {
    throw new Error("Override approval not found.");
  }

  await prisma.overrideApproval.update({
    where: { id: overrideApprovalId },
    data: { approved, decidedAt: new Date() },
  });

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: overrideApproval.override.reimbursementRequestId,
      actorUserId: userId,
      action: "OVERRIDE_APPROVAL_DECIDED",
      details: { approved },
    },
  });

  if (!approved) return;

  const allApprovals = await prisma.overrideApproval.findMany({
    where: { overrideId: overrideApproval.overrideId },
  });
  if (!allApprovals.every((a) => a.approved)) return;

  await prisma.regionalDirectorOverride.update({
    where: { id: overrideApproval.overrideId },
    data: { withinBudget: true },
  });
  await finalizeIfFullyApproved(overrideApproval.override.reimbursementRequestId);
}
