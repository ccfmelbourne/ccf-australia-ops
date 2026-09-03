import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getRegionalDirectorOverrideOpportunities } from "@/lib/request-data";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { ApprovalsTable } from "@/components/approvals/ApprovalsTable";
import { RegionalDirectorOverride } from "@/components/approvals/RegionalDirectorOverride";

export const dynamic = "force-dynamic";

// The approver-facing half of the old combined /requests page: pending
// approvals plus the Regional Director override opportunities, which
// getRegionalDirectorOverrideOpportunities scopes to almost no one (see
// that function's own comment).
export default async function ApprovalsPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const [approvals, overrideOpportunities] = await Promise.all([
    getPendingApprovalsForUser(userId),
    getRegionalDirectorOverrideOpportunities(userId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <RegionalDirectorOverride opportunities={overrideOpportunities} />
      <ApprovalsTable approvals={approvals} />
    </div>
  );
}
