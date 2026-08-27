import { notFound } from "next/navigation";
import { getRequestDetail } from "@/lib/finance-data";
import { RequestDetailView } from "@/components/finance/RequestDetailView";
import { updateRequestStatusAction } from "@/app/finance/actions";

export const dynamic = "force-dynamic";

export default async function FinanceRequestDetailPage(props: PageProps<"/finance/[id]">) {
  const { id } = await props.params;
  const request = await getRequestDetail(id);

  if (!request) {
    notFound();
  }

  return <RequestDetailView request={request} onTransition={updateRequestStatusAction} />;
}
