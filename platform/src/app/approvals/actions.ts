"use server";

import { getCurrentUserId } from "@/lib/user-session";
import { decideApproval, requestChanges, overrideApprove } from "@/lib/approval-data";

const DATA_URL_PREFIX = /^data:image\/png;base64,/;

export async function decideApprovalAction(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  comments: string,
  signatureDataUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  if (decision === "REJECTED" && comments.trim().length === 0) {
    return { ok: false, error: "A comment is required when rejecting." };
  }
  if (decision === "APPROVED" && !signatureDataUrl) {
    return { ok: false, error: "Please sign to approve." };
  }

  const signatureBuffer =
    decision === "APPROVED" && signatureDataUrl
      ? Buffer.from(signatureDataUrl.replace(DATA_URL_PREFIX, ""), "base64")
      : null;

  try {
    await decideApproval(approvalId, userId, decision, comments.trim() || null, signatureBuffer);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function requestChangesAction(
  approvalId: string,
  comments: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  if (comments.trim().length === 0) {
    return { ok: false, error: "A comment is required when requesting changes." };
  }
  try {
    await requestChanges(approvalId, userId, comments.trim());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// One of the three tier-4 override committee members casting their vote --
// see approval-data.ts's overrideApprove.
export async function overrideApproveAction(
  overrideApprovalId: string,
  approved: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    await overrideApprove(overrideApprovalId, userId, approved);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
