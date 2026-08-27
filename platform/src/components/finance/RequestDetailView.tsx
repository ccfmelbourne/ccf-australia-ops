import type { FinanceStatus, RequestDetailView as RequestDetailViewType } from "@/types/finance";
import { StatusBadge } from "./StatusBadge";
import { ApprovalHistoryList } from "./ApprovalHistoryList";
import { StatusTransitionForm } from "./StatusTransitionForm";

export function RequestDetailView({
  request,
  onTransition,
}: {
  request: RequestDetailViewType;
  onTransition: (requestId: string, toStatus: FinanceStatus) => Promise<{ ok: boolean; error?: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-slate-900">{request.voucherNo}</h1>
          <p className="text-slate-500">
            {request.requesterName} · {request.ministryType} · {request.requestType}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Line items
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {request.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-slate-100">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right font-mono">${li.amount}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right font-mono font-semibold">${request.totalAmount}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Receipts
        </h2>
        {request.receipts.length === 0 ? (
          <p className="text-sm text-slate-500">No receipts attached.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {request.receipts.map((r) => (
              <li key={r.id} className="font-mono text-teal-700">
                {r.storageKey}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Approval history
        </h2>
        <ApprovalHistoryList entries={request.approvalHistory} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Finance action
        </h2>
        <StatusTransitionForm
          requestId={request.id}
          currentStatus={request.status}
          onTransition={onTransition}
        />
      </section>
    </div>
  );
}
