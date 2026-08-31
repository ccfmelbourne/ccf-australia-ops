import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { normalizeBsb, formatBsb, assertValidAccountNumber } from "@/lib/bank-details";
import { getTier, getRequiredApproverRoles, APPROVER_ROLES } from "@/lib/approval-routing";
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
  // Signed URL, computed at render time — expires after a few minutes
  // (getReceiptDownloadUrl's default). A plain <a href> avoids the
  // popup-blocker/timing issues of fetching it on click; if it's expired
  // by the time someone clicks, reloading the page gets a fresh one.
  viewUrl: string;
}

export interface DraftBankDetailsView {
  accountName: string;
  bsb: string; // formatted, e.g. "123-456"
  accountNumber: string;
}

// Covers both ways a request can bounce back to its requester -- an
// approver rejecting it or requesting changes. Both are resubmittable the
// same way (see submitRequest); this is only about explaining why, in the
// requester's own UI.
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
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  lineItems: DraftLineItemView[];
  receipts: DraftReceiptView[];
  bankDetails: DraftBankDetailsView | null;
  // Set only when status is NEEDS_CLARIFICATION or REJECTED_RETURNED -- who
  // sent it back and why, read from the AuditLogEntry approval-data.ts logs
  // for that decision (the RequiredApproval row's own comments field isn't
  // used here, so both cases are read the same way).
  returnReason: ReturnReasonView | null;
}

export interface ApprovedRequestDetailLineItem {
  description: string;
  amount: string; // formatted
}

export interface ApprovedRequestDetailApproval {
  role: ApproverRoleValue;
  approverName: string | null;
  decidedAt: string | null; // ISO date
  signatureStorageKey: string | null;
}

// One row per MinistryType, current Overseer. Reflects *today's*
// ApproverAssignment data (see getApproverDirectory), not what was assigned
// at the time this particular request was submitted -- it's a "who to
// contact now" reference on the voucher, distinct from `approvals` above,
// which is a historical record of who actually decided *this* request.
// Deliberately excludes COS1 (the voucher's dynamic Approval row already
// shows whoever actually signed as COS1 for this request when that role
// applies) and the two org-wide roles (Finance Overseer/Regional Director --
// not wanted on this directory; they likewise already appear in the
// Approval row for tiers that require them).
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
  // Atomic, database-backed sequence (spec 0002: explicitly not
  // Math.random() -- must be collision-resistant under concurrent
  // submissions). See prisma/migrations/..._add_voucher_no_sequence.
  // Sequences are non-transactional by design (always advance, even if the
  // enclosing operation is rolled back), so this runs standalone -- no
  // interactive transaction needed just to read it.
  const rows =
    await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('voucher_no_seq') AS nextval`;
  const year = new Date().getFullYear();
  return `DV-${year}-${rows[0].nextval.toString().padStart(4, "0")}`;
}

export async function createDraftRequest(
  requesterId: string,
  requestType: RequestTypeValue,
  ministryType: MinistryTypeValue,
): Promise<{ id: string }> {
  const voucherNo = await nextVoucherNo();
  // Array-form transaction -- each op is independent, no op needs to read
  // another's result first.
  const [request] = await prisma.$transaction([
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
  ]);
  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: request.id,
      actorUserId: requesterId,
      action: "DRAFT_CREATED",
      details: { requestType, ministryType },
    },
  });
  return { id: request.id };
}

// A request is editable by its own requester in exactly three statuses:
// DRAFT (never submitted yet), NEEDS_CLARIFICATION (an approver asked for
// changes), and REJECTED_RETURNED (an approver rejected it) -- the latter
// two are both resubmittable the same way (see submitRequest), just
// distinct approver-facing actions with their own audit trail. Every other
// status means it's mid- or post-approval, where spec 0001's "no silent
// edits" control applies.
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
// someone else's request, and can't edit outside DRAFT/NEEDS_CLARIFICATION/
// REJECTED_RETURNED (no silent edits after submission, per spec 0001's
// "no silent edits" control).
export async function getDraftRequest(
  id: string,
  requesterId: string,
): Promise<DraftRequestView | null> {
  const r = await prisma.reimbursementRequest.findFirst({
    where: { id, requesterId, status: { in: [...EDITABLE_STATUSES] } },
    include: { lineItems: true, receipts: true, bankDetails: true },
  });
  if (!r) return null;
  const receipts = await Promise.all(
    r.receipts.map(async (rec) => ({
      id: rec.id,
      filename: receiptFilename(rec.storageKey),
      uploadedAt: rec.uploadedAt.toISOString(),
      viewUrl: await getReceiptDownloadUrl(rec.storageKey),
    })),
  );
  let returnReason: ReturnReasonView | null = null;
  if (r.status === "NEEDS_CLARIFICATION" || r.status === "REJECTED_RETURNED") {
    // Whichever action caused the *current* status is necessarily the most
    // recent one of its kind -- a request can't return to IN_APPROVAL for
    // more decisions to happen until the next resubmission, at which point
    // it's no longer in either of these statuses, so no extra filtering by
    // outcome is needed here.
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

// All statuses (not DRAFT-only like getDraftRequest) -- this is the
// requester's own landing page, listing everything they've ever created.
export async function getMyRequests(requesterId: string): Promise<RequestListItemView[]> {
  const requests = await prisma.reimbursementRequest.findMany({
    where: { requesterId },
    orderBy: { createdAt: "desc" },
  });
  return requests.map((r) => ({
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

// Deletes the request row itself -- LineItem/Receipt/BankDetails/
// RequiredApproval/AuditLogEntry all cascade via the schema's
// onDelete: Cascade. Returns the receipt and signature storage keys first
// so the caller can delete the R2 objects, since R2 isn't part of a
// Postgres cascade (mirrors removeReceiptRecord's existing
// return-the-key-don't-reach-into-receipt-storage pattern). A request
// reachable here (DRAFT/NEEDS_CLARIFICATION/REJECTED_RETURNED, see
// EDITABLE_STATUSES) can have RequiredApproval rows with a signature
// already on them -- e.g. one approver approved before another rejected or
// requested changes -- so this isn't just a DRAFT-only concern anymore.
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

// FINANCE_OVERSEER/REGIONAL_DIRECTOR are assigned org-wide (ministryType:
// null in ApproverAssignment); MINISTRY_OVERSEER/COS1 are assigned per the
// request's own ministry. COS2 is never looked up -- no assignment exists
// for it anywhere (confirmed: no one currently holds a second-COS slot for
// any ministry), so it's always left unassigned.
const ORG_WIDE_ROLES = new Set(["FINANCE_OVERSEER", "REGIONAL_DIRECTOR"]);

async function resolveApprover(
  role: ApproverRoleValue,
  ministryType: MinistryTypeValue,
): Promise<string | null> {
  if (role === "COS2") return null;
  const assignment = await prisma.approverAssignment.findFirst({
    where: ORG_WIDE_ROLES.has(role) ? { role, ministryType: null } : { role, ministryType },
  });
  return assignment?.userId ?? null;
}

// DRAFT -> IN_APPROVAL. Generates one RequiredApproval row per role the
// confirmed tier rules require (approval-routing.ts), with approverUserId
// resolved from ApproverAssignment where one exists (left null otherwise --
// e.g. COS2, which currently has no assignment for any ministry). Goes
// straight to IN_APPROVAL rather than SUBMITTED, since the required-approval
// rows are generated in this same atomic step -- SUBMITTED would be a
// fleeting label with no distinct behavior of its own.
// Serves as both the first submission (from DRAFT) and a resubmission
// after an approver requests changes (from NEEDS_CLARIFICATION,
// approval-data.ts's requestChanges) -- one code path for both, since the
// only real difference is whether any RequiredApproval rows already exist.
//
// On resubmission, already-decided approvals are preserved rather than
// wiped wholesale: an approver who already approved shouldn't be forced to
// re-approve just because a *different* approver asked for an unrelated
// fix. This is only safe when the recomputed tier/role set and each role's
// resolved approver are unchanged from what's already on file -- if the
// edit pushed the total across a tier boundary, or changed the ministry so
// a role now resolves to a different person, the old approvals can't be
// trusted (they were never reviewed against the new tier/ministry), so
// this falls back to a full reset instead. A first-time submission from
// DRAFT has no existing rows at all, so it trivially takes the full-reset
// path -- no special-casing needed for "is this the first time."
export async function submitRequest(requestId: string, requesterId: string): Promise<void> {
  const request = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId, status: { in: [...EDITABLE_STATUSES] } },
    include: { lineItems: true, bankDetails: true, receipts: true, requiredApprovals: true },
  });
  if (!request) {
    throw new Error("Request not found.");
  }
  if (request.lineItems.length === 0) {
    throw new Error("Add at least one line item before submitting.");
  }
  if (!request.bankDetails) {
    throw new Error("Add bank details before submitting.");
  }
  if (request.receipts.length === 0) {
    throw new Error("Attach at least one receipt before submitting.");
  }

  const isResubmission = request.status === "NEEDS_CLARIFICATION" || request.status === "REJECTED_RETURNED";
  const tier = getTier(Number(request.totalAmount));
  const roles = getRequiredApproverRoles(tier);
  const approverUserIds = await Promise.all(
    roles.map((role) => resolveApprover(role, request.ministryType)),
  );

  const existingByRole = new Map(request.requiredApprovals.map((a) => [a.role, a]));
  const canPreserve =
    existingByRole.size === roles.length &&
    roles.every((role, i) => existingByRole.get(role)?.approverUserId === approverUserIds[i]);

  const requestUpdate = prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { status: "IN_APPROVAL", submittedAt: new Date() },
  });

  if (canPreserve) {
    // Only rows that aren't already APPROVED get reset -- an approver who
    // already signed off is never asked to look again.
    const rowsToReset = request.requiredApprovals.filter((a) => a.status !== "APPROVED");
    await prisma.$transaction([
      ...rowsToReset.map((a) =>
        prisma.requiredApproval.update({
          where: { id: a.id },
          data: { status: "PENDING", decidedAt: null, comments: null, signatureStorageKey: null },
        }),
      ),
      requestUpdate,
    ]);
  } else {
    await prisma.$transaction([
      prisma.requiredApproval.deleteMany({ where: { reimbursementRequestId: requestId } }),
      ...roles.map((role, i) =>
        prisma.requiredApproval.create({
          data: {
            reimbursementRequestId: requestId,
            role,
            status: "PENDING",
            approverUserId: approverUserIds[i],
          },
        }),
      ),
      requestUpdate,
    ]);
  }

  await prisma.auditLogEntry.create({
    data: {
      reimbursementRequestId: requestId,
      actorUserId: requesterId,
      action: isResubmission ? "RESUBMITTED" : "SUBMITTED",
      details: { tier, requiredRoles: roles, preservedPriorApprovals: canPreserve },
    },
  });
}

// Everything the approved-request voucher PDF/notification needs, fetched
// once right after a request reaches APPROVED. No status filter beyond
// existence -- by the time every RequiredApproval row is decided, line
// items/bank details/receipts/request type/ministry can no longer have
// changed (assertRequestIsEditable gates all of those to DRAFT/NEEDS_CLARIFICATION,
// neither of which is reachable once IN_APPROVAL, and decideApproval refuses
// to re-decide an already-decided row), so this
// read is already exactly the data that was approved, not a live/mutable
// view of it. Returns null if bank details are missing, which submitRequest
// already guarantees can't happen for a request that reached IN_APPROVAL --
// treated as a data-integrity signal, not an expected case.
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
        approverName: a.approver?.name ?? null,
        decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
        signatureStorageKey: a.signatureStorageKey,
      })),
    approverDirectory,
  };
}

// Live "who approves what" reference, for the voucher's printed directory
// section -- deliberately re-queried fresh each time (not resolved once at
// submission like RequiredApproval.approverUserId is), since its whole
// purpose is to tell Finance who to contact *today*, not who was assigned
// back when this particular request was submitted.
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

// A single upsert (not separate add/remove) since BankDetails is 1:1 --
// re-saving replaces the previous values. No account number/BSB ever goes
// into the AuditLogEntry's details -- the audit trail records that a
// change happened, never the sensitive values themselves.
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
  // Read-then-write guard done as a plain read first (not inside the
  // transaction below) -- keeps each transaction member an independent op
  // rather than a sequentially-dependent interactive one.
  await assertRequestIsEditable(requestId, requesterId);
  // Atomic increment, not a re-fetch-and-sum -- avoids needing to read the
  // new line item back before updating the total, so both ops here are
  // genuinely independent and safe as an array transaction.
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
    throw new Error("Line item not found.");
  }
  await prisma.$transaction([
    prisma.lineItem.delete({ where: { id: lineItemId } }),
    prisma.reimbursementRequest.update({
      where: { id: lineItem.reimbursementRequestId },
      data: { totalAmount: { decrement: lineItem.amount } },
    }),
  ]);
}

// The actual R2 upload happens separately (src/lib/receipt-storage.ts) --
// this only records the resulting storageKey. Receipts don't affect
// totalAmount, so a single create needs no transaction.
export async function addReceiptRecord(
  requestId: string,
  requesterId: string,
  storageKey: string,
): Promise<{ id: string }> {
  await assertRequestIsEditable(requestId, requesterId);
  const receipt = await prisma.receipt.create({
    data: { reimbursementRequestId: requestId, storageKey },
  });
  return { id: receipt.id };
}

// Ownership check only (not status-gated, unlike the mutating receipt
// functions) -- used to fetch the file for scanning, which is read-only.
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
