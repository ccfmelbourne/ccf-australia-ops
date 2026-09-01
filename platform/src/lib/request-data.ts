import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { normalizeBsb, formatBsb, assertValidAccountNumber } from "@/lib/bank-details";
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
  // Signed URL, computed at render time — expires after a few minutes
  // (getReceiptDownloadUrl's default). A plain <a href> avoids the
  // popup-blocker/timing issues of fetching it on click; if it's expired
  // by the time someone clicks, reloading the page gets a fresh one.
  viewUrl: string;
  // Set together, only when OCR extraction found both a merchant and a
  // valid amount at upload time (uploadAndScanReceiptAction) -- null
  // covers both "not scanned yet" and "scanned but nothing usable came
  // back," which the UI renders the same way ("add manually").
  extractedMerchant: string | null;
  extractedAmount: string | null; // formatted
  scannedAt: string | null; // ISO date
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
  requesterName: string;
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
  status: string;
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
  // Set only when this reached APPROVED via Ross Callado's "within budget"
  // confirmation instead of a direct Regional Director decision --
  // approval-data.ts's confirmRegionalDirectorOverride/isFullyApproved.
  regionalDirectorOverrideConfirmedAt: string | null; // ISO date
  // R2 object key for the requester's own signature, captured at submit
  // time (submitRequest below). Always set for a request that reached
  // APPROVED -- submitRequest requires it -- but typed nullable since this
  // field predates the requirement and old rows could in principle lack it.
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
): Promise<{ id: string; voucherNo: string; requesterName: string }> {
  const voucherNo = await nextVoucherNo();
  // Array-form transaction -- each op is independent, no op needs to read
  // another's result first. The requester lookup rides along here (rather
  // than a separate query in the caller) purely so the wizard's Review step
  // can show "Requester: <name>" without its own round-trip.
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
      extractedAmount: rec.extractedAmount ? formatAmount(rec.extractedAmount) : null,
      scannedAt: rec.scannedAt ? rec.scannedAt.toISOString() : null,
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

// COS1/COS2 are deliberately never resolved here -- they're claimable
// positions open to any of approval-routing.ts's COS_POOL, not a single
// pre-assigned person. Their RequiredApproval rows are created with
// approverUserId null and get claimed at decision time (approval-data.ts's
// decideApproval). FINANCE_OVERSEER/REGIONAL_DIRECTOR are assigned
// org-wide (ministryType: null); MINISTRY_OVERSEER per the request's own
// ministry.
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
export async function submitRequest(
  requestId: string,
  requesterId: string,
  signatureBuffer: Buffer,
): Promise<void> {
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
  // Cash advances are requested before the money's spent -- there's
  // nothing to attach a receipt for yet, unlike every other request type.
  if (request.requestType !== "CASH_ADVANCE" && request.receipts.length === 0) {
    throw new Error("Attach at least one receipt before submitting.");
  }
  assertValidSignatureImage(signatureBuffer);

  // Uploaded before the transaction below -- if this throws, nothing else
  // about the request changes. The previous key (a resubmission replacing
  // an earlier signature) is only deleted after the transaction commits,
  // so a mid-transaction failure never orphans-deletes a still-valid one.
  const signatureStorageKey = buildSignatureStorageKey(requestId);
  await uploadSignature(signatureStorageKey, signatureBuffer);
  const previousSignatureStorageKey = request.requesterSignatureStorageKey;

  const isResubmission = request.status === "NEEDS_CLARIFICATION" || request.status === "REJECTED_RETURNED";
  const tier = getTier(Number(request.totalAmount));
  const roles = getRequiredApproverRoles(tier);
  const approverUserIds = await Promise.all(
    roles.map((role) => resolveApprover(role, request.ministryType)),
  );

  // COS1/COS2 are claimable, not pre-resolved (resolveApprover always
  // returns null for them) -- comparing approverUserId for those would
  // always mismatch once a slot's been claimed, forcing a needless full
  // reset. "Preserved" for a claimable role just means it's still in the
  // recomputed role set; who claimed it (if anyone) is a runtime fact, not
  // something resubmission should second-guess.
  const CLAIMABLE_ROLES = new Set(["COS1", "COS2"]);
  const existingByRole = new Map(request.requiredApprovals.map((a) => [a.role, a]));
  const canPreserve =
    existingByRole.size === roles.length &&
    roles.every((role, i) => {
      const existing = existingByRole.get(role);
      if (!existing) return false;
      if (CLAIMABLE_ROLES.has(role)) return true;
      return existing.approverUserId === approverUserIds[i];
    });

  const requestUpdate = prisma.reimbursementRequest.update({
    where: { id: requestId },
    data: { status: "IN_APPROVAL", submittedAt: new Date(), requesterSignatureStorageKey: signatureStorageKey },
  });

  if (canPreserve) {
    // Only rows that aren't already APPROVED get reset -- an approver who
    // already signed off is never asked to look again. A previously
    // REJECTED claimable row also has its claim cleared (approverUserId
    // back to null) so it's genuinely open to any pool member again, not
    // silently re-offered only to whoever declined it last time.
    const rowsToReset = request.requiredApprovals.filter((a) => a.status !== "APPROVED");
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
          },
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
      // A stale Regional Director override confirmation (if any) can't be
      // trusted for a materially different request -- same reasoning as
      // resetting RequiredApproval rows above.
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
// totalAmount, so a single create needs no transaction. `extraction` is
// set only when uploadAndScanReceiptAction's OCR call found both a
// merchant and a valid amount right after upload -- omitted (or null)
// leaves the receipt's extracted* columns null, rendered as "add
// manually" on its card.
export async function addReceiptRecord(
  requestId: string,
  requesterId: string,
  storageKey: string,
  extraction?: { merchant: string; amount: number } | null,
): Promise<{ id: string }> {
  await assertRequestIsEditable(requestId, requesterId);
  const receipt = await prisma.receipt.create({
    data: {
      reimbursementRequestId: requestId,
      storageKey,
      extractedMerchant: extraction?.merchant ?? null,
      extractedAmount: extraction?.amount ?? null,
      scannedAt: extraction ? new Date() : null,
    },
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

export interface RequestProgressLineItemView {
  description: string;
  amount: string; // formatted
}

export interface RequestProgressApprovalView {
  role: ApproverRoleValue;
  approverName: string | null;
  status: string;
  decidedAt: string | null; // ISO date
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
  // Set only when this reached (or will reach) APPROVED via Ross
  // Callado's "within budget" confirmation instead of a direct Regional
  // Director decision -- lets the UI show that role as satisfied rather
  // than still-pending once the rest of the chain is done (voucher-pdf.tsx
  // does the same thing for the final voucher).
  regionalDirectorOverrideConfirmedAt: string | null;
}

// The requester's own read-only view of a submitted (non-editable)
// request -- there was previously no UI at all for this; RequestsTable
// only ever showed Edit/Delete for editable statuses, so a submitted
// request was otherwise invisible until it resolved.
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

// Ross Callado isn't necessarily a RequiredApproval row on a given
// tier-4 request (he only shows up there if he happens to claim COS1 or
// COS2 himself), so he'd otherwise have no way to discover a request
// eligible for his "within budget" confirmation. Returns [] for anyone
// who isn't him. confirmRegionalDirectorOverride (approval-data.ts) does
// the real authorization + precondition check regardless -- this is just
// what decides whether to show the button at all.
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
