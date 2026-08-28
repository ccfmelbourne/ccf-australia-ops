"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createFinanceSession,
  destroyFinanceSession,
  isFinanceAuthenticated,
  verifyFinancePassword,
  getFinanceAccountantEmail,
  getFinanceAccountantName,
} from "@/lib/finance-auth";
import { transitionRequestStatus } from "@/lib/finance-data";
import type { FinanceStatus } from "@/lib/status-transitions";
import { sendStatusChangeEmail } from "@/lib/notifications";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export async function financeLoginAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!verifyFinancePassword(parsed.data.password)) {
    return { error: "Incorrect password." };
  }
  await createFinanceSession();
  redirect("/finance");
}

export async function financeLogoutAction(): Promise<void> {
  await destroyFinanceSession();
  redirect("/login");
}

// Ensures the Finance accountant User row exists (slice-1 has exactly one),
// so audit entries can reference a real User id.
async function getOrCreateAccountantUser() {
  const email = getFinanceAccountantEmail();
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: getFinanceAccountantName() },
  });
}

export async function updateRequestStatusAction(
  requestId: string,
  toStatus: FinanceStatus,
): Promise<{ ok: boolean; error?: string; emailWarning?: string }> {
  const authed = await isFinanceAuthenticated();
  if (!authed) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    const accountant = await getOrCreateAccountantUser();
    const notification = await transitionRequestStatus(requestId, toStatus, accountant.id);
    let emailWarning: string | undefined;
    try {
      await sendStatusChangeEmail({ ...notification, toStatus });
    } catch (emailErr) {
      // Email is a notification channel only (ADR 0001) — a delivery
      // failure must not undo or block the status transition it's
      // reporting on. Still logged server-side for ops visibility, and
      // surfaced to Finance as a toast so it isn't silently swallowed.
      console.error("Failed to send status change email:", emailErr);
      emailWarning = "Status updated, but the notification email failed to send.";
    }
    return { ok: true, emailWarning };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
