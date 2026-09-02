import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoneyStat } from "@/components/MoneyStat";
import { ApprovalTimeline } from "@/components/requests/RequestProgressDrawer";
import type { RequestProgressApprovalView } from "@/lib/request-data";

// The fuller assembled view a requester actually sees in
// RequestProgressDrawer.tsx -- total, an optional celebration panel, then
// the timeline -- rather than the timeline alone (see
// Components/ApprovalTimeline for that in isolation).
function ApprovalProgressPattern({ approved }: { approved: boolean }) {
  const approvals: RequestProgressApprovalView[] = approved
    ? [
        { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z" },
        { role: "COS2", approverName: "Joel Jerez", status: "APPROVED", decidedAt: "2026-08-29T04:30:00.000Z" },
        { role: "FINANCE_OVERSEER", approverName: "Vamie Pinlac", status: "APPROVED", decidedAt: "2026-08-30T01:00:00.000Z" },
      ]
    : [
        { role: "COS1", approverName: "Ross Callado", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z" },
        { role: "COS2", approverName: null, status: "PENDING", decidedAt: null },
        { role: "FINANCE_OVERSEER", approverName: null, status: "PENDING", decidedAt: null },
      ];

  return (
    <div className="flex max-w-md flex-col gap-6">
      {approved && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 p-6 text-center">
          <span
            aria-hidden
            className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white"
          >
            ✓
          </span>
          <p className="text-base font-bold text-slate-900">Reimbursement approved</p>
          <p className="max-w-xs text-sm text-slate-600">
            All required approvals are complete. Finance will now process your request.
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">Voucher #DV-2026-0123</p>
        </div>
      )}

      <MoneyStat label="Total reimbursement" amount="785.50" />

      <ApprovalTimeline
        approvals={approvals}
        ministryType="PASTORAL_CARE"
        regionalDirectorOverrideConfirmedAt={null}
      />
    </div>
  );
}

const meta: Meta<typeof ApprovalProgressPattern> = {
  title: "Patterns/ApprovalProgress",
  component: ApprovalProgressPattern,
};
export default meta;

type Story = StoryObj<typeof ApprovalProgressPattern>;

export const InProgress: Story = { args: { approved: false } };
export const Approved: Story = { args: { approved: true } };
