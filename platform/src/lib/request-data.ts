import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

// Uses array-form prisma.$transaction([...]) throughout (matches
// finance-data.ts), not the interactive prisma.$transaction(async (tx) =>
// {...}) callback form. In this exact stack (Prisma 7 + @prisma/adapter-pg
// + Next.js dev server, tested against Neon), a second interactive
// transaction issued shortly after a first one silently failed to persist
// its writes -- no thrown error, no log -- while array-form transactions
// did not exhibit this. Root cause not fully isolated; array-form is the
// proven-safe pattern here.

export interface DraftLineItemView {
  id: string;
  description: string;
  amount: string; // formatted, e.g. "245.80"
}

export interface DraftRequestView {
  id: string;
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string; // formatted
  lineItems: DraftLineItemView[];
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
  // Array-form transaction (matches finance-data.ts's existing pattern) --
  // each op is independent, no op needs to read another's result first.
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

// Scoped to the requester's own DRAFT requests only -- can't see/edit
// someone else's request, and can't edit past DRAFT (no silent edits after
// submission, per spec 0001's "no silent edits" control).
export async function getDraftRequest(
  id: string,
  requesterId: string,
): Promise<DraftRequestView | null> {
  const r = await prisma.reimbursementRequest.findFirst({
    where: { id, requesterId, status: "DRAFT" },
    include: { lineItems: true },
  });
  if (!r) return null;
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
  };
}

export async function addLineItem(
  requestId: string,
  requesterId: string,
  description: string,
  amount: number,
): Promise<void> {
  // Read-then-write guard done as a plain read first (not inside the
  // transaction below) -- matches the array-transaction pattern already
  // proven in finance-data.ts, where each transaction member is an
  // independent op rather than a sequentially-dependent interactive one.
  const request = await prisma.reimbursementRequest.findFirst({
    where: { id: requestId, requesterId, status: "DRAFT" },
  });
  if (!request) {
    throw new Error("Draft request not found.");
  }
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
