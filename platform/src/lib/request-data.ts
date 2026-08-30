import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { getReceiptDownloadUrl } from "@/lib/receipt-storage";
import { normalizeBsb, formatBsb, assertValidAccountNumber } from "@/lib/bank-details";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

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

export interface DraftRequestView {
  id: string;
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  lineItems: DraftLineItemView[];
  receipts: DraftReceiptView[];
  bankDetails: DraftBankDetailsView | null;
}

// storageKey is "receipts/{requestId}/{uuid}-{safeName}" (buildReceiptStorageKey
// in receipt-storage.ts) -- strip the folder and UUID prefix for display.
function receiptFilename(storageKey: string): string {
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

export async function assertOwnsDraftRequest(requestId: string, requesterId: string): Promise<void> {
  const request = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId, status: "DRAFT" },
  });
  if (!request) {
    throw new Error("Draft request not found.");
  }
}

// Scoped to the requester's own DRAFT requests only -- can't see/edit
// someone else's request, and can't edit past DRAFT (no silent edits after
// submission, per spec 0001's "no silent edits" control).
export async function getDraftRequest(
  id: string,
  requesterId: string,
): Promise<DraftRequestView | null> {
  const r = await prisma.reimbursementRequest.findFirst({
    where: { id, requesterId, status: "DRAFT" },
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
  };
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
  await assertOwnsDraftRequest(requestId, requesterId);
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
  await assertOwnsDraftRequest(requestId, requesterId);
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
    lineItem.request.status !== "DRAFT"
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
  await assertOwnsDraftRequest(requestId, requesterId);
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
    receipt.request.status !== "DRAFT"
  ) {
    throw new Error("Receipt not found.");
  }
  await prisma.receipt.delete({ where: { id: receiptId } });
  return { storageKey: receipt.storageKey };
}
