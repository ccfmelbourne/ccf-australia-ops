import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import {
  getMyRequests,
  getDraftRequest,
  getRequestProgress,
  getRegionalDirectorOverrideOpportunities,
} from "@/lib/request-data";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { ApprovalsTable } from "@/components/approvals/ApprovalsTable";
import { RegionalDirectorOverride } from "@/components/approvals/RegionalDirectorOverride";

export const dynamic = "force-dynamic";

// Single landing page after sign-in: approvals awaiting this person (if
// any) above their own requests table -- one person can be both a
// requester and an approver, so both need to be visible without switching
// pages. The Regional Director override section is similarly scoped to
// whoever's signed in -- getRegionalDirectorOverrideOpportunities returns
// [] for anyone who isn't Ross Callado, so almost no one ever sees it.
export default async function RequestsPage(props: PageProps<"/requests">) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const searchParams = await props.searchParams;
  const openId = typeof searchParams.open === "string" ? searchParams.open : null;
  const progressId = typeof searchParams.progress === "string" ? searchParams.progress : null;

  const [requests, openRequest, progressRequest, approvals, overrideOpportunities] = await Promise.all([
    getMyRequests(userId),
    openId ? getDraftRequest(openId, userId) : Promise.resolve(null),
    progressId ? getRequestProgress(progressId, userId) : Promise.resolve(null),
    getPendingApprovalsForUser(userId),
    getRegionalDirectorOverrideOpportunities(userId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <RegionalDirectorOverride opportunities={overrideOpportunities} />
      <ApprovalsTable approvals={approvals} />
      <RequestsTable requests={requests} openRequest={openRequest} progressRequest={progressRequest} />
    </div>
  );
}
