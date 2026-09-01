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
  getReceiptStorageKeyForOwner,
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
  downloadReceiptBytes,
} from "@/lib/receipt-storage";
import { deleteSignature } from "@/lib/signature-storage";
import { receiptExtractionService, type ReceiptExtractionResult } from "@/lib/receipt-extraction";

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
): Promise<{ ok: boolean; id?: string; voucherNo?: string; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }

  const parsed = requestDetailsSchema.safeParse({ requestType, ministryType });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id, voucherNo } = await createDraftRequest(
    userId,
    parsed.data.requestType,
    parsed.data.ministryType,
  );
  return { ok: true, id, voucherNo };
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

export async function uploadReceiptAction(
  requestId: string,
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
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
    // Returned so the client can immediately scan the new receipt for
    // suggested line-item information without a separate lookup.
    const { id } = await addReceiptRecord(requestId, userId, storageKey);
    return { ok: true, id };
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

// Opt-in, purely a suggestion: returns extracted fields for the requester
// to review/edit/discard in the UI. Never writes anything -- confirming a
// suggestion still goes through the normal addLineItemAction, same as a
// manually-typed line item.
export async function extractReceiptAction(
  receiptId: string,
): Promise<{ ok: boolean; result?: ReceiptExtractionResult; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  const storageKey = await getReceiptStorageKeyForOwner(receiptId, userId);
  if (!storageKey) {
    return { ok: false, error: "Receipt not found." };
  }
  try {
    const { buffer, contentType } = await downloadReceiptBytes(storageKey);
    const result = await receiptExtractionService.extract({ buffer, contentType });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
