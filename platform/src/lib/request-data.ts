import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getReceiptDownloadUrl, deleteReceipt } from "@/lib/receipt-storage";
import { normalizeBsb, formatBsb, assertValidAccountNumber } from "@/lib/bank-details";
import {
  sendApprovedRequestEmail,
  sendStaleDraftReminderEmail,
  sendNewApprovalNotificationEmail,
} from "@/lib/notifications";
import {
  assertValidSignatureImage,
  buildSignatureStorageKey,
  uploadSignature,
  deleteSignature,
} from "@/lib/signature-storage";
import {
  getTier,
  getRequiredApproverRoles,
  APPROVER_ROLES,
  REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL,
  COS_POOL,
  CLAIMABLE_ROLES,
  getApproverRoleLabel,
} from "@/lib/approval-routing";
import type { ApproverRoleValue, ApprovalTier } from "@/lib/approval-routing";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";
import { MINISTRY_TYPES } from "@/lib/request-types";

// Uses array-form prisma.$transaction([...]) throughout, not the
// interactive prisma.$transaction(async (tx) => {...}) callback form. In
// this exact stack (Prisma 7 + @prisma/adapter-pg + Next.js dev server,
// tested against Neon), a second interactive transaction issued shortly
// after a first one silently failed to persist its writes -- no thrown
// error, no log -- while array-form transactions did not exhibit this.
// Root cause not fully isolated; array-form is the proven-safe pattern here.

export interface DraftLineItemView {
  id: string;
  description: string;
  amount: string; // formatted, e.g. "245.80"
}

export interface DraftReceiptView {
  id: string;
  filename: string; // derived from storageKey for display
  uploadedAt: string; // ISO date
  // Signed URL, computed at render time and expiring after a few minutes.
  // A plain <a href> avoids popup-blocker/timing issues from fetching on
  // click -- an expired link just needs a page reload.
  viewUrl: string;
  // Set together, only when OCR found both a merchant and a valid amount
  // at upload time; null covers both "not scanned yet" and "nothing
  // usable found," which the UI renders identically as "add manually".
  extractedMerchant: string | null;
  extractedItem: string | null;
  extractedAmount: string | null; // formatted
  scannedAt: string | null; // ISO date
}

export interface DraftBankDetailsView {
  accountName: string;
  bsb: string; // formatted, e.g. "123-456"
  accountNumber: string;
}

// Covers both ways a request can bounce back to its requester -- rejected
// or sent back for changes. Both are resubmittable the same way (see
// submitRequest).
export interface ReturnReasonView {
  actorName: string;
  role: string;
  comments: string;
  decision: "REJECTED" | "CHANGES_REQUESTED";
  returnedAt: string; // ISO date
}

export interface DraftRequestView {
  id: string;
  voucherNo: string;
  requesterName: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  lineItems: DraftLineItemView[];
  receipts: DraftReceiptView[];
  bankDetails: DraftBankDetailsView | null;
  // Set only when status is NEEDS_CLARIFICATION or REJECTED_RETURNED -- who
  // sent it back and why, read from the AuditLogEntry for that decision
  // rather than the RequiredApproval row's own comments field.
  returnReason: ReturnReasonView | null;
}

export interface ApprovedRequestDetailLineItem {
  description: string;
  amount: string; // formatted
}

export interface ApprovedRequestDetailApproval {
  role: ApproverRoleValue;
  status: string;
  approverName: string | null;
  decidedAt: string | null; // ISO date
  signatureStorageKey: string | null;
}

// One row per MinistryType, current Overseer. Reflects *today's*
// ApproverAssignment data, not who was assigned when this request was
// submitted -- a "who to contact now" directory, distinct from the
// historical `approvals` record above. Excludes COS1 and the two org-wide
// roles (Finance Overseer/Regional Director), which already appear in
// that Approval row for tiers that require them.
export interface ApproverDirectoryMinistryEntry {
  ministryType: MinistryTypeValue;
  overseerName: string | null;
}

export type ApproverDirectory = ApproverDirectoryMinistryEntry[];

export interface ApprovedRequestDetail {
  id: string;
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  tier: ApprovalTier;
  submittedAt: string; // ISO date -- the voucher's "DATE" field
  requesterName: string;
  requesterEmail: string;
  lineItems: ApprovedRequestDetailLineItem[];
  bankDetails: { accountName: string; bsb: string; accountNumber: string };
  receipts: { storageKey: string; filename: string }[];
  approvals: ApprovedRequestDetailApproval[];
  approverDirectory: ApproverDirectory;
  // Set only when this reached APPROVED via the designated confirmer's
  // "within budget" confirmation instead of a direct Regional Director
  // decision -- approval-data.ts's confirmRegionalDirectorOverride/isFullyApproved.
  regionalDirectorOverrideConfirmedAt: string | null; // ISO date
  // R2 object key for the requester's own signature, captured at submit
  // time. Always set once a request reaches APPROVED (submitRequest
  // requires it), but typed nullable since this field predates that
  // requirement.
  requesterSignatureStorageKey: string | null;
}

export interface RequestListItemView {
  id: string;
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  status: string;
  createdAt: string; // ISO date
}

// storageKey is "receipts/{requestId}/{uuid}-{safeName}" (buildReceiptStorageKey
// in receipt-storage.ts) -- strip the folder and UUID prefix for display.
export function receiptFilename(storageKey: string): string {
  const base = storageKey.split("/").pop() ?? storageKey;
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, "");
}

async function nextVoucherNo(): Promise<string> {
  // Atomic, database-backed sequence -- spec 0002 requires collision
  // resistance under concurrent submissions, not Math.random(). Sequences
  // advance non-transactionally by design, so no transaction is needed
  // just to read one.
  const rows =
    await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('voucher_no_seq') AS nextval`;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  // Prefix is "CCF-" (was "DV-") with a full YYYYMMDD date component
  // (changed 2026-09-02); the underlying sequence is still one org-wide
  // running number, not reset daily. Existing "DV-2026-####" vouchers
  // keep their original numbers.
  return `CCF-${yyyy}${mm}${dd}-${rows[0].nextval.toString().padStart(4, "0")}`;
}

export async function createDraftRequest(
  requesterId: string,
  requestType: RequestTypeValue,
  ministryType: MinistryTypeValue,
): Promise<{ id: string; voucherNo: string; requesterName: string }> {
  const voucherNo = await nextVoucherNo();
  // Each op is independent, so array-form transaction is safe. The
  // requester lookup rides along here so the wizard's Review step can show
  // "Requester: <name>" without its own round-trip.
  const [request, requester] = await prisma.$transaction([
    prisma.reimbursementRequest.create({
      data: {
        voucherNo,
        requestType,
        ministryType,
        requesterId,
        totalAmount: 0,
        status: "DRAFT",
      },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: requesterId } }),
  ]);
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: request.id,
      actorUserId: requesterId,
      action: "DRAFT_CREATED",
      details: { requestType, ministryType },
    },
  });
  return { id: request.id, voucherNo: request.voucherNo, requesterName: requester.name };
}

// Editable by its own requester only in DRAFT, NEEDS_CLARIFICATION, or
// REJECTED_RETURNED -- the latter two are both resubmittable the same way
// (see submitRequest). Every other status is mid- or post-approval, where
// spec 0001's "no silent edits" control applies.
const EDITABLE_STATUSES = ["DRAFT", "NEEDS_CLARIFICATION", "REJECTED_RETURNED"] as const;

function isEditableStatus(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

export async function assertRequestIsEditable(requestId: string, requesterId: string): Promise<void> {
  const request = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId, status: { in: [...EDITABLE_STATUSES] } },
  });
  if (!request) {
    throw new Error("Request not found.");
  }
}

// Scoped to the requester's own editable requests only -- can't see/edit
// someone else's, and can't edit outside DRAFT/NEEDS_CLARIFICATION/
// REJECTED_RETURNED, per spec 0001's "no silent edits" control.
export async function getDraftRequest(
  id: string,
  requesterId: string,
): Promise<DraftRequestView | null> {
  const r = await prisma.reimbursementRequest.findFirst({
    where: { id, requesterId, status: { in: [...EDITABLE_STATUSES] } },
    include: { lineItems: true, receipts: true, bankDetails: true, requester: true },
  });
  if (!r) return null;
  const receipts = await Promise.all(
    r.receipts.map(async (rec) => ({
      id: rec.id,
      filename: receiptFilename(rec.storageKey),
      uploadedAt: rec.uploadedAt.toISOString(),
      viewUrl: await getReceiptDownloadUrl(rec.storageKey),
      extractedMerchant: rec.extractedMerchant,
      extractedItem: rec.extractedItem,
      extractedAmount: rec.extractedAmount ? formatAmount(rec.extractedAmount) : null,
      scannedAt: rec.scannedAt ? rec.scannedAt.toISOString() : null,
    })),
  );
  let returnReason: ReturnReasonView | null = null;
  if (r.status === "NEEDS_CLARIFICATION" || r.status === "REJECTED_RETURNED") {
    // Whichever action caused the *current* status is necessarily the most
    // recent one of its kind -- a request can't return to IN_APPROVAL for
    // more decisions until the next resubmission, at which point it's no
    // longer in either status.
    const action = r.status === "NEEDS_CLARIFICATION" ? "CHANGES_REQUESTED" : "APPROVAL_DECIDED";
    const entry = await prisma.auditLogEntry.findFirst({
      where: { reimbursementRequestId: id, action },
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    });
    if (entry) {
      const details = entry.details as { role: string; comments: string } | null;
      returnReason = {
        actorName: entry.actor.name,
        role: details?.role ?? "",
        comments: details?.comments ?? "",
        decision: r.status === "NEEDS_CLARIFICATION" ? "CHANGES_REQUESTED" : "REJECTED",
        returnedAt: entry.createdAt.toISOString(),
      };
    }
  }
  return {
    id: r.id,
    voucherNo: r.voucherNo,
    requesterName: r.requester.name,
    requestType: r.requestType,
    ministryType: r.ministryType,
    totalAmount: formatAmount(r.totalAmount),
    lineItems: r.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      amount: formatAmount(li.amount),
    })),
    receipts,
    bankDetails: r.bankDetails
      ? {
          accountName: r.bankDetails.accountName,
          bsb: formatBsb(r.bankDetails.bsb),
          accountNumber: r.bankDetails.accountNumber,
        }
      : null,
    returnReason,
  };
}

const STALE_EMPTY_DRAFT_AGE_MS = 60 * 60 * 1000; // 1 hour

// Deletes every empty, abandoned DRAFT system-wide -- covers a browser
// crash or tab close before RequestDrawer.tsx's normal close-time cleanup
// runs. Run periodically by Vercel Cron rather than inline on the
// request-serving path -- an earlier per-requester version added a real
// database round-trip to every action just to catch a handful of rows.
export async function cleanupStaleEmptyDrafts(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_EMPTY_DRAFT_AGE_MS);
  const candidates = await prisma.reimbursementRequest.findMany({
    where: { status: "DRAFT", createdAt: { lt: cutoff } },
    include: { _count: { select: { lineItems: true } } },
  });
  const stale = candidates.filter((r) => r._count.lineItems === 0);
  await Promise.all(
    stale.map(async (r) => {
      const { receiptStorageKeys, signatureStorageKeys } = await deleteDraftRequest(r.id, r.requesterId);
      await Promise.all([
        ...receiptStorageKeys.map((key) => deleteReceipt(key)),
        ...signatureStorageKeys.map((key) => deleteSignature(key)),
      ]);
    }),
  );
  return stale.length;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Nudges a requester about a non-empty DRAFT gone quiet (run periodically
// by Vercel Cron). "Touched" is the max of the request's own updatedAt
// plus its bank details' and receipts' timestamps, since those don't bump
// the request row itself.
export async function sendStaleDraftReminders(): Promise<{ sent: number; candidateCount: number }> {
  const candidates = await prisma.reimbursementRequest.findMany({
    where: { status: "DRAFT", lineItems: { some: {} } },
    include: {
      requester: true,
      bankDetails: { select: { updatedAt: true } },
      receipts: { select: { uploadedAt: true } },
    },
  });

  const now = Date.now();
  let sent = 0;
  for (const r of candidates) {
    const timestamps = [r.updatedAt, r.bankDetails?.updatedAt, ...r.receipts.map((rec) => rec.uploadedAt)].filter(
      (d): d is Date => d != null,
    );
    const lastTouchedAt = Math.max(...timestamps.map((d) => d.getTime()));
    const staleSinceMs = now - lastTouchedAt;

    let tier: 3 | 7 | null = null;
    if (staleSinceMs >= SEVEN_DAYS_MS && !r.staleReminder7DaySentAt) {
      tier = 7;
    } else if (staleSinceMs >= THREE_DAYS_MS && !r.staleReminder3DaySentAt) {
      tier = 3;
    }
    if (!tier) continue;

    try {
      await sendStaleDraftReminderEmail(r.requester.email, {
        voucherNo: r.voucherNo,
        requestType: r.requestType,
        ministryType: r.ministryType,
        totalAmount: formatAmount(r.totalAmount),
        daysStale: tier,
      });
      await prisma.reimbursementRequest.update({
        where: { id: r.id },
        data:
          tier === 7
            ? { staleReminder7DaySentAt: new Date(), staleReminder3DaySentAt: new Date() }
            : { staleReminder3DaySentAt: new Date() },
      });
      sent++;
    } catch {
      // Per ADR 0001, a delivery failure here shouldn't crash the run --
      // this candidate's sent-at field stays unset, so it's retried next time.
    }
  }
  return { sent, candidateCount: candidates.length };
}

// All statuses (not DRAFT-only like getDraftRequest) -- this is the
// requester's own landing page, listing everything they've ever created.
export async function getMyRequests(requesterId: string): Promise<RequestListItemView[]> {
  const requests = await prisma.reimbursementRequest.findMany({
    where: { requesterId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lineItems: true } } },
  });
  // A brand-new draft (created before its first line item) isn't "real"
  // yet -- handleDialogClose auto-deletes this exact state if the wizard
  // closes without adding anything, so hiding it here means it never
  // appears only to vanish moments later.
  return requests
    .filter((r) => !(r.status === "DRAFT" && r._count.lineItems === 0))
    .map((r) => ({
      id: r.id,
      voucherNo: r.voucherNo,
      requestType: r.requestType,
      ministryType: r.ministryType,
      totalAmount: formatAmount(r.totalAmount),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
}

export async function updateDraftRequestDetails(
  requestId: string,
  requesterId: string,
  requestType: RequestTypeValue,
  ministryType: MinistryTypeValue,
): Promise<void> {
  await assertRequestIsEditable(requestId, requesterId);
  await prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { requestType, ministryType },
  });
}

// Deletes the request row; LineItem/Receipt/BankDetails/RequiredApproval/
// AuditLogEntry all cascade via the schema. Returns receipt/signature
// storage keys first since R2 isn't part of a Postgres cascade -- a
// request reachable here can already have signed RequiredApproval rows
// (e.g. one approver approved before another rejected), so this isn't
// DRAFT-only.
export async function deleteDraftRequest(
  requestId: string,
  requesterId: string,
): Promise<{ receiptStorageKeys: string[]; signatureStorageKeys: string[] }> {
  await assertRequestIsEditable(requestId, requesterId);
  const [receipts, approvals] = await Promise.all([
    prisma.receipt.findMany({ where: { reimbursementRequestId: requestId } }),
    prisma.requiredApproval.findMany({ where: { reimbursementRequestId: requestId } }),
  ]);
  await prisma.reimbursementRequest.delete({ where: { id: requestId } });
  return {
    receiptStorageKeys: receipts.map((r) => r.storageKey),
    signatureStorageKeys: approvals
      .map((a) => a.signatureStorageKey)
      .filter((key): key is string => key !== null),
  };
}

// COS1/COS2 are never resolved here -- they're claimable positions
// (approval-routing.ts's COS_POOL), created with approverUserId null and
// claimed at decision time. FINANCE_OVERSEER/REGIONAL_DIRECTOR are
// assigned org-wide (ministryType null); MINISTRY_OVERSEER per the
// request's own ministry.
const ORG_WIDE_ROLES = new Set(["FINANCE_OVERSEER", "REGIONAL_DIRECTOR"]);

async function resolveApprover(
  role: ApproverRoleValue,
  ministryType: MinistryTypeValue,
): Promise<string | null> {
  if (role === "COS1" || role === "COS2") return null;
  const assignment = await prisma.approverAssignment.findFirst({
    where: ORG_WIDE_ROLES.has(role) ? { role, ministryType: null } : { role, ministryType },
  });
  return assignment?.userId ?? null;
}

async function isCosPoolMember(userId: string): Promise<boolean> {
  const poolUsers = await prisma.user.findMany({ where: { email: { in: [...COS_POOL] } } });
  return poolUsers.some((u) => u.id === userId);
}

// The audit-trail explanation for an AUTO_SATISFIED row: a requester must
// never approve their own reimbursement, but where policy designates them
// as the required approver for a tier, that tier auto-satisfies instead
// of asking them to click through their own approval.
function autoSatisfyReason(role: ApproverRoleValue, ministryType: MinistryTypeValue): string {
  if (role === "COS1" || role === "COS2") {
    return "Auto-satisfied: requester is a member of the COS approval pool.";
  }
  return `Auto-satisfied: requester is the designated ${getApproverRoleLabel(role, ministryType)} for this request.`;
}

// A row satisfies its tier either by a real APPROVED decision or by
// AUTO_SATISFIED, when the requester held the required role and it was
// satisfied at submit time instead.
export function isDecided(status: string): boolean {
  return status === "APPROVED" || status === "AUTO_SATISFIED";
}

// A tier-4 REGIONAL_DIRECTOR row satisfies either by direct decision or by
// regionalDirectorOverrideConfirmedAt (the designated confirmer's "within
// budget" confirmation, gated on COS1+COS2 both decided by
// confirmRegionalDirectorOverride and not re-checked here). Every other
// role still needs isDecided.
function isFullyApproved(
  requiredApprovals: { role: string; status: string }[],
  regionalDirectorOverrideConfirmedAt: Date | null,
): boolean {
  const nonRegional = requiredApprovals.filter((a) => a.role !== "REGIONAL_DIRECTOR");
  if (!nonRegional.every((a) => isDecided(a.status))) return false;
  const regional = requiredApprovals.find((a) => a.role === "REGIONAL_DIRECTOR");
  if (!regional) return true; // tier < 4, no such row exists at all
  return isDecided(regional.status) || regionalDirectorOverrideConfirmedAt !== null;
}

// Three places can newly complete a request: decideApproval("APPROVED"),
// confirmRegionalDirectorOverride, and submitRequest itself (a request can
// complete immediately if every tier turns out AUTO_SATISFIED). All three
// call this shared finalize-and-notify logic rather than duplicating it;
// it lives here since both approval-data.ts and submitRequest need it.
export async function finalizeIfFullyApproved(requestId: string): Promise<void> {
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
  // approval decision it's reporting on.
  try {
    const detail = await getApprovedRequestDetail(requestId);
    if (detail) {
      await sendApprovedRequestEmail(detail);
    }
  } catch (err) {
    console.error("Failed to send approved-request notification:", err);
  }
}

// DRAFT -> IN_APPROVAL: generates one RequiredApproval row per role the
// confirmed tier requires, going straight to IN_APPROVAL (not SUBMITTED,
// which would be a distinctionless label) since the rows are created in
// this same atomic step. Serves both first submission (DRAFT) and
// resubmission after changes are requested (NEEDS_CLARIFICATION) --
// resubmission preserves already-decided approvals unless the recomputed
// tier/role set or a role's resolved approver changed, in which case it
// falls back to a full reset since the old approvals can't be trusted
// against the new tier/ministry.
export async function submitRequest(
  requestId: string,
  requesterId: string,
  signatureBuffer: Buffer,
): Promise<void> {
  const request = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId, status: { in: [...EDITABLE_STATUSES] } },
    include: { lineItems: true, bankDetails: true, receipts: true, requiredApprovals: true, requester: true },
  });
  if (!request) {
    throw new Error("Request not found.");
  }
  if (request.lineItems.length === 0) {
    throw new Error("Add at least one item before submitting.");
  }
  if (!request.bankDetails) {
    throw new Error("Add bank details before submitting.");
  }
  // Cash advances are requested before the money's spent -- there's
  // nothing to attach a receipt for yet, unlike every other request type.
  if (request.requestType !== "CASH_ADVANCE" && request.receipts.length === 0) {
    throw new Error("Attach at least one receipt before submitting.");
  }
  assertValidSignatureImage(signatureBuffer);

  // Uploaded before the transaction below -- if this throws, nothing else
  // changes. The previous signature key is deleted only after the
  // transaction commits, so a mid-transaction failure never orphan-deletes
  // a still-valid one.
  const signatureStorageKey = buildSignatureStorageKey(requestId);
  await uploadSignature(signatureStorageKey, signatureBuffer);
  const previousSignatureStorageKey = request.requesterSignatureStorageKey;

  const isResubmission = request.status === "NEEDS_CLARIFICATION" || request.status === "REJECTED_RETURNED";
  const tier = getTier(Number(request.totalAmount));
  const roles = getRequiredApproverRoles(tier);
  const approverUserIds = await Promise.all(
    roles.map((role) => resolveApprover(role, request.ministryType)),
  );

  // COS1/COS2 are claimable, not pre-resolved -- comparing approverUserId
  // for those would always mismatch once claimed, forcing a needless
  // reset. "Preserved" for a claimable role just means it's still in the
  // recomputed role set.
  const existingByRole = new Map(request.requiredApprovals.map((a) => [a.role, a]));
  const canPreserve =
    existingByRole.size === roles.length &&
    roles.every((role, i) => {
      const existing = existingByRole.get(role);
      if (!existing) return false;
      if (CLAIMABLE_ROLES.has(role)) return true;
      return existing.approverUserId === approverUserIds[i];
    });

  // Auto-satisfy: a requester must never approve their own reimbursement,
  // but where policy designates them as the required approver, that tier
  // auto-satisfies instead. COS1/COS2 are a pool, not one person -- pool
  // membership only auto-satisfies one of the two slots a tier-3/4 request
  // needs (cosAutoSatisfyUsed ensures only the first COS role is ever
  // auto-satisfied).
  const requesterIsCosPoolMember = await isCosPoolMember(requesterId);
  let cosAutoSatisfyUsed = false;
  const autoSatisfied = roles.map((role, i) => {
    if (CLAIMABLE_ROLES.has(role)) {
      if (requesterIsCosPoolMember && !cosAutoSatisfyUsed) {
        cosAutoSatisfyUsed = true;
        return true;
      }
      return false;
    }
    return approverUserIds[i] === requesterId;
  });

  const requestUpdate = prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { status: "IN_APPROVAL", submittedAt: new Date(), requesterSignatureStorageKey: signatureStorageKey },
  });

  // Rows needing a fresh "approval needed" email once this transaction
  // commits -- a row already PENDING before a preserved resubmission is
  // skipped since nothing changed, but a reopened REJECTED row counts.
  const newlyPendingRoles: { role: ApproverRoleValue; approverUserId: string | null }[] = [];

  if (canPreserve) {
    // Only rows not already APPROVED/AUTO_SATISFIED get reset. A
    // previously REJECTED claimable row also has its claim cleared, so
    // it's genuinely open to any pool member again, not silently
    // re-offered to whoever declined it last.
    const rowsToReset = request.requiredApprovals.filter(
      (a) => a.status !== "APPROVED" && a.status !== "AUTO_SATISFIED",
    );
    for (const a of rowsToReset) {
      if (a.status === "REJECTED") {
        newlyPendingRoles.push({
          role: a.role,
          approverUserId: CLAIMABLE_ROLES.has(a.role) ? null : a.approverUserId,
        });
      }
    }
    await prisma.$transaction([
      ...rowsToReset.map((a) =>
        prisma.requiredApproval.update({
          where: { id: a.id },
          data: {
            status: "PENDING",
            decidedAt: null,
            comments: null,
            signatureStorageKey: null,
            approverUserId: CLAIMABLE_ROLES.has(a.role) ? null : a.approverUserId,
            pendingSinceAt: new Date(),
            reminder2DaySentAt: null,
            reminder5DaySentAt: null,
            reminder7DaySentAt: null,
          },
        }),
      ),
      requestUpdate,
    ]);
  } else {
    roles.forEach((role, i) => {
      if (!autoSatisfied[i]) newlyPendingRoles.push({ role, approverUserId: approverUserIds[i] });
    });
    await prisma.$transaction([
      prisma.requiredApproval.deleteMany({ where: { reimbursementRequestId: requestId } }),
      ...roles.map((role, i) =>
        prisma.requiredApproval.create({
          data: {
            reimbursementRequestId: requestId,
            role,
            status: autoSatisfied[i] ? "AUTO_SATISFIED" : "PENDING",
            approverUserId: autoSatisfied[i] ? requesterId : approverUserIds[i],
            decidedAt: autoSatisfied[i] ? new Date() : null,
            comments: autoSatisfied[i] ? autoSatisfyReason(role, request.ministryType) : null,
            pendingSinceAt: autoSatisfied[i] ? null : new Date(),
          },
        }),
      ),
      // A stale Regional Director override confirmation can't be trusted
      // for a materially different request, same as the reset above.
      prisma.reimbursementRequest.update({
        where: { id: requestId },
        data: {
          status: "IN_APPROVAL",
          submittedAt: new Date(),
          regionalDirectorOverrideConfirmedAt: null,
          requesterSignatureStorageKey: signatureStorageKey,
        },
      }),
    ]);
  }

  // Covers the edge case where every required tier turned out
  // AUTO_SATISFIED (e.g. a tier-1 request self-submitted by its own
  // Ministry Overseer) -- without this it would sit at IN_APPROVAL forever
  // with no PENDING row for anyone to decide.
  await finalizeIfFullyApproved(requestId);

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: requestId,
      actorUserId: requesterId,
      action: isResubmission ? "RESUBMITTED" : "SUBMITTED",
      details: { tier, requiredRoles: roles, preservedPriorApprovals: canPreserve },
    },
  });

  if (previousSignatureStorageKey) {
    await deleteSignature(previousSignatureStorageKey);
  }

  // Day-0 "approval needed" email per newlyPendingRoles entry, caught
  // independently per ADR 0001 -- a missed send still gets a chance via
  // the 2/5/7-day reminders in approval-data.ts.
  if (newlyPendingRoles.length > 0) {
    const nonClaimableUserIds = newlyPendingRoles
      .map((r) => r.approverUserId)
      .filter((id): id is string => id !== null);
    const approverUsers =
      nonClaimableUserIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: nonClaimableUserIds } } })
        : [];
    const emailByUserId = new Map(approverUsers.map((u) => [u.id, u.email]));

    for (const { role, approverUserId } of newlyPendingRoles) {
      const to = CLAIMABLE_ROLES.has(role)
        ? [...COS_POOL]
        : approverUserId && emailByUserId.has(approverUserId)
          ? [emailByUserId.get(approverUserId)!]
          : [];
      if (to.length === 0) continue;
      try {
        await sendNewApprovalNotificationEmail(to, {
          voucherNo: request.voucherNo,
          requestType: request.requestType,
          ministryType: request.ministryType,
          totalAmount: formatAmount(request.totalAmount),
          requesterName: request.requester.name,
          roleLabel: getApproverRoleLabel(role, request.ministryType),
        });
      } catch {
        // See the ADR 0001 comment above.
      }
    }
  }
}

// Everything the approved-request voucher/notification needs, fetched once
// right after APPROVED -- by then every RequiredApproval row is decided
// and nothing editable can have changed, so this is already exactly the
// approved data, not a live view. Returns null only if bank details are
// missing, which submitRequest guarantees can't happen -- a data-integrity
// signal, not an expected case.
export async function getApprovedRequestDetail(
  requestId: string,
): Promise<ApprovedRequestDetail | null> {
  const r = await prisma.reimbursementRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: true,
      lineItems: true,
      receipts: true,
      bankDetails: true,
      requiredApprovals: { include: { approver: true } },
    },
  });
  if (!r || !r.bankDetails) return null;
  const bankDetails = r.bankDetails;
  const approverDirectory = await getApproverDirectory();
  return {
    id: r.id,
    voucherNo: r.voucherNo,
    requestType: r.requestType,
    ministryType: r.ministryType,
    totalAmount: formatAmount(r.totalAmount),
    tier: getTier(Number(r.totalAmount)),
    submittedAt: (r.submittedAt ?? r.createdAt).toISOString(),
    requesterName: r.requester.name,
    requesterEmail: r.requester.email,
    lineItems: r.lineItems.map((li) => ({
      description: li.description,
      amount: formatAmount(li.amount),
    })),
    bankDetails: {
      accountName: bankDetails.accountName,
      bsb: formatBsb(bankDetails.bsb),
      accountNumber: bankDetails.accountNumber,
    },
    receipts: r.receipts.map((rec) => ({
      storageKey: rec.storageKey,
      filename: receiptFilename(rec.storageKey),
    })),
    approvals: r.requiredApprovals
      .slice()
      .sort((a, b) => APPROVER_ROLES.indexOf(a.role) - APPROVER_ROLES.indexOf(b.role))
      .map((a) => ({
        role: a.role,
        status: a.status,
        approverName: a.approver?.name ?? null,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        signatureStorageKey: a.signatureStorageKey,
      })),
    approverDirectory,
    regionalDirectorOverrideConfirmedAt: r.regionalDirectorOverrideConfirmedAt
      ? r.regionalDirectorOverrideConfirmedAt.toISOString()
      : null,
    requesterSignatureStorageKey: r.requesterSignatureStorageKey,
  };
}

// Live "who approves what" reference for the voucher's printed directory
// -- re-queried fresh each time (unlike RequiredApproval.approverUserId,
// resolved once at submission), since its job is telling Finance who to
// contact today, not who was assigned at submission time.
export async function getApproverDirectory(): Promise<ApproverDirectory> {
  const assignments = await prisma.approverAssignment.findMany({
    where: { role: "MINISTRY_OVERSEER" },
    include: { user: true },
  });
  const overseerByMinistry = new Map(
    assignments.filter((a) => a.ministryType).map((a) => [a.ministryType as MinistryTypeValue, a.user.name]),
  );

  return MINISTRY_TYPES.map((ministryType) => ({
    ministryType,
    overseerName: overseerByMinistry.get(ministryType) ?? null,
  }));
}

// A single upsert, not separate add/remove, since BankDetails is 1:1 --
// re-saving replaces the previous values. The audit trail records that a
// change happened, never the account number/BSB itself.
export async function upsertBankDetails(
  requestId: string,
  requesterId: string,
  accountName: string,
  bsbRaw: string,
  accountNumber: string,
): Promise<void> {
  await assertRequestIsEditable(requestId, requesterId);
  const bsb = normalizeBsb(bsbRaw);
  assertValidAccountNumber(accountNumber);
  await prisma.bankDetails.upsert({
    where: { reimbursementRequestId: requestId },
    create: { reimbursementRequestId: requestId, accountName, bsb, accountNumber },
    update: { accountName, bsb, accountNumber },
  });
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: requestId,
      actorUserId: requesterId,
      action: "BANK_DETAILS_UPDATED",
    },
  });
}

export async function addLineItem(
  requestId: string,
  requesterId: string,
  description: string,
  amount: number,
): Promise<void> {
  // Read-then-write guard done as a plain read first, keeping each
  // transaction member below an independent op.
  await assertRequestIsEditable(requestId, requesterId);
  // Atomic increment, not a re-fetch-and-sum, so both ops stay independent
  // and safe as an array transaction.
  await prisma.$transaction([
    prisma.lineItem.create({
      data: { reimbursementRequestId: requestId, description, amount },
    }),
    prisma.reimbursementRequest.update({
      where: { id: requestId },
      data: { totalAmount: { increment: amount } },
    }),
  ]);
}

export async function removeLineItem(lineItemId: string, requesterId: string): Promise<void> {
  const lineItem = await prisma.lineItem.findUnique({
    where: { id: lineItemId },
    include: { request: true },
  });
  if (
    !lineItem ||
    lineItem.request.requesterId !== requesterId ||
    !isEditableStatus(lineItem.request.status)
  ) {
    throw new Error("Item not found.");
  }
  await prisma.$transaction([
    prisma.lineItem.delete({ where: { id: lineItemId } }),
    prisma.reimbursementRequest.update({
      where: { id: lineItem.reimbursementRequestId },
      data: { totalAmount: { decrement: lineItem.amount } },
    }),
  ]);
}

// Edits an existing line item in place -- the fix for an auto-scanned
// "<merchant> | <item>" description OCR got wrong, common enough that
// remove-and-re-add alone wasn't sufficient. totalAmount is adjusted by
// the delta rather than re-derived, same reasoning as add/removeLineItem.
export async function updateLineItem(
  lineItemId: string,
  requesterId: string,
  description: string,
  amount: number,
): Promise<void> {
  const lineItem = await prisma.lineItem.findUnique({
    where: { id: lineItemId },
    include: { request: true },
  });
  if (
    !lineItem ||
    lineItem.request.requesterId !== requesterId ||
    !isEditableStatus(lineItem.request.status)
  ) {
    throw new Error("Item not found.");
  }
  const delta = amount - Number(lineItem.amount);
  await prisma.$transaction([
    prisma.lineItem.update({
      where: { id: lineItemId },
      data: { description, amount },
    }),
    prisma.reimbursementRequest.update({
      where: { id: lineItem.reimbursementRequestId },
      data: { totalAmount: { increment: delta } },
    }),
  ]);
}

// The actual R2 upload happens separately (receipt-storage.ts) -- this
// only records the resulting storageKey. `extraction` is set only when
// OCR found both a merchant and a valid amount at upload; omitted/null
// leaves the extracted* columns null, rendered as "add manually".
export async function addReceiptRecord(
  requestId: string,
  requesterId: string,
  storageKey: string,
  extraction?: { merchant: string; amount: number; item: string | null } | null,
): Promise<{ id: string }> {
  await assertRequestIsEditable(requestId, requesterId);
  const receipt = await prisma.receipt.create({
    data: {
      reimbursementRequestId: requestId,
      storageKey,
      extractedMerchant: extraction?.merchant ?? null,
      extractedItem: extraction?.item ?? null,
      extractedAmount: extraction?.amount ?? null,
      scannedAt: extraction ? new Date() : null,
    },
  });
  return { id: receipt.id };
}

// Ownership check only, not status-gated like the mutating receipt
// functions -- used to fetch the file for read-only scanning.
export async function getReceiptStorageKeyForOwner(
  receiptId: string,
  requesterId: string,
): Promise<string | null> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { request: true },
  });
  if (!receipt || receipt.request.requesterId !== requesterId) {
    return null;
  }
  return receipt.storageKey;
}

// Returns the storageKey so the caller can also delete the R2 object --
// this function only removes the DB record.
export async function removeReceiptRecord(
  receiptId: string,
  requesterId: string,
): Promise<{ storageKey: string }> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { request: true },
  });
  if (
    !receipt ||
    receipt.request.requesterId !== requesterId ||
    !isEditableStatus(receipt.request.status)
  ) {
    throw new Error("Receipt not found.");
  }
  await prisma.receipt.delete({ where: { id: receiptId } });
  return { storageKey: receipt.storageKey };
}

export interface RequestProgressLineItemView {
  description: string;
  amount: string; // formatted
}

export interface RequestProgressApprovalView {
  role: ApproverRoleValue;
  approverName: string | null;
  status: string;
  decidedAt: string | null; // ISO date
  // Only meaningful for AUTO_SATISFIED rows -- the audit-trail explanation
  // from autoSatisfyReason. Null for every other status.
  comments: string | null;
}

export interface RequestProgressView {
  id: string;
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  status: string;
  tier: ApprovalTier;
  lineItems: RequestProgressLineItemView[];
  receipts: { filename: string; viewUrl: string }[];
  bankDetails: { accountName: string; bsb: string; accountNumber: string } | null;
  approvals: RequestProgressApprovalView[];
  // Set when this reached (or will reach) APPROVED via the designated
  // confirmer's "within budget" confirmation rather than a direct
  // Regional Director decision -- lets the UI show that role as satisfied
  // instead of still-pending (voucher-pdf.tsx does the same for the final
  // voucher).
  regionalDirectorOverrideConfirmedAt: string | null;
}

// The requester's own read-only view of a submitted request -- previously
// no UI existed for this; RequestsTable only showed Edit/Delete for
// editable statuses, so a submitted request was invisible until resolved.
export async function getRequestProgress(
  requestId: string,
  requesterId: string,
): Promise<RequestProgressView | null> {
  const r = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId },
    include: {
      lineItems: true,
      receipts: true,
      bankDetails: true,
      requiredApprovals: { include: { approver: true } },
    },
  });
  if (!r) return null;

  const receipts = await Promise.all(
    r.receipts.map(async (rec) => ({
      filename: receiptFilename(rec.storageKey),
      viewUrl: await getReceiptDownloadUrl(rec.storageKey),
    })),
  );

  const tier = getTier(Number(r.totalAmount));

  return {
    id: r.id,
    voucherNo: r.voucherNo,
    requestType: r.requestType,
    ministryType: r.ministryType,
    totalAmount: formatAmount(r.totalAmount),
    status: r.status,
    tier,
    lineItems: r.lineItems.map((li) => ({
      description: li.description,
      amount: formatAmount(li.amount),
    })),
    receipts,
    bankDetails: r.bankDetails
      ? {
          accountName: r.bankDetails.accountName,
          bsb: formatBsb(r.bankDetails.bsb),
          accountNumber: r.bankDetails.accountNumber,
        }
      : null,
    approvals: r.requiredApprovals
      .slice()
      .sort((a, b) => APPROVER_ROLES.indexOf(a.role) - APPROVER_ROLES.indexOf(b.role))
      .map((a) => ({
        role: a.role,
        approverName: a.approver?.name ?? null,
        status: a.status,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        comments: a.comments,
      })),
    regionalDirectorOverrideConfirmedAt: r.regionalDirectorOverrideConfirmedAt
      ? r.regionalDirectorOverrideConfirmedAt.toISOString()
      : null,
  };
}

export interface RegionalDirectorOverrideOpportunityView {
  requestId: string;
  voucherNo: string;
  requesterName: string;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
}

// The designated confirmer isn't necessarily a RequiredApproval row on a
// tier-4 request (only if they claim COS1/COS2 themselves), so they'd
// have no way to discover one eligible for their "within budget"
// confirmation -- this is what decides whether to show that button.
// confirmRegionalDirectorOverride does the real authorization check
// regardless. Returns [] for anyone else.
export async function getRegionalDirectorOverrideOpportunities(
  userId: string,
): Promise<RegionalDirectorOverrideOpportunityView[]> {
  const confirmer = await prisma.user.findUnique({
    where: { email: REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL },
  });
  if (!confirmer || confirmer.id !== userId) return [];

  const requests = await prisma.reimbursementRequest.findMany({
    where: {
      status: "IN_APPROVAL",
      regionalDirectorOverrideConfirmedAt: null,
      requiredApprovals: {
        some: { role: "REGIONAL_DIRECTOR", status: "PENDING" },
      },
    },
    include: { requester: true, requiredApprovals: true },
    orderBy: { submittedAt: "asc" },
  });

  return requests
    .filter((r) => getTier(Number(r.totalAmount)) === 4)
    .filter((r) => {
      const cos1 = r.requiredApprovals.find((a) => a.role === "COS1");
      const cos2 = r.requiredApprovals.find((a) => a.role === "COS2");
      return cos1?.status === "APPROVED" && cos2?.status === "APPROVED";
    })
    .map((r) => ({
      requestId: r.id,
      voucherNo: r.voucherNo,
      requesterName: r.requester.name,
      ministryType: r.ministryType,
      totalAmount: formatAmount(r.totalAmount),
    }));
}
