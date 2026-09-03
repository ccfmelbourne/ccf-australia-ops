import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, waitFor, expect } from "storybook/test";

// Regression test for a real, live-reported bug: the wizard's Expenses &
// Receipts step gated its "Continue" button on lineItems.length/
// receipts.length read straight from the last-known data -- but removing
// a receipt (or line item) is a server round-trip followed by
// router.refresh(), and the button had no way to know a removal was still
// in flight. Clicking Continue in that window advanced to the next step
// with the requirement no longer actually met (found live: upload a
// receipt, add an item, remove the receipt, click Continue immediately --
// it let you through with zero receipts attached). Fixed by having
// ReceiptManager/LineItemManager report their own isPending upward via an
// onPendingChange prop, which RequestDrawer.tsx's CreateWizard factors
// into canContinueFromExpenses.
//
// This drives a small simulator, not the real CreateWizard/ReceiptManager
// -- those call real Server Actions with no server/database behind them
// in Storybook's Vite runtime (see Patterns/ReimbursementForm's own
// comment). The simulator's "remove" deliberately resolves after a delay
// instead of synchronously, to reproduce the actual timing gap the real
// bug lived in -- a synchronous fake remove could never race the button
// at all, which would defeat the point of this test. This proves the
// *pattern* (a busy flag from an in-flight removal must gate Continue) is
// correct and stays correct; it is not, on its own, proof that the real
// RequestDrawer.tsx still implements it the same way -- that still needs
// a real end-to-end check against the actual app.
function ExpensesStepSimulator() {
  const [lineItems] = useState([{ id: "1", description: "Taxi fare", amount: "45.00" }]);
  const [receipts, setReceipts] = useState([{ id: "1", filename: "taxi-receipt.jpg" }]);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  function removeReceipt(id: string) {
    setBusy(true);
    setTimeout(() => {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      setBusy(false);
    }, 300);
  }

  const canContinue = lineItems.length > 0 && receipts.length > 0 && !busy;

  if (advanced) {
    return <p className="text-sm font-semibold text-teal-700">Advanced to the Payment step.</p>;
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <ul className="text-sm">
        {lineItems.map((li) => (
          <li key={li.id}>
            {li.description} -- ${li.amount}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1 text-sm">
        {receipts.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span>{r.filename}</span>
            <button type="button" onClick={() => removeReceipt(r.id)} className="text-red-600 hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!canContinue}
        onClick={() => setAdvanced(true)}
        className="self-end rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        Continue →
      </button>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/ExpensesStepRace",
};
export default meta;

type Story = StoryObj;

export const RemovingReceiptBlocksContinue: Story = {
  render: () => <ExpensesStepSimulator />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const continueButton = canvas.getByRole("button", { name: "Continue →" });
    await expect(continueButton).toBeEnabled();

    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
    // The bug: Continue stayed enabled right here, on stale data, for the
    // ~300ms the simulated removal takes to actually resolve.
    await expect(continueButton).toBeDisabled();

    await waitFor(() => expect(canvas.queryByText("taxi-receipt.jpg")).toBeNull());
    await expect(continueButton).toBeDisabled();
  },
};
