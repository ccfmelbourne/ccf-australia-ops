"use server";

import { getCurrentUserId } from "@/lib/user-session";
import { decideApproval } from "@/lib/approval-data";

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
