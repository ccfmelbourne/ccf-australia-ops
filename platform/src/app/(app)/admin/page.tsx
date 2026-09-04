import { redirect } from "next/navigation";
import { getCurrentActiveUserId } from "@/lib/user-session";
import { requireAdmin, listUsers, listApproverAssignments } from "@/lib/admin-data";
import { UsersManager } from "@/components/admin/UsersManager";
import { ApproverAssignmentsManager } from "@/components/admin/ApproverAssignmentsManager";

export const dynamic = "force-dynamic";

// Redirects to /dashboard, not /sign-in, on denial -- they're validly
// signed in, just not authorised for this specific page. requireAdmin is
// a fresh database check, independent of whatever the layout/Sidebar
// already decided about showing the nav link -- that's a UI nicety, not
// the security boundary.
export default async function AdminPage() {
  const userId = await getCurrentActiveUserId();
  if (!userId) {
    redirect("/sign-in");
  }
  try {
    await requireAdmin(userId);
  } catch {
    redirect("/dashboard");
  }

  const [users, assignments] = await Promise.all([listUsers(), listApproverAssignments()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-lg font-bold text-slate-900">Admin</h1>
      <UsersManager users={users} currentUserId={userId} />
      <ApproverAssignmentsManager assignments={assignments} users={users} />
    </div>
  );
}
