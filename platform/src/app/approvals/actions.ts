"use server";

import { getCurrentUserId } from "@/lib/user-session";
import { decideApproval } from "@/lib/approval-data";

export async function decideApprovalAction(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  comments: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, error: "Not signed in." };
  }
  if (decision === "REJECTED" && comments.trim().length === 0) {
    return { ok: false, error: "A comment is required when rejecting." };
  }
  try {
    await decideApproval(approvalId, userId, decision, comments.trim() || null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
