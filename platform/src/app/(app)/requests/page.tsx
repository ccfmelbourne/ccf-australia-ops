import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getMyRequests, getDraftRequest, getRequestProgress } from "@/lib/request-data";
import { RequestsTable } from "@/components/requests/RequestsTable";

export const dynamic = "force-dynamic";

// Approvals and the Regional Director override now render on their own
// /approvals page -- this is just the requester's own requests, which is
// what actually needed the ?open=/?progress= drawer plumbing below.
export default async function RequestsPage(props: PageProps<"/requests">) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const searchParams = await props.searchParams;
  const openId = typeof searchParams.open === "string" ? searchParams.open : null;
  const progressId = typeof searchParams.progress === "string" ? searchParams.progress : null;

  const [requests, openRequest, progressRequest] = await Promise.all([
    getMyRequests(userId),
    openId ? getDraftRequest(openId, userId) : Promise.resolve(null),
    progressId ? getRequestProgress(progressId, userId) : Promise.resolve(null),
  ]);

  return <RequestsTable requests={requests} openRequest={openRequest} progressRequest={progressRequest} />;
}
