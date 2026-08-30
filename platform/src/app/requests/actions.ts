"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/user-session";
import {
  createDraftRequest,
  addLineItem,
  removeLineItem,
  assertOwnsDraftRequest,
  addReceiptRecord,
  removeReceiptRecord,
  getReceiptStorageKeyForOwner,
  upsertBankDetails,
} from "@/lib/request-data";
import { REQUEST_TYPES, MINISTRY_TYPES } from "@/lib/request-types";
import {
  assertValidReceiptFile,
  buildReceiptStorageKey,
  uploadReceipt,
  deleteReceipt,
  downloadReceiptBytes,
} from "@/lib/receipt-storage";
import { receiptExtractionService, type ReceiptExtractionResult } from "@/lib/receipt-extraction";

const createDraftSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  ministryType: z.enum(MINISTRY_TYPES),
});

export async function createDraftRequestAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const parsed = createDraftSchema.safeParse({
    requestType: formData.get("requestType"),
    ministryType: formData.get("ministryType"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { id } = await createDraftRequest(
    userId,
    parsed.data.requestType,
    parsed.data.ministryType,
  );
  redirect(`/requests/${id}`);
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
    await assertOwnsDraftRequest(requestId, userId);

    const storageKey = buildReceiptStorageKey(requestId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadReceipt(storageKey, buffer, file.type);
    await addReceiptRecord(requestId, userId, storageKey);
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
