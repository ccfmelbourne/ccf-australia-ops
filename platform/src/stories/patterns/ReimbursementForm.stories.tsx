import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent } from "storybook/test";
import { WizardSteps } from "@/components/requests/WizardSteps";
import { ReviewStep } from "@/components/requests/ReviewStep";
import { ApprovalTimeline } from "@/components/requests/RequestProgressDrawer";
import type { DraftRequestView, RequestProgressApprovalView } from "@/lib/request-data";

// Full create-request flow as ONE story each -- a play() function drives
// the actual clicks/typing through every step automatically, rather than
// four separate static per-step snapshots. The wizard steps themselves
// don't differ based on who's submitting; the only difference (a tier
// auto-satisfied because the requester holds the required role) shows up
// in the approval timeline shown after "submitting," which is why each
// flow ends there instead of just closing.
//
// This drives a small self-contained simulator with its own local state,
// not the real CreateWizard/RequestDrawer -- those call real Server
// Actions on every interaction (add line item, save bank details,
// submit), which have no real Next.js server or database behind them in
// Storybook's Vite runtime. The simulator uses request type CASH_ADVANCE
// so no receipt step is needed, keeping the automated interaction focused
// on the parts that matter here (details -> line item -> bank details ->
// review -> submit).
type SimStep = 1 | 2 | 3 | 4;

function ReimbursementFlowSimulator({ endingVariant }: { endingVariant: "general" | "ministryOverseer" }) {
  const [step, setStep] = useState<SimStep>(1);
  const [furthestStep, setFurthestStep] = useState<SimStep>(1);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([]);
  const [accountName, setAccountName] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankSaved, setBankSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalAmount = lineItems
    .reduce((sum, li) => sum + Number(li.amount || 0), 0)
    .toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function goNext() {
    const next = Math.min(step + 1, 4) as SimStep;
    setStep(next);
    setFurthestStep((f) => (next > f ? next : f));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 1) as SimStep);
  }
  function addLineItem() {
    if (!description || !amount) return;
    setLineItems((prev) => [...prev, { description, amount }]);
    setDescription("");
    setAmount("");
  }
  function saveBankDetails() {
    if (!accountName || !bsb || !accountNumber) return;
    setBankSaved(true);
  }

  if (submitted) {
    const approvals: RequestProgressApprovalView[] =
      endingVariant === "ministryOverseer"
        ? [
            {
              role: "MINISTRY_OVERSEER",
              approverName: "Dexter Santiago",
              status: "AUTO_SATISFIED",
              decidedAt: new Date().toISOString(),
              comments: "Auto-satisfied: requester is the designated Ministry Overseer for this request.",
            },
            { role: "COS1", approverName: null, status: "PENDING", decidedAt: null, comments: null },
          ]
        : [
            { role: "MINISTRY_OVERSEER", approverName: null, status: "PENDING", decidedAt: null, comments: null },
            { role: "COS1", approverName: null, status: "PENDING", decidedAt: null, comments: null },
          ];
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <p className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">
          Submitted -- here is the resulting approval progress:
        </p>
        <ApprovalTimeline
          approvals={approvals}
          ministryType={endingVariant === "ministryOverseer" ? "COMMS_MEDIA" : "PASTORAL_CARE"}
          regionalDirectorOverrideConfirmedAt={null}
        />
      </div>
    );
  }

  const reviewData: DraftRequestView = {
    id: "story-fixture",
    voucherNo: "CCF-20260902-0123",
    requesterName: endingVariant === "ministryOverseer" ? "Dexter Santiago" : "Jane Smith",
    requestType: "CASH_ADVANCE",
    ministryType: endingVariant === "ministryOverseer" ? "COMMS_MEDIA" : "PASTORAL_CARE",
    totalAmount,
    lineItems: lineItems.map((li, i) => ({ id: String(i), ...li })),
    receipts: [],
    bankDetails: bankSaved ? { accountName, bsb, accountNumber } : null,
    returnReason: null,
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <WizardSteps currentStep={step} furthestStep={furthestStep} onJump={(s) => s <= furthestStep && setStep(s)} />

      {step === 1 && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="sim-request-type" className="text-sm font-medium text-slate-700">
              Request type
            </label>
            <select id="sim-request-type" disabled className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>Cash Advance</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sim-ministry" className="text-sm font-medium text-slate-700">
              Ministry
            </label>
            <select id="sim-ministry" disabled className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>{endingVariant === "ministryOverseer" ? "Comms & Media" : "Pastoral Care"}</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={goNext} className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
              Continue →
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-right font-mono">${li.amount}</td>
                </tr>
              ))}
              {lineItems.length > 0 && (
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 font-semibold">Total</td>
                  <td className="py-2 text-right font-mono font-semibold">${totalAmount}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-description" className="text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                id="sim-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-amount" className="text-sm font-medium text-slate-700">
                Amount
              </label>
              <input
                id="sim-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Add item
            </button>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={goBack} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              ← Back
            </button>
            <button
              type="button"
              disabled={lineItems.length === 0}
              onClick={goNext}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Continue →
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-account-name" className="text-sm font-medium text-slate-700">
                Account name
              </label>
              <input
                id="sim-account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-bsb" className="text-sm font-medium text-slate-700">
                BSB
              </label>
              <input
                id="sim-bsb"
                value={bsb}
                onChange={(e) => setBsb(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-account-number" className="text-sm font-medium text-slate-700">
                Account number
              </label>
              <input
                id="sim-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={saveBankDetails}
              className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save bank details
            </button>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={goBack} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              ← Back
            </button>
            <button
              type="button"
              disabled={!bankSaved}
              onClick={goNext}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Continue →
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <ReviewStep data={reviewData} />
          <div className="flex justify-between">
            <button type="button" onClick={goBack} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Submit reimbursement
            </button>
          </div>
        </>
      )}
    </div>
  );
}

async function playFullFlow(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Continue →" }));
  await userEvent.type(canvas.getByLabelText("Description"), "Conference registration");
  await userEvent.type(canvas.getByLabelText("Amount"), "1200");
  await userEvent.click(canvas.getByRole("button", { name: "Add item" }));
  await userEvent.click(canvas.getByRole("button", { name: "Continue →" }));
  await userEvent.type(canvas.getByLabelText("Account name"), "Jane Smith");
  await userEvent.type(canvas.getByLabelText("BSB"), "123-456");
  await userEvent.type(canvas.getByLabelText("Account number"), "12345678");
  await userEvent.click(canvas.getByRole("button", { name: "Save bank details" }));
  await userEvent.click(canvas.getByRole("button", { name: "Continue →" }));
  await userEvent.click(canvas.getByRole("button", { name: "Submit reimbursement" }));
}

const meta: Meta = {
  title: "Patterns/ReimbursementForm",
};
export default meta;

type Story = StoryObj;

export const SubmittedByGeneralUser: Story = {
  render: () => <ReimbursementFlowSimulator endingVariant="general" />,
  play: async ({ canvasElement }) => playFullFlow(canvasElement),
};

export const SubmittedByMinistryOverseer: Story = {
  render: () => <ReimbursementFlowSimulator endingVariant="ministryOverseer" />,
  play: async ({ canvasElement }) => playFullFlow(canvasElement),
};
