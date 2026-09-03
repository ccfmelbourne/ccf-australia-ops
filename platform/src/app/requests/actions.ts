"use server";

import { z } from "zod";
import { getCurrentUserId } from "@/lib/user-session";
import {
  createDraftRequest,
  addLineItem,
  removeLineItem,
  updateLineItem,
  assertRequestIsEditable,
  addReceiptRecord,
  removeReceiptRecord,
  upsertBankDetails,
  updateDraftRequestDetails,
  deleteDraftRequest,
  submitRequest,
} from "@/lib/request-data";
import { REQUEST_TYPES, MINISTRY_TYPES } from "@/lib/request-types";
import {
  assertValidReceiptFile,
  assertNotAnimatedPng,
  buildReceiptStorageKey,
  uploadReceipt,
  deleteReceipt,
} from "@/lib/receipt-storage";
import { deleteSignature } from "@/lib/signature-storage";
import { receiptExtractionService } from "@/lib/receipt-extraction";

const requestDetailsSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  ministryType: z.enum(MINISTRY_TYPES),
});

// Returns the new id AND voucherNo (not just id) so the caller can build
// the drawer's edit-mode view entirely client-side instead of navigating
// via router.push and round-tripping through getDraftRequest for data it
// already has -- that round-trip visibly unmounted and remounted the
// dialog (found live).
export async function createDraftRequestForDrawerAction(
  requestType: string,
  ministryType: string,
): Promise<{ ok: boolean; id?: string; voucherNo?: string; requesterName?: string; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = requestDetailsSchema.safeParse({ requestType, ministryType });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Unlike every other action in this file, this one previously had no
  // try/catch -- a thrown error rejected the Server Action call itself
  // instead of resolving { ok: false }, and CreateStep's effect has no
  // catch of its own, so the drawer was left looking like it simply
  // failed to open. Wrapping it here makes the existing ErrorBanner path
  // reachable for a real backend failure.
  try {
    const { id, voucherNo, requesterName } = await createDraftRequest(
      userId,
      parsed.data.requestType,
      parsed.data.ministryType,
    );
    return { ok: true, id, voucherNo, requesterName };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function updateRequestDetailsAction(
  requestId: string,
  requestType: string,
  ministryType: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = requestDetailsSchema.safeParse({ requestType, ministryType });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateDraftRequestDetails(
      requestId,
      userId,
      parsed.data.requestType,
      parsed.data.ministryType,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteRequestAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    const { receiptStorageKeys, signatureStorageKeys } = await deleteDraftRequest(requestId, userId);
    await Promise.all([
      ...receiptStorageKeys.map((key) => deleteReceipt(key)),
      ...signatureStorageKeys.map((key) => deleteSignature(key)),
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const SIGNATURE_DATA_URL_PREFIX = /^data:image\/png;base64,/;

export async function submitRequestAction(
  requestId: string,
  signatureDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  const signatureBuffer = Buffer.from(signatureDataUrl.replace(SIGNATURE_DATA_URL_PREFIX, ""), "base64");
  try {
    await submitRequest(requestId, userId, signatureBuffer);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

// Called imperatively from a client component, not via a native <form
// action={...}>, and returns a result rather than redirecting -- a Server
// Action redirecting back to the exact page it was submitted from doesn't
// reliably bust the client Router Cache in this Next.js version (confirmed
// live: server data was correct, but the browser kept showing the
// pre-mutation page). The client component calls router.refresh() instead.
export async function addLineItemAction(
  requestId: string,
  description: string,
  amount: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = lineItemSchema.safeParse({ description, amount });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await addLineItem(requestId, userId, parsed.data.description, parsed.data.amount);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function removeLineItemAction(
  lineItemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    await removeLineItem(lineItemId, userId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// The fix for an auto-scanned line item OCR got wrong -- real receipt/
// invoice layouts vary enough that remove-and-re-add alone wasn't good
// enough.
export async function updateLineItemAction(
  lineItemId: string,
  description: string,
  amount: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = lineItemSchema.safeParse({ description, amount });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateLineItem(lineItemId, userId, parsed.data.description, parsed.data.amount);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// Upload, with scanning as an opt-out (a "scan" field on formData, read
// as anything other than the literal string "false") rather than a
// separate manual "Scan" step. A scan failure never blocks the upload; a
// scan that can't find both a merchant and a valid amount leaves the
// receipt unscanned rather than inventing partial data, and the requester
// adds that line item manually. When both are found, the line item is
// created automatically -- a deliberate reversal of this module's
// original "OCR never writes without human confirmation" rule (see
// receipt-extraction/types.ts).
export async function uploadReceiptAction(
  requestId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  const scan = formData.get("scan") !== "false";

  try {
    assertValidReceiptFile({ size: file.size, contentType: file.type });
    // Checked before the R2 upload (not just inside addReceiptRecord
    // afterward) so an invalid/expired session doesn't waste an upload.
    await assertRequestIsEditable(requestId, userId);

    const buffer = Buffer.from(await file.arrayBuffer());
    assertNotAnimatedPng(buffer, file.type);

    const storageKey = buildReceiptStorageKey(requestId, file.name);
    await uploadReceipt(storageKey, buffer, file.type);

    let merchant: string | null = null;
    let item: string | null = null;
    let amount: number | null = null;
    if (scan) {
      try {
        const result = await receiptExtractionService.extract({ buffer, contentType: file.type });
        merchant = result.merchant?.trim() || null;
        item = result.item?.trim() || null;
        amount = result.amount;
      } catch {
        // Scanning is a nicety layered on top of a successful upload -- an
        // extraction failure (provider error, unreadable image) doesn't fail
        // the upload, it just leaves this receipt unscanned.
      }
    }
    const usable = merchant !== null && amount !== null && amount > 0;
    // "<merchant> | <item>" when a single product line could be isolated,
    // otherwise the merchant name alone -- the auto-created line item
    // should read as what was bought, not just where.
    const description = item ? `${merchant} | ${item}` : merchant!;

    await addReceiptRecord(
      requestId,
      userId,
      storageKey,
      usable ? { merchant: merchant!, amount: amount!, item } : null,
    );
    if (usable) {
      await addLineItem(requestId, userId, description, amount!);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function removeReceiptAction(
  receiptId: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    const { storageKey } = await removeReceiptRecord(receiptId, userId);
    await deleteReceipt(storageKey);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const bankDetailsSchema = z
  .object({
    accountName: z.string().trim().min(1, "Account name is required"),
    bsb: z.string().trim().min(1, "BSB is required"),
    accountNumber: z.string().trim().min(1, "Account number is required"),
    confirmAccountNumber: z.string().trim().min(1, "Please confirm the account number"),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Account numbers don't match.",
    path: ["confirmAccountNumber"],
  });

export async function saveBankDetailsAction(
  requestId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = bankDetailsSchema.safeParse({
    accountName: formData.get("accountName"),
    bsb: formData.get("bsb"),
    accountNumber: formData.get("accountNumber"),
    confirmAccountNumber: formData.get("confirmAccountNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await upsertBankDetails(
      requestId,
      userId,
      parsed.data.accountName,
      parsed.data.bsb,
      parsed.data.accountNumber,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
