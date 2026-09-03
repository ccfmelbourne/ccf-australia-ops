import { redirect } from "next/navigation";
import { getCurrentUserId, getUserProfile } from "@/lib/user-session";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

// Shared shell (sidebar/header) and auth guard for every signed-in page --
// Dashboard, My Requests, Approvals (moved from requests/layout.tsx, which
// only ever covered /requests). The pending-approval count is fetched
// once here (for the notification bell) rather than separately on
// /dashboard and /approvals, which both also need approval data of their
// own -- some duplicate querying across the layout/page boundary is
// already how this app works elsewhere (Next.js doesn't dedupe Prisma
// calls automatically), so this isn't a new tradeoff.
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
