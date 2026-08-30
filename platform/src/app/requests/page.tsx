import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getMyRequests, getDraftRequest } from "@/lib/request-data";
import { getPendingApprovalsForUser } from "@/lib/approval-data";
import { RequestsTable } from "@/components/requests/RequestsTable";
import { ApprovalsTable } from "@/components/approvals/ApprovalsTable";

export const dynamic = "force-dynamic";

// Single landing page after sign-in: approvals awaiting this person (if
// any) above their own requests table -- one person can be both a
// requester and an approver, so both need to be visible without switching
// pages.
export default async function RequestsPage(props: PageProps<"/requests">) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const searchParams = await props.searchParams;
  const openId = typeof searchParams.open === "string" ? searchParams.open : null;

  const [requests, openRequest, approvals] = await Promise.all([
    getMyRequests(userId),
    openId ? getDraftRequest(openId, userId) : Promise.resolve(null),
    getPendingApprovalsForUser(userId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <ApprovalsTable approvals={approvals} />
      <RequestsTable requests={requests} openRequest={openRequest} />
    </div>
  );
}
