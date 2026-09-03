import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { receiptFilename, finalizeIfFullyApproved, isDecided } from "@/lib/request-data";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { assertValidSignatureImage, buildSignatureStorageKey, uploadSignature } from "@/lib/signature-storage";
import { sendPendingApprovalReminderEmail } from "@/lib/notifications";
import {
  getTier,
  COS_POOL,
  REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL,
  DEV_TEST_APPROVER_EMAIL,
  DEV_TEST_REQUESTER_EMAIL,
  getApproverRoleLabel,
} from "@/lib/approval-routing";
import type { ApproverRoleValue } from "@/lib/approval-routing";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

// COS1/COS2 are claimable, not pre-assigned -- any COS_POOL member can
// decide one, whichever they get to first (decideApproval sets
// approverUserId at decision time). Each needed slot must be claimed by a
// different person.
const CLAIMABLE_ROLES: ApproverRoleValue[] = ["COS1", "COS2"];

async function resolveCosPoolUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { email: { in: [...COS_POOL] } } });
  return users.map((u) => u.id);
}

// Resolves the dev-only test identities (see src/app/api/dev/login/route.ts),
// null in production or if either hasn't signed in yet. Scopes the dev
// approver identity to only ever act on the paired dev requester's own
// requests -- COS_POOL membership alone isn't request-scoped, so without
// this a local dev session could claim a real person's pending approval,
// since local dev and production share the same database.
async function resolveDevTestUserIds(): Promise<{ approverId: string; requesterId: string } | null> {
  if (process.env.NODE_ENV === "production") return null;
  const [approver, requester] = await Promise.all([
    prisma.user.findUnique({ where: { email: DEV_TEST_APPROVER_EMAIL } }),
    prisma.user.findUnique({ where: { email: DEV_TEST_REQUESTER_EMAIL } }),
  ]);
  if (!approver || !requester) return null;
  return { approverId: approver.id, requesterId: requester.id };
}

export interface PendingApprovalLineItemView {
  description: string;
  amount: string; // formatted
}

export interface PendingApprovalReceiptView {
  filename: string;
  // Signed URL, computed at render time -- same pattern getDraftRequest
  // uses, so an approver can open/check one against the line-item list
  // before deciding, not just see a count.
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

// Deliberately excludes bank details, per spec 0002 -- an approver needs
// the amount, not the account number. Filtering to request.status:
// "IN_APPROVAL" hides a row once fully approved/rejected via a sibling
// decision.
//
// A COS1/COS2 row is only visible to a request's Ministry Overseer or an
// unclaimed COS_POOL member. Tier 2's COS row also stays hidden until
// Overseer has approved (decideApproval enforces this too); a pool member
// who's already claimed the request's other COS slot doesn't see the
// remaining one either.
export async function getPendingApprovalsForUser(userId: string): Promise<PendingApprovalView[]> {
  const devTestUsers = await resolveDevTestUserIds();
  const isDevApproverIdentity = devTestUsers !== null && userId === devTestUsers.approverId;

  const poolUserIds = await resolveCosPoolUserIds();
  // The dev approver identity's visibility is handled by the scoped
  // branch below instead -- forced false here so it doesn't also pick up
  // the general pool-member OR clause (not request-scoped).
  const isPoolMember = isDevApproverIdentity ? false : poolUserIds.includes(userId);

  const approvals = await prisma.requiredApproval.findMany({
    where: isDevApproverIdentity
      ? {
          status: "PENDING",
          // Every pending role, not just claimable ones -- but only on the
          // paired dev requester's own requests, never a real person's.
          request: { status: "IN_APPROVAL", requesterId: devTestUsers!.requesterId },
        }
      : {
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

    // A requester must never approve their own reimbursement -- being a
    // COS_POOL member only auto-satisfies one slot on their own request
    // (submitRequest); they can't also claim the other, still-open slot.
    if (a.request.requesterId === userId) return false;

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

// isDecided/isFullyApproved and finalizeIfFullyApproved live in
// request-data.ts, not here -- submitRequest needs the exact same check,
// and request-data.ts is the module both files already share, avoiding a
// circular import.

// A single rejection ends the whole chain (spec 0002's rejectReturn
// action). An approval only moves the request to APPROVED once every
// RequiredApproval row is APPROVED. Not wrapped in an interactive
// transaction -- this codebase's proven-safe pattern is plain sequential
// calls (see request-data.ts's top-of-file note).
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

  const devTestUsers = await resolveDevTestUserIds();
  const isDevApproverIdentity = devTestUsers !== null && userId === devTestUsers.approverId;
  // Same scoping as getPendingApprovalsForUser -- the dev approver
  // identity may only decide approvals on the paired dev requester's own
  // requests, even though COS_POOL grants it pool membership database-wide.
  if (isDevApproverIdentity && approval.request.requesterId !== devTestUsers!.requesterId) {
    throw new Error("Approval not found.");
  }
  const isDevApprover = isDevApproverIdentity;

  // COS1/COS2 are claimable, not pre-assigned -- any COS_POOL member can
  // decide a still-unclaimed row (approverUserId null), as long as they
  // haven't already claimed the request's other COS slot. Everything else
  // keeps the exact-match ownership check. The Ministry-Overseer-first
  // gate only applies when an Overseer row exists (tier 3/4 have none) --
  // defensive, since getPendingApprovalsForUser already hides the row
  // until Overseer has approved.
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
    // A requester must never approve their own reimbursement -- pool
    // membership alone doesn't override that, even for a still-open slot
    // submitRequest didn't auto-satisfy.
    if (approval.request.requesterId === userId) {
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
    if (!isDevApprover) {
      throw new Error("Approval not found.");
    }
    // Dev-only: attribute honestly to the dev approver identity rather
    // than silently deciding under the real approver's name.
    claimingUserId = userId;
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
      // comments included here (not just on the RequiredApproval row) so
      // a rejection's reason reads back the same way requestChanges's
      // does -- getDraftRequest sources both from AuditLogEntry uniformly.
      details: { role: approval.role, decision, comments },
    },
  });
}

// Sends the request back to the requester to fix something, rather than
// terminating (REJECTED) or deciding (APPROVED) it. Deliberately
// lightweight -- doesn't touch any RequiredApproval row, including this
// one (left PENDING). The "how do we re-enter approval" logic lives in
// submitRequest instead, which preserves other roles' already-APPROVED
// decisions on resubmission when nothing that matters changed.
export async function requestChanges(approvalId: string, userId: string, comments: string): Promise<void> {
  const approval = await prisma.requiredApproval.findUnique({
    where: { id: approvalId },
    include: { request: true },
  });
  if (!approval || approval.status !== "PENDING" || approval.request.status !== "IN_APPROVAL") {
    throw new Error("Approval not found.");
  }

  // Same dev-approver scoping as decideApproval -- see the comment there.
  const devTestUsers = await resolveDevTestUserIds();
  const isDevApproverIdentity = devTestUsers !== null && userId === devTestUsers.approverId;
  if (isDevApproverIdentity && approval.request.requesterId !== devTestUsers!.requesterId) {
    throw new Error("Approval not found.");
  }
  const isDevApprover = isDevApproverIdentity;

  // Same claimable-role ownership check as decideApproval, minus the
  // claiming itself -- any COS_POOL member can request changes on a
  // still-unclaimed slot without claiming it.
  if (CLAIMABLE_ROLES.includes(approval.role) && approval.approverUserId === null) {
    const poolUserIds = await resolveCosPoolUserIds();
    if (!poolUserIds.includes(userId) || approval.request.requesterId === userId) {
      throw new Error("Approval not found.");
    }
  } else if (approval.approverUserId !== userId && !isDevApprover) {
    throw new Error("Approval not found.");
  }

  await prisma.reimbursementRequest.update({
    where: { id: approval.reimbursementRequestId },
    data: { status: "NEEDS_CLARIFICATION" },
  });

  // The durable record of why -- getDraftRequest reads this back to show
  // the requester, since the RequiredApproval row is left untouched.
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: approval.reimbursementRequestId,
      actorUserId: userId,
      action: "CHANGES_REQUESTED",
      details: { role: approval.role, comments },
    },
  });
}

// The designated confirmer's explicit "within budget" confirmation -- the
// alternative to waiting on direct Regional Director approval for a
// tier-4 request (approval-routing.ts's
// REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL). Requires COS1+COS2 to both
// already be APPROVED, matching the decision-maker's "only once Regional
// Director's been pending a week or more" framing. Doesn't touch the
// REGIONAL_DIRECTOR row itself -- the two paths are alternatives, not a
// cancellation of one by the other.
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
  if (!cos1 || !isDecided(cos1.status) || !cos2 || !isDecided(cos2.status)) {
    throw new Error("Both COS approvals are required before confirming.");
  }
  const confirmer = await prisma.user.findUnique({
    where: { email: REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL },
  });
  if (!confirmer || confirmer.id !== userId) {
    throw new Error("Only the designated confirmer can confirm this.");
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

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Follow-up to submitRequest's day-0 notification -- a role still PENDING
// gets nudged again at 2/5/7 days since pendingSinceAt (Vercel Cron). An
// unclaimed COS1/COS2 slot goes to the whole COS_POOL, same as day-0.
export async function sendPendingApprovalReminders(): Promise<{ sent: number; candidateCount: number }> {
  const candidates = await prisma.requiredApproval.findMany({
    where: { status: "PENDING", pendingSinceAt: { not: null } },
    include: { request: { include: { requester: true } } },
  });

  const now = Date.now();
  let sent = 0;
  for (const a of candidates) {
    const staleSinceMs = now - a.pendingSinceAt!.getTime();
    let tier: 2 | 5 | 7 | null = null;
    if (staleSinceMs >= SEVEN_DAYS_MS && !a.reminder7DaySentAt) {
      tier = 7;
    } else if (staleSinceMs >= FIVE_DAYS_MS && !a.reminder5DaySentAt) {
      tier = 5;
    } else if (staleSinceMs >= TWO_DAYS_MS && !a.reminder2DaySentAt) {
      tier = 2;
    }
    if (!tier) continue;

    const to = CLAIMABLE_ROLES.includes(a.role)
      ? [...COS_POOL]
      : a.approverUserId
        ? [(await prisma.user.findUnique({ where: { id: a.approverUserId } }))?.email].filter(
            (e): e is string => e != null,
          )
        : [];
    if (to.length === 0) continue;

    try {
      await sendPendingApprovalReminderEmail(to, {
        voucherNo: a.request.voucherNo,
        requestType: a.request.requestType,
        ministryType: a.request.ministryType,
        totalAmount: formatAmount(a.request.totalAmount),
        requesterName: a.request.requester.name,
        roleLabel: getApproverRoleLabel(a.role, a.request.ministryType),
        daysPending: tier,
      });
      await prisma.requiredApproval.update({
        where: { id: a.id },
        data:
          tier === 7
            ? { reminder7DaySentAt: new Date(), reminder5DaySentAt: new Date(), reminder2DaySentAt: new Date() }
            : tier === 5
              ? { reminder5DaySentAt: new Date(), reminder2DaySentAt: new Date() }
              : { reminder2DaySentAt: new Date() },
      });
      sent++;
    } catch {
      // Per ADR 0001, a delivery failure here shouldn't crash the run --
      // this tier's sent-at field stays unset, so it's retried next time.
    }
  }
  return { sent, candidateCount: candidates.length };
}

