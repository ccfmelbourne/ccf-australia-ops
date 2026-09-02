import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent } from "storybook/test";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { MoneyStat } from "@/components/MoneyStat";

// Full approver-side flow as ONE story -- a play() function clicks
// through the pending-approvals list, opens an approval, signs, and
// approves it, automatically. Drives a small self-contained simulator
// with local state, not the real ApprovalsTable/ApprovalDrawer -- those
// call real Server Actions (decideApprovalAction) on click, which have no
// real Next.js server or database behind them in Storybook's Vite
// runtime. "Signing" is simplified to a button rather than actually
// automating canvas drawing, which isn't practical to script meaningfully
// here.
//
// ApprovalDrawer only ever shows the one role being decided -- it doesn't
// surface whether an earlier tier was auto-satisfied (that's the
// requester's own progress view's job, Patterns/ApprovalProgress), so
// there's only one variant of this flow.
function ApprovalFlowSimulator() {
  const [opened, setOpened] = useState(false);
  const [signed, setSigned] = useState(false);
  const [decided, setDecided] = useState(false);

  if (decided) {
    return (
      <p className="max-w-xl rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">
        Approved -- CCF-20260902-0124 moves on to Finance Overseer.
      </p>
    );
  }

  if (!opened) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-900">Approvals</h2>
        <ul className="flex flex-col gap-2">
          <li>
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 p-4 text-left hover:bg-slate-50"
            >
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-700">CCF-20260902-0124</span>
                  <RequestStatusBadge status="IN_APPROVAL" />
                </span>
                <span className="text-xs text-slate-500">Jane Smith · Reimbursement · Pastoral Care</span>
              </span>
              <span className="font-mono text-lg font-bold text-slate-900">$1,200.00</span>
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">CCF-20260902-0124</h2>
          <RequestStatusBadge status="IN_APPROVAL" />
        </span>
      </div>

      <MoneyStat label="Total amount" amount="1,200.00" />

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-slate-500">Requester</dt>
        <dd>Jane Smith</dd>
        <dt className="text-slate-500">Your role</dt>
        <dd>COS 1</dd>
      </dl>

      <div className="flex flex-col gap-1">
        <label htmlFor="sim-comment" className="text-sm font-medium text-slate-700">
          Comment (required to reject or request changes)
        </label>
        <textarea id="sim-comment" rows={3} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Sign to approve</label>
        </div>
        <button
          type="button"
          onClick={() => setSigned(true)}
          className="flex h-40 w-full items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-500"
        >
          {signed ? "✓ Signed" : "Simulate signature"}
        </button>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={!signed}
          onClick={() => setDecided(true)}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Approve
        </button>
        <button type="button" className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600">
          Reject
        </button>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/ApprovalFlow",
};
export default meta;

type Story = StoryObj;

export const FullApprovalFlow: Story = {
  render: () => <ApprovalFlowSimulator />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /CCF-20260902-0124/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Simulate signature" }));
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
  },
};
