import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getRegionalDirectorOverrideOpportunities } from "@/lib/request-data";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { ApprovalsTable } from "@/components/approvals/ApprovalsTable";
import { RegionalDirectorOverride } from "@/components/approvals/RegionalDirectorOverride";

export const dynamic = "force-dynamic";

// Moved off the old combined /requests page onto its own route -- this is
// the approver-facing half (pending approvals + the Regional Director
// override opportunities, which getRegionalDirectorOverrideOpportunities
// scopes to almost no one, returning [] for anyone who isn't Ross
// Callado -- see that function's own comment).
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
