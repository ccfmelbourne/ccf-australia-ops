import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/Button";

// Documents the app's two confirmation moments: a pre-action "are you
// sure" popup (RequestDrawer.tsx's SubmitConfirmDialog -- shown here as a
// static card rather than its real overlay+backdrop, since each Storybook
// story already renders in its own isolated canvas) and a post-action
// success panel (RequestProgressDrawer.tsx, shown once a request reaches
// APPROVED).
function ConfirmCard() {
  return (
    <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
      <h3 className="text-base font-bold text-slate-900">Submit reimbursement?</h3>
      <p className="mt-2 text-sm text-slate-600">
        Your request will be sent to the required approvers for review.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button>Submit request</Button>
      </div>
    </div>
  );
}

function SuccessPanel() {
  return (
    <div className="flex max-w-sm flex-col items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 p-6 text-center">
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
      <p className="mt-1 font-mono text-xs text-slate-500">Voucher #CCF-20260902-0124</p>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/ConfirmationStates",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const BeforeSubmit: Story = {
  render: () => <ConfirmCard />,
};

export const AfterApproval: Story = {
  render: () => <SuccessPanel />,
};
