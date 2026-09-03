import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { getTier, getRequiredApproverRoles } from "@/lib/approval-routing";
import { MoneyStat } from "@/components/MoneyStat";
import type { DraftRequestView } from "@/lib/request-data";

// Masks all but the last 4 digits -- the review step's job here is to give
// the requester confidence they're about to submit the right thing, not to
// re-display sensitive account details in full a second time right before
// submission.
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return "•".repeat(Math.max(accountNumber.length - 4, 0)) + " " + last4;
}

// A confidence-building summary, not a re-display of every detail already
// confirmed in earlier steps -- counts for expenses/receipts and a masked
// account number. Kept in its own file, like WizardSteps.tsx, so Storybook
// can story it without pulling in RequestDrawer.tsx's Server Action imports.
export function ReviewStep({ data }: { data: DraftRequestView }) {
  const tier = getTier(Number(data.totalAmount.replace(/,/g, "")));
  const approverCount = getRequiredApproverRoles(tier).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-bold text-slate-900">Review reimbursement</p>
        <div className="mt-3 border-t border-slate-200" />
      </div>

      <MoneyStat label="Total" amount={data.totalAmount} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
        <dt className="text-slate-500">Requester</dt>
        <dd className="font-medium text-slate-900">{data.requesterName}</dd>
        <dt className="text-slate-500">Type</dt>
        <dd className="font-medium text-slate-900">{REQUEST_TYPE_LABELS[data.requestType]}</dd>
        <dt className="text-slate-500">Ministry</dt>
        <dd className="font-medium text-slate-900">{MINISTRY_TYPE_LABELS[data.ministryType]}</dd>
        <dt className="text-slate-500">Expenses</dt>
        <dd className="font-medium text-slate-900">
          {data.lineItems.length} item{data.lineItems.length === 1 ? "" : "s"}
        </dd>
        <dt className="text-slate-500">Receipts</dt>
        <dd className="font-medium text-slate-900">
          {data.receipts.length > 0
            ? `${data.receipts.length} attached`
            : data.requestType === "CASH_ADVANCE"
              ? "Not required"
              : "None attached"}
        </dd>
        <dt className="text-slate-500">Approval route</dt>
        <dd className="font-medium text-slate-900">
          {approverCount} approver{approverCount === 1 ? "" : "s"}
        </dd>
        {data.bankDetails && (
          <>
            <dt className="text-slate-500">Bank account</dt>
            <dd className="font-mono font-medium text-slate-900">
              {maskAccountNumber(data.bankDetails.accountNumber)}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
