"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/user-session";
import { createDraftRequest, addLineItem, removeLineItem } from "@/lib/request-data";
import { REQUEST_TYPES, MINISTRY_TYPES } from "@/lib/request-types";

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
    redirect("/requester-login");
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
