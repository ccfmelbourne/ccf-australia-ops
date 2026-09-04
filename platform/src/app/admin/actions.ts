"use server";

import { z } from "zod";
import { getCurrentActiveUserId } from "@/lib/user-session";
import {
  requireAdmin,
  createUser,
  setUserStatus,
  setUserAdmin,
  deleteUser,
  deleteUsers,
  setApproverAssignment,
} from "@/lib/admin-data";
import type { BulkDeleteResult } from "@/lib/admin-data";
import { MINISTRY_TYPES } from "@/lib/request-types";

async function requireActingAdmin(): Promise<string> {
  const userId = await getCurrentActiveUserId();
  if (!userId) {
    throw new Error("Not signed in.");
  }
  await requireAdmin(userId);
  return userId;
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
});

export async function createUserAction(name: string, email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireActingAdmin();
    const parsed = createUserSchema.safeParse({ name, email });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    await createUser(parsed.data.name, parsed.data.email);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// Rejects acting on your own account -- an admin suspending or
// de-admin-ing themselves through this UI could lock everyone out with
// no way back in short of direct database access.
export async function setUserStatusAction(
  targetUserId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actingUserId = await requireActingAdmin();
    if (targetUserId === actingUserId) {
      return { ok: false, error: "You can't change your own status." };
    }
    await setUserStatus(targetUserId, status);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function setUserAdminAction(
  targetUserId: string,
  isAdmin: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actingUserId = await requireActingAdmin();
    if (targetUserId === actingUserId) {
      return { ok: false, error: "You can't change your own admin access." };
    }
    await setUserAdmin(targetUserId, isAdmin);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteUserAction(targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const actingUserId = await requireActingAdmin();
    if (targetUserId === actingUserId) {
      return { ok: false, error: "You can't delete your own account." };
    }
    await deleteUser(targetUserId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

// Each user is deleted independently (admin-data.ts's deleteUsers) -- one
// blocked deletion must not stop the rest, so this returns ok: true if it
// ran at all, with the real outcome in `result`. Silently drops the
// acting admin's own id if somehow included, rather than failing the
// whole batch over it.
export async function deleteUsersAction(
  targetUserIds: string[],
): Promise<{ ok: boolean; error?: string; result?: BulkDeleteResult }> {
  try {
    const actingUserId = await requireActingAdmin();
    const ids = targetUserIds.filter((id) => id !== actingUserId);
    const result = await deleteUsers(ids);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const assignmentRoleSchema = z.enum(["MINISTRY_OVERSEER", "FINANCE_OVERSEER", "REGIONAL_DIRECTOR"]);
const ministryTypeSchema = z.enum(MINISTRY_TYPES);

export async function setApproverAssignmentAction(
  role: string,
  ministryType: string | null,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireActingAdmin();
    const parsedRole = assignmentRoleSchema.safeParse(role);
    if (!parsedRole.success) {
      return { ok: false, error: "Invalid role." };
    }
    const parsedMinistry = ministryType === null ? null : ministryTypeSchema.safeParse(ministryType);
    if (parsedMinistry && !parsedMinistry.success) {
      return { ok: false, error: "Invalid ministry." };
    }
    await setApproverAssignment(
      parsedRole.data,
      parsedMinistry ? parsedMinistry.data : null,
      userId,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
