import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getMyRequests, getDraftRequest } from "@/lib/request-data";
import { RequestsTable } from "@/components/requests/RequestsTable";

export const dynamic = "force-dynamic";

export default async function RequestsPage(props: PageProps<"/requests">) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const searchParams = await props.searchParams;
  const openId = typeof searchParams.open === "string" ? searchParams.open : null;

  const [requests, openRequest] = await Promise.all([
    getMyRequests(userId),
    openId ? getDraftRequest(openId, userId) : Promise.resolve(null),
  ]);

  return <RequestsTable requests={requests} openRequest={openRequest} />;
}
