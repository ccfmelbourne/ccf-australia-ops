import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { getDraftRequest } from "@/lib/request-data";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { LineItemManager } from "@/components/requests/LineItemManager";
import { ReceiptManager } from "@/components/requests/ReceiptManager";

export const dynamic = "force-dynamic";

export default async function DraftRequestPage(props: PageProps<"/requests/[id]">) {
  const { id } = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  const request = await getDraftRequest(id, userId);
  if (!request) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-slate-900">{request.voucherNo}</h1>
        <p className="text-slate-500">
          {REQUEST_TYPE_LABELS[request.requestType]} · {MINISTRY_TYPE_LABELS[request.ministryType]}
        </p>
      </div>

      <LineItemManager
        requestId={request.id}
        lineItems={request.lineItems}
        totalAmount={request.totalAmount}
      />

      <ReceiptManager requestId={request.id} receipts={request.receipts} />
    </div>
  );
}
