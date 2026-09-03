import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, waitFor, expect } from "storybook/test";

// Regression test for a real bug: Continue was gated on stale
// lineItems.length/receipts.length while a removal's router.refresh() was
// still in flight, letting a click through with the requirement unmet
// (found live). Fixed via an onPendingChange prop that
// ReceiptManager/LineItemManager report upward.
//
// IMPORTANT LIMITATION: drives a small simulator, not the real
// CreateWizard/ReceiptManager (which call Server Actions with no
// server/database in Storybook's Vite runtime). The simulator's "remove"
// resolves after a delay, not synchronously, to actually reproduce the
// timing gap. Proves the *pattern* is correct, not that RequestDrawer.tsx
// still implements it the same way -- that needs a real end-to-end check.
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
