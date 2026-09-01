import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getApprovedRequestDetail, receiptFilename } from "@/lib/request-data";
import { sendApprovedRequestEmail } from "@/lib/notifications";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { assertValidSignatureImage, buildSignatureStorageKey, uploadSignature } from "@/lib/signature-storage";
import { getTier, COS_POOL, REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL } from "@/lib/approval-routing";
import type { ApproverRoleValue } from "@/lib/approval-routing";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

// COS1/COS2 are claimable, not pre-assigned -- any of the 3 COS_POOL
// members can decide one, whichever they get to first (approval-data.ts's
// decideApproval sets approverUserId at decision time). Each needed slot
// must be claimed by a different person.
const CLAIMABLE_ROLES: ApproverRoleValue[] = ["COS1", "COS2"];

async function resolveCosPoolUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { email: { in: [...COS_POOL] } } });
  return users.map((u) => u.id);
}

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
//
// A COS1/COS2 row is only ever visible to a request's Ministry Overseer
// (rare -- own-ministry request) or to a COS_POOL member, and only when
// it's still unclaimed (approverUserId null). Tier 2 is the one tier where
// Ministry Overseer and COS coexist -- there, the COS row also stays
// hidden until Overseer has approved (decideApproval enforces this too;
// this is just so it doesn't show as actionable before then). Tier 3/4
// requests have no Ministry Overseer row at all, so that gate is a no-op
// for them. A pool member who's already claimed the request's other COS
// slot doesn't see the remaining one either -- each slot needs a
// different person.
export async function getPendingApprovalsForUser(userId: string): Promise<PendingApprovalView[]> {
  const poolUserIds = await resolveCosPoolUserIds();
  const isPoolMember = poolUserIds.includes(userId);

  const approvals = await prisma.requiredApproval.findMany({
    where: {
      status: "PENDING",
      request: { status: "IN_APPROVAL" },
      OR: [
        { approverUserId: userId },
        ...(isPoolMember ? [{ role: { in: CLAIMABLE_ROLES }, approverUserId: null }] : []),
      ],
    },
    include: {
      request: {
        include: { requester: true, lineItems: true, receipts: true, requiredApprovals: true },
      },
    },
    orderBy: { request: { submittedAt: "asc" } },
  });

  const visible = approvals.filter((a) => {
    const isClaimableSlot = CLAIMABLE_ROLES.includes(a.role) && a.approverUserId === null;
    if (!isClaimableSlot) return true;

    const overseerRow = a.request.requiredApprovals.find((r) => r.role === "MINISTRY_OVERSEER");
    if (overseerRow && overseerRow.status !== "APPROVED") return false;

    const alreadyClaimedByThisUser = a.request.requiredApprovals.some(
      (r) => CLAIMABLE_ROLES.includes(r.role) && r.approverUserId === userId,
    );
    return !alreadyClaimedByThisUser;
  });

  return Promise.all(
    visible.map(async (a) => ({
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

// A tier-4 request's REGIONAL_DIRECTOR row can be satisfied two ways:
// directly APPROVED, or (as an alternative) the request's
// regionalDirectorOverrideConfirmedAt being set -- Ross Callado's explicit
// "within budget" confirmation, gated on COS1+COS2 both already APPROVED
// (confirmRegionalDirectorOverride enforces that precondition before ever
// setting the timestamp, so it's not re-checked here). Every other role
// still needs a flat APPROVED.
function isFullyApproved(
  requiredApprovals: { role: string; status: string }[],
  regionalDirectorOverrideConfirmedAt: Date | null,
): boolean {
  const nonRegional = requiredApprovals.filter((a) => a.role !== "REGIONAL_DIRECTOR");
  if (!nonRegional.every((a) => a.status === "APPROVED")) return false;
  const regional = requiredApprovals.find((a) => a.role === "REGIONAL_DIRECTOR");
  if (!regional) return true; // tier < 4, no such row exists at all
  return regional.status === "APPROVED" || regionalDirectorOverrideConfirmedAt !== null;
}

// Two places can newly complete a request's approval: a regular
// decideApproval("APPROVED") call, and confirmRegionalDirectorOverride.
// Both call this instead of duplicating the finalize-and-notify logic.
async function finalizeIfFullyApproved(requestId: string): Promise<void> {
  const [requiredApprovals, request] = await Promise.all([
    prisma.requiredApproval.findMany({ where: { reimbursementRequestId: requestId } }),
    prisma.reimbursementRequest.findUnique({
      where: { id: requestId },
      select: { regionalDirectorOverrideConfirmedAt: true },
    }),
  ]);
  if (!request || !isFullyApproved(requiredApprovals, request.regionalDirectorOverrideConfirmedAt)) return;

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
  if (!approval || approval.status !== "PENDING" || approval.request.status !== "IN_APPROVAL") {
    throw new Error("Approval not found.");
  }

  // COS1/COS2 are claimable, not pre-assigned -- ownership is checked
  // differently: any COS_POOL member can decide a still-unclaimed row
  // (approverUserId null), as long as they haven't already claimed the
  // request's other COS slot. Everything else keeps the exact-match
  // ownership check. Tier 2's Ministry-Overseer-first gate only applies
  // when an Overseer row actually exists for this request (tier 3/4 have
  // none, so this is a no-op for them) -- defensive check, since
  // getPendingApprovalsForUser already hides the row from that pool
  // member's queue until Overseer has approved.
  let claimingUserId: string | null = null;
  if (CLAIMABLE_ROLES.includes(approval.role)) {
    if (approval.approverUserId !== null) {
      throw new Error("Approval not found.");
    }
    const overseerRow = await prisma.requiredApproval.findUnique({
      where: {
        reimbursementRequestId_role: {
          reimbursementRequestId: approval.reimbursementRequestId,
          role: "MINISTRY_OVERSEER",
        },
      },
    });
    if (overseerRow && overseerRow.status !== "APPROVED") {
      throw new Error("Ministry Overseer must approve first.");
    }
    const poolUserIds = await resolveCosPoolUserIds();
    if (!poolUserIds.includes(userId)) {
      throw new Error("Approval not found.");
    }
    const alreadyClaimed = await prisma.requiredApproval.findFirst({
      where: {
        reimbursementRequestId: approval.reimbursementRequestId,
        role: { in: CLAIMABLE_ROLES },
        approverUserId: userId,
      },
    });
    if (alreadyClaimed) {
      throw new Error("You've already approved a COS slot on this request.");
    }
    claimingUserId = userId;
  } else if (approval.approverUserId !== userId) {
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
    data: {
      status: decision,
      decidedAt: new Date(),
      comments,
      signatureStorageKey,
      ...(claimingUserId ? { approverUserId: claimingUserId } : {}),
    },
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
  if (!approval || approval.status !== "PENDING" || approval.request.status !== "IN_APPROVAL") {
    throw new Error("Approval not found.");
  }
  // Same claimable-role ownership check as decideApproval, minus the
  // claiming itself -- this doesn't touch the row's approverUserId
  // (deliberately, see the comment above), so any COS_POOL member can
  // request changes on a still-unclaimed slot without claiming it.
  if (CLAIMABLE_ROLES.includes(approval.role) && approval.approverUserId === null) {
    const poolUserIds = await resolveCosPoolUserIds();
    if (!poolUserIds.includes(userId)) {
      throw new Error("Approval not found.");
    }
  } else if (approval.approverUserId !== userId) {
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

// Ross Callado's explicit "within budget" confirmation -- the alternative
// to waiting on direct Regional Director approval for a tier-4 request
// (approval-routing.ts's REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL).
// Requires COS1+COS2 (already required for tier 4 regardless) to both be
// APPROVED first -- confirming before the normal baseline is even done
// doesn't match the decision-maker's "only once Regional Director's been
// pending a week or more" framing. Doesn't touch the REGIONAL_DIRECTOR
// row itself -- it stays PENDING and can still be decided directly; the
// two paths are alternatives, not a cancellation of one by the other.
export async function confirmRegionalDirectorOverride(requestId: string, userId: string): Promise<void> {
  const request = await prisma.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: { requiredApprovals: true },
  });
  if (!request || request.status !== "IN_APPROVAL") {
    throw new Error("Request not found.");
  }
  if (getTier(Number(request.totalAmount)) !== 4) {
    throw new Error("This confirmation only applies to tier-4 (over $5,000) requests.");
  }
  if (request.regionalDirectorOverrideConfirmedAt) {
    throw new Error("This request has already been confirmed.");
  }
  const regionalRow = request.requiredApprovals.find((a) => a.role === "REGIONAL_DIRECTOR");
  if (!regionalRow || regionalRow.status !== "PENDING") {
    throw new Error("Regional Director approval is no longer pending.");
  }
  const cos1 = request.requiredApprovals.find((a) => a.role === "COS1");
  const cos2 = request.requiredApprovals.find((a) => a.role === "COS2");
  if (cos1?.status !== "APPROVED" || cos2?.status !== "APPROVED") {
    throw new Error("Both COS approvals are required before confirming.");
  }
  const confirmer = await prisma.user.findUnique({
    where: { email: REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL },
  });
  if (!confirmer || confirmer.id !== userId) {
    throw new Error("Only Ross Callado can confirm this.");
  }

  await prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { regionalDirectorOverrideConfirmedAt: new Date() },
  });
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: requestId,
      actorUserId: userId,
      action: "REGIONAL_DIRECTOR_OVERRIDE_CONFIRMED",
    },
  });
  await finalizeIfFullyApproved(requestId);
}

