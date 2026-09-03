import { redirect } from "next/navigation";
import { getCurrentUserId, getUserProfile } from "@/lib/user-session";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

// Shared shell (sidebar/header) and auth guard for every signed-in page --
// Dashboard, My Requests, Approvals. The pending-approval count is fetched
// once here for the notification bell, even though /dashboard and
// /approvals also query approval data of their own -- Next.js doesn't
// dedupe Prisma calls automatically, but that's already how this app
// works elsewhere.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const [user, pendingApprovals] = await Promise.all([
    getUserProfile(userId),
    getPendingApprovalsForUser(userId),
  ]);

  return (
    <AppShell user={user} pendingApprovalCount={pendingApprovals.length}>
      {children}
    </AppShell>
  );
}
