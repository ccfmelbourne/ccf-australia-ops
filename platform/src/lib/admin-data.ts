import { prisma } from "@/lib/prisma";
import { MINISTRY_TYPES } from "@/lib/request-types";
import type { MinistryTypeValue } from "@/lib/request-types";

// Platform-level, not domain-owned (same reasoning as src/components/shell/)
// -- managing who's an authorised CCF user and who holds which approver
// role is platform configuration, not Reimbursement or Approval business
// logic.

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  status: string;
  isAdmin: boolean;
  createdAt: string; // ISO date
}

// Independently re-checked wherever admin access matters -- the /admin
// page and every Server Action in app/admin/actions.ts -- rather than
// trusted from a parent-passed prop, same reasoning as
// getCurrentActiveUserId (user-session.ts).
export async function requireAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    throw new Error("Not authorized.");
  }
}

export async function listUsers(): Promise<AdminUserView[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
  }));
}

// status defaults ACTIVE -- an admin adding someone here IS the
// deliberate authorization act, same as prisma/seed.ts's create-only
// status: "ACTIVE" pattern for named approvers.
export async function createUser(name: string, email: string): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists.");
  }
  const user = await prisma.user.create({ data: { name, email, status: "ACTIVE" } });
  return { id: user.id };
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { status } });
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { isAdmin } });
}

// Deletes this user's own ReimbursementRequest rows first (cascades
// everything under them), so a user who only ever created their own
// requests becomes cleanly deletable. The explicit RequiredApproval check
// below exists because that field is SET NULL on delete, not RESTRICT
// (it's nullable, for unclaimed COS slots) -- an earlier version relied
// on the database alone and silently nulled out a real approval's
// approverUserId instead of blocking the delete (found live).
// ApproverAssignment.userId/AuditLogEntry.actorUserId are required fields
// and genuinely RESTRICT (confirmed via information_schema), so the
// try/catch is real defense-in-depth, not the only guard.
export async function deleteUser(userId: string): Promise<void> {
  await prisma.reimbursementRequest.deleteMany({ where: { requesterId: userId } });

  const remainingApprovals = await prisma.requiredApproval.count({ where: { approverUserId: userId } });
  if (remainingApprovals > 0) {
    throw new Error(
      "Can't delete: this user has approval history on other people's requests. Suspend them instead.",
    );
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      throw new Error(
        "Can't delete: this user still has related records elsewhere. Suspend them instead.",
      );
    }
    throw err;
  }
}

export interface BulkDeleteResult {
  deletedCount: number;
  failed: { email: string; error: string }[];
}

// Each user is deleted independently -- one blocked deletion (e.g. a real
// approver mixed into a bulk-selected batch of test accounts) must not
// abort the rest of the batch. Reports failures by email, not raw id, so
// the UI can show something a human can act on.
export async function deleteUsers(userIds: string[]): Promise<BulkDeleteResult> {
  const failed: { email: string; error: string }[] = [];
  let deletedCount = 0;
  for (const userId of userIds) {
    try {
      await deleteUser(userId);
      deletedCount++;
    } catch (err) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      failed.push({
        email: user?.email ?? userId,
        error: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }
  return { deletedCount, failed };
}

export interface AdminAssignmentView {
  role: "MINISTRY_OVERSEER" | "FINANCE_OVERSEER" | "REGIONAL_DIRECTOR";
  ministryType: MinistryTypeValue | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

// One row per (role, ministryType) pair this app actually assigns via
// this table: MINISTRY_OVERSEER x 12 (one per MINISTRY_TYPES) plus the
// two org-wide roles (ministryType null) -- 14 rows total, matching the
// count prisma/seed.ts already produces. COS1/COS2 are deliberately
// absent -- claimable positions resolved from COS_POOL_EMAILS
// (approval-routing.ts), not this table.
export async function listApproverAssignments(): Promise<AdminAssignmentView[]> {
  const assignments = await prisma.approverAssignment.findMany({ include: { user: true } });
  const byKey = new Map(assignments.map((a) => [`${a.role}:${a.ministryType ?? ""}`, a]));

  const rows: AdminAssignmentView[] = MINISTRY_TYPES.map((ministryType) => {
    const a = byKey.get(`MINISTRY_OVERSEER:${ministryType}`);
    return {
      role: "MINISTRY_OVERSEER",
      ministryType,
      userId: a?.userId ?? null,
      userName: a?.user.name ?? null,
      userEmail: a?.user.email ?? null,
    };
  });

  for (const role of ["FINANCE_OVERSEER", "REGIONAL_DIRECTOR"] as const) {
    const a = byKey.get(`${role}:`);
    rows.push({
      role,
      ministryType: null,
      userId: a?.userId ?? null,
      userName: a?.user.name ?? null,
      userEmail: a?.user.email ?? null,
    });
  }

  return rows;
}

// Upsert, mirroring prisma/seed.ts's existing pattern: ministry-scoped
// rows use the compound unique key directly; the two org-wide roles need
// find-then-create/update, since Prisma's upsert `where` can't express
// ministryType: null.
export async function setApproverAssignment(
  role: "MINISTRY_OVERSEER" | "FINANCE_OVERSEER" | "REGIONAL_DIRECTOR",
  ministryType: MinistryTypeValue | null,
  userId: string,
): Promise<void> {
  if (ministryType) {
    await prisma.approverAssignment.upsert({
      where: { role_ministryType: { role, ministryType } },
      update: { userId },
      create: { role, ministryType, userId },
    });
    return;
  }
  const existing = await prisma.approverAssignment.findFirst({ where: { role, ministryType: null } });
  if (existing) {
    await prisma.approverAssignment.update({ where: { id: existing.id }, data: { userId } });
  } else {
    await prisma.approverAssignment.create({ data: { role, ministryType: null, userId } });
  }
}
