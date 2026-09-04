import { redirect } from "next/navigation";
import { getCurrentActiveUserId, getUserProfile } from "@/lib/user-session";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

// Shared shell (sidebar/header) and auth guard for every signed-in page --
// Dashboard, My Requests, Approvals. The pending-approval count is fetched
// once here for the notification bell, even though /dashboard and
// /approvals also query approval data of their own -- Next.js doesn't
// dedupe Prisma calls automatically, but that's already how this app
// works elsewhere.
//
// Uses getCurrentActiveUserId, not the plain cookie-only getCurrentUserId
// -- a suspended user's still-valid session cookie must stop working here
// immediately, not just at their next sign-in. Redirects plain (no error
// param) either way: this can't tell "never signed in" apart from
// "suspended," and showing "Access denied" to someone who simply hasn't
// signed in yet would be misleading -- that message only belongs to an
// actual rejected sign-in attempt (the Google callback route).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentActiveUserId();
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
