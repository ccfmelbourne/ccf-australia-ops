"use server";

import { z } from "zod";
import { getCurrentUserId } from "@/lib/user-session";
import {
  createDraftRequest,
  addLineItem,
  removeLineItem,
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
// the drawer's edit-mode view entirely client-side, instead of navigating
// via router.push and waiting on a server round-trip through
// getDraftRequest just to get back data the caller already has (a fresh
// draft has no line items/receipts/bank details yet) -- that round-trip
// was creating a visible gap where neither the "creating" nor "editing"
// drawer content was mounted, which unmounted and remounted the dialog.
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
  // try/catch -- a thrown error (a DB hiccup, anything) rejected the
  // Server Action call itself instead of resolving with { ok: false }.
  // CreateStep's effect has no catch of its own around this await either,
  // so the rejection went nowhere useful: no error state ever got set, no
  // ErrorBanner ever showed, and the drawer was left looking like it had
  // simply failed to open. Wrapping it here is what makes that existing
  // ErrorBanner path actually reachable for a real backend failure.
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

// Called imperatively from a client component (StatusTransitionForm.tsx's
// existing pattern), not via a native <form action={...}>, and returns a
// result rather than redirecting: the caller is always already on
// /requests/[id] (this is an in-place edit, not a navigation), and a
// Server Action redirecting back to the exact page it was submitted from
// doesn't reliably bust the client Router Cache in this Next.js version --
// confirmed live (server data was correct via a direct fetch, but the
// browser kept showing the pre-mutation page). The client component calls
// router.refresh() on success instead.
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

// Upload and scan in one call -- no separate manual "Scan" step. A scan
// failure never blocks the upload itself (the receipt is still attached
// either way); a scan that can't find both a merchant and a valid amount
// leaves the receipt unscanned (extractedMerchant/extractedAmount/
// scannedAt all null) rather than inventing partial data, and the
// requester adds that line item manually, same as always. When both are
// found, the line item is created automatically -- confirmed 2026-09-02
// with the decision-maker as a deliberate reversal of this module's
// original "OCR never writes without human confirmation" rule (see
// receipt-extraction/types.ts).
export async function uploadAndScanReceiptAction(
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
    let amount: number | null = null;
    try {
      const result = await receiptExtractionService.extract({ buffer, contentType: file.type });
      merchant = result.merchant?.trim() || null;
      amount = result.amount;
    } catch {
      // Scanning is a nicety layered on top of a successful upload -- an
      // extraction failure (provider error, unreadable image) doesn't fail
      // the upload, it just leaves this receipt unscanned.
    }
    const usable = merchant !== null && amount !== null && amount > 0;

    await addReceiptRecord(requestId, userId, storageKey, usable ? { merchant: merchant!, amount: amount! } : null);
    if (usable) {
      await addLineItem(requestId, userId, merchant!, amount!);
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
