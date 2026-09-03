import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoneyStat } from "@/components/MoneyStat";
import { ApprovalTimeline } from "@/components/requests/RequestProgressDrawer";
import type { RequestProgressApprovalView } from "@/lib/request-data";

// The fuller assembled view a requester sees in RequestProgressDrawer.tsx
// -- total, an optional celebration panel, then the timeline -- rather
// than the timeline alone (see Components/ApprovalTimeline).
//
// This is also where the "general user" vs. "requester holds the
// required approval role" contrast becomes visible -- the wizard steps
// (Patterns/ReimbursementForm) look identical either way; only the
// resulting timeline differs, since a tier the requester is the
// designated approver for shows AUTO_SATISFIED instead.
type Variant = "generalUserInProgress" | "generalUserApproved" | "selfSubmittedByOverseer";

function ApprovalProgressPattern({ variant }: { variant: Variant }) {
  const approvals: RequestProgressApprovalView[] =
    variant === "generalUserApproved"
      ? [
          { role: "COS1", approverName: "Alex Approver", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z", comments: null },
          { role: "COS2", approverName: "Jordan Reyes", status: "APPROVED", decidedAt: "2026-08-29T04:30:00.000Z", comments: null },
          { role: "FINANCE_OVERSEER", approverName: "Morgan Cruz", status: "APPROVED", decidedAt: "2026-08-30T01:00:00.000Z", comments: null },
        ]
      : variant === "generalUserInProgress"
        ? [
            { role: "COS1", approverName: "Alex Approver", status: "APPROVED", decidedAt: "2026-08-28T02:00:00.000Z", comments: null },
            { role: "COS2", approverName: null, status: "PENDING", decidedAt: null, comments: null },
            { role: "FINANCE_OVERSEER", approverName: null, status: "PENDING", decidedAt: null, comments: null },
          ]
        : [
            // The requester submitted their own Comms & Media request --
            // Ministry Overseer is auto-satisfied instead of asking them
            // to approve their own reimbursement; COS1 still requires a
            // genuinely independent decision, same as anyone else's
            // tier-2 request.
            {
              role: "MINISTRY_OVERSEER",
              approverName: "Taylor Santos",
              status: "AUTO_SATISFIED",
              decidedAt: "2026-08-28T02:00:00.000Z",
              comments: "Auto-satisfied: requester is the designated Ministry Overseer for this request.",
            },
            { role: "COS1", approverName: null, status: "PENDING", decidedAt: null, comments: null },
          ];

  const approved = variant === "generalUserApproved";

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
          <p className="mt-1 font-mono text-xs text-slate-500">Voucher #CCF-20260902-0123</p>
        </div>
      )}

      <MoneyStat label="Total reimbursement" amount={variant === "selfSubmittedByOverseer" ? "1,200.00" : "785.50"} />

      <ApprovalTimeline
        approvals={approvals}
        ministryType={variant === "selfSubmittedByOverseer" ? "COMMS_MEDIA" : "PASTORAL_CARE"}
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

export const GeneralUserInProgress: Story = { args: { variant: "generalUserInProgress" } };
export const GeneralUserApproved: Story = { args: { variant: "generalUserApproved" } };
export const SelfSubmittedByOverseerAutoSatisfied: Story = { args: { variant: "selfSubmittedByOverseer" } };
