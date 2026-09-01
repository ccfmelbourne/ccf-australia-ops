"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import {
  createDraftRequestForDrawerAction,
  updateRequestDetailsAction,
  submitRequestAction,
  deleteRequestAction,
} from "@/app/requests/actions";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  MINISTRY_TYPES,
  MINISTRY_TYPE_LABELS,
} from "@/lib/request-types";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";
import { LineItemManager } from "./LineItemManager";
import { ReceiptManager } from "./ReceiptManager";
import { BankDetailsManager } from "./BankDetailsManager";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { DraftRequestView } from "@/lib/request-data";

// Sorted alphabetically by label for the dropdowns only -- REQUEST_TYPES/
// MINISTRY_TYPES themselves stay in their original declared order (other
// code, e.g. the voucher PDF's ministry directory, iterates them in that
// order and shouldn't be affected by a dropdown-only display preference).
const SORTED_REQUEST_TYPES = [...REQUEST_TYPES].sort((a, b) =>
  REQUEST_TYPE_LABELS[a].localeCompare(REQUEST_TYPE_LABELS[b]),
);
const SORTED_MINISTRY_TYPES = [...MINISTRY_TYPES].sort((a, b) =>
  MINISTRY_TYPE_LABELS[a].localeCompare(MINISTRY_TYPE_LABELS[b]),
);

// A native <dialog> styled as a right-side panel on wide viewports and a
// full-screen sheet on small ones -- w-full capped by max-w-xl gives that
// responsiveness for free (below ~36rem viewport width it's already full
// width, no separate breakpoint needed). <dialog> gives focus-trapping,
// Escape-to-close, and a backdrop natively, so no new UI dependency.
type RequestDrawerProps =
  | { mode: "create"; onCreated: (data: DraftRequestView) => void; onClose: () => void }
  | { mode: "edit"; data: DraftRequestView; showWizard: boolean; onClose: () => void };

export function RequestDrawer(props: RequestDrawerProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // dialog.close() synchronously fires the native "close" event, which the
  // onClose prop below already handles -- no need to also call
  // props.onClose() here (that would fire it twice).
  function handleClose() {
    dialogRef.current?.close();
  }

  // Every close path (the X button, Escape, a backdrop click, and
  // CreateWizard's own post-submit close) funnels through this one native
  // "close" event -- the single place to catch "closed a fresh draft that
  // never got a single line item" and clean it up instead of leaving an
  // empty row cluttering the requester's own request list (this exact
  // clutter was found and manually cleaned up earlier in this project's
  // history). Scoped to data.returnReason === null (a never-submitted
  // draft -- independent of whether it was shown via the wizard or the
  // flat view, since clicking Edit on an unsubmitted draft now shows flat
  // too) -- a returned request has real submission history and is never
  // deleted just because its line items were edited down to zero before
  // closing. Fire-and-forget: the dialog closes immediately, the
  // delete/refresh happen in the background.
  function handleDialogClose() {
    if (props.mode === "edit" && props.data.returnReason === null && props.data.lineItems.length === 0) {
      deleteRequestAction(props.data.id).then((result) => {
        if (result.ok) router.refresh();
      });
    }
    props.onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleDialogClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      aria-labelledby="drawer-title"
      className="fixed inset-y-0 right-0 m-0 h-dvh w-full max-w-xl overflow-y-auto rounded-l-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 id="drawer-title" className="text-lg font-bold text-slate-900">
          {props.mode === "create" ? "New request" : props.data.voucherNo}
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="text-2xl leading-none text-slate-400 hover:text-slate-600"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-6 pt-4">
        {props.mode === "create" ? (
          <CreateStep onCreated={props.onCreated} />
        ) : props.showWizard ? (
          // The step-by-step wizard is only for the live moment right
          // after clicking "Create Request" (RequestsTable.tsx's
          // openedViaCreate) -- clicking "Edit" on any existing row, even
          // a never-submitted draft, always shows the flat EditContent
          // instead. Confirmed with the decision-maker after an earlier
          // version wrongly kept showing the wizard on every reopen of an
          // unsubmitted draft, not just the initial creation.
          <CreateWizard data={props.data} onClose={handleClose} />
        ) : (
          <EditContent data={props.data} onClose={handleClose} />
        )}
      </div>
    </dialog>
  );
}

// Creates the draft once, immediately, with sensible defaults (the first
// RequestType/MinistryType) rather than waiting for the user to pick both
// fields first. An earlier version created on every dropdown change, which
// raced two picks made in quick succession into two separate drafts (the
// first one silently orphaned) -- found via live testing. Once created,
// the drawer transitions straight into the same EditContent view, where
// changing type/ministry is a single field's own update call with no such
// race. A ref (not just state) guards against React re-invoking the effect
// (e.g. Strict Mode's dev-only double-invoke) from firing a second create.
//
// onCreated receives the full initial DraftRequestView, built right here
// from the action's result, rather than just an id -- the caller used to
// navigate to ?open=<id> and wait for a server round-trip through
// getDraftRequest to fetch back data it could already predict (a fresh
// draft has no line items/receipts/bank details/return reason yet). That
// round-trip created a render where neither this "creating" step nor the
// eventual edit view was mounted, which visibly closed and reopened the
// dialog -- found via live testing.
function CreateStep({ onCreated }: { onCreated: (data: DraftRequestView) => void }) {
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const result = await createDraftRequestForDrawerAction(REQUEST_TYPES[0], MINISTRY_TYPES[0]);
      if (result.ok && result.id && result.voucherNo) {
        onCreated({
          id: result.id,
          voucherNo: result.voucherNo,
          requestType: REQUEST_TYPES[0],
          ministryType: MINISTRY_TYPES[0],
          totalAmount: "0.00",
          lineItems: [],
          receipts: [],
          bankDetails: null,
          returnReason: null,
        });
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return error ? <ErrorBanner message={error} /> : <p className="text-sm text-slate-500">Creating…</p>;
}

// Request type + ministry selects, each change saved immediately via
// updateRequestDetailsAction -- self-contained (owns its own pending/error
// state) so both EditContent and CreateWizard's Details step can drop it
// in without duplicating the change-handling logic.
function RequestDetailsFields({
  requestId,
  requestType,
  ministryType,
}: {
  requestId: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
}) {
  const router = useRouter();
  const [type, setType] = useState(requestType);
  const [ministry, setMinistry] = useState(ministryType);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(nextType: string, nextMinistry: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateRequestDetailsAction(requestId, nextType, nextMinistry);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="requestType" className="text-sm font-medium text-slate-700">
          Request type
        </label>
        <select
          id="requestType"
          value={type}
          disabled={isPending}
          onChange={(e) => {
            setType(e.target.value as typeof type);
            handleChange(e.target.value, ministry);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          {SORTED_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ministryType" className="text-sm font-medium text-slate-700">
          Ministry
        </label>
        <select
          id="ministryType"
          value={ministry}
          disabled={isPending}
          onChange={(e) => {
            setMinistry(e.target.value as typeof ministry);
            handleChange(type, e.target.value);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          {SORTED_MINISTRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {MINISTRY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// The requester's own attestation, captured as the last step before every
// submission (first submission and every resubmission alike) -- same
// canvas/markup as the approver's signature pad (ApprovalDrawer.tsx),
// shared here between EditContent and CreateWizard's Review step so the
// canvas JSX isn't duplicated. The submit handlers themselves stay
// separate (each component already has its own), this only holds the
// pad's ref.
function SignaturePad({ sigPadRef }: { sigPadRef: React.RefObject<SignatureCanvas | null> }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Sign to submit</label>
        <button
          type="button"
          onClick={() => sigPadRef.current?.clear()}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      </div>
      <SignatureCanvas
        ref={sigPadRef}
        canvasProps={{ className: "h-40 w-full rounded-md border border-slate-300 bg-white" }}
      />
    </div>
  );
}

function EditContent({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleSubmit() {
    setSubmitError(null);
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSubmitError("Please sign to submit.");
      return;
    }
    const signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");
    startSubmitTransition(async () => {
      const result = await submitRequestAction(data.id, signatureDataUrl);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setSubmitError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      {data.returnReason && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-800">
            {data.returnReason.decision === "REJECTED" ? "Rejected" : "Changes requested"} by{" "}
            {data.returnReason.actorName}
          </p>
          <p className="mt-1 text-amber-700">{data.returnReason.comments}</p>
        </div>
      )}

      <RequestDetailsFields requestId={data.id} requestType={data.requestType} ministryType={data.ministryType} />

      <LineItemManager
        requestId={data.id}
        lineItems={data.lineItems}
        totalAmount={data.totalAmount}
      />
      <ReceiptManager requestId={data.id} receipts={data.receipts} />
      <BankDetailsManager requestId={data.id} bankDetails={data.bankDetails} />

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <SignaturePad sigPadRef={sigPadRef} />
        {submitError && <ErrorBanner message={submitError} />}
        <button
          type="button"
          disabled={isSubmitPending}
          onClick={handleSubmit}
          className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {isSubmitPending
            ? data.returnReason
              ? "Resubmitting…"
              : "Submitting…"
            : data.returnReason
              ? "Resubmit"
              : "Submit"}
        </button>
      </div>
    </>
  );
}

type WizardStep = 1 | 2 | 3 | 4;

const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  1: "Details",
  2: "Expenses & Receipts",
  3: "Payment",
  4: "Review",
};

// Step pills jump back freely but never ahead of furthestStep -- reaching
// a step earns it, it's not a free-form tab bar.
function WizardSteps({
  currentStep,
  furthestStep,
  onJump,
}: {
  currentStep: WizardStep;
  furthestStep: WizardStep;
  onJump: (step: WizardStep) => void;
}) {
  const steps: WizardStep[] = [1, 2, 3, 4];
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <button
            type="button"
            disabled={step > furthestStep}
            onClick={() => onJump(step)}
            className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 font-semibold disabled:cursor-not-allowed ${
              step === currentStep
                ? "bg-teal-600 text-white"
                : step < furthestStep
                  ? "text-teal-700 hover:bg-teal-50"
                  : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                step === currentStep
                  ? "bg-white text-teal-600"
                  : step <= furthestStep
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {step}
            </span>
            {WIZARD_STEP_LABELS[step]}
          </button>
          {i < steps.length - 1 && <span className="h-px w-3 shrink-0 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function ReviewStep({ data }: { data: DraftRequestView }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Details</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">Type</dt>
          <dd>{REQUEST_TYPE_LABELS[data.requestType]}</dd>
          <dt className="text-slate-500">Ministry</dt>
          <dd>{MINISTRY_TYPE_LABELS[data.ministryType]}</dd>
        </dl>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Expenses</p>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {data.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-slate-100">
                <td className="py-1">{li.description}</td>
                <td className="py-1 text-right font-mono">${li.amount}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 font-semibold">Total</td>
              <td className="py-1 text-right font-mono font-semibold">${data.totalAmount}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Receipts</p>
        {data.receipts.length === 0 ? (
          <p className="text-sm text-slate-500">
            {data.requestType === "CASH_ADVANCE" ? "Not required for cash advances." : "None attached."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {data.receipts.map((r) => (
              <li key={r.id} className="truncate font-mono text-slate-700">
                {r.filename}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.bankDetails && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bank details
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Account name</dt>
            <dd>{data.bankDetails.accountName}</dd>
            <dt className="text-slate-500">BSB</dt>
            <dd>{data.bankDetails.bsb}</dd>
            <dt className="text-slate-500">Account number</dt>
            <dd>{data.bankDetails.accountNumber}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

// The step-by-step flow for a fresh draft (RequestDrawer picks this over
// EditContent when data.returnReason is null -- see the comment there).
// Each field still saves immediately through its own existing action
// (LineItemManager/ReceiptManager/BankDetailsManager/RequestDetailsFields
// are all reused unchanged) -- this component only adds step navigation on
// top, it doesn't introduce a new batch-save mechanism. "Continue" is
// gated by the same three checks submitRequest itself makes at submit
// time (at least one line item, a receipt, bank details) -- surfaced
// earlier instead of only failing at the very end.
function CreateWizard({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(1);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function goTo(step: WizardStep) {
    if (step > furthestStep) return;
    setCurrentStep(step);
  }

  function goNext() {
    const next = Math.min(currentStep + 1, 4) as WizardStep;
    setCurrentStep(next);
    setFurthestStep((f) => (next > f ? next : f));
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 1) as WizardStep);
  }

  function handleSubmit() {
    setSubmitError(null);
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSubmitError("Please sign to submit.");
      return;
    }
    const signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");
    startSubmitTransition(async () => {
      const result = await submitRequestAction(data.id, signatureDataUrl);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setSubmitError(result.error ?? "Something went wrong.");
      }
    });
  }

  // Receipts moved into the same step as line items -- a receipt upload
  // now auto-creates its own line item (ReceiptManager.tsx), so this is
  // where a requester actually builds up their expenses, not a separate
  // step reached later. Cash advances are requested before the money's
  // spent -- nothing to attach a receipt for yet (mirrors submitRequest's
  // own check, request-data.ts).
  const receiptRequired = data.requestType !== "CASH_ADVANCE";
  const canContinueFromExpenses =
    data.lineItems.length > 0 && (!receiptRequired || data.receipts.length > 0);
  const canContinueFromPayment = data.bankDetails !== null;

  const backButton = (
    <button
      type="button"
      onClick={goBack}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      ← Back
    </button>
  );

  return (
    <>
      <WizardSteps currentStep={currentStep} furthestStep={furthestStep} onJump={goTo} />

      {currentStep === 1 && (
        <>
          <RequestDetailsFields
            requestId={data.id}
            requestType={data.requestType}
            ministryType={data.ministryType}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={goNext}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Continue →
            </button>
          </div>
        </>
      )}

      {currentStep === 2 && (
        <>
          <ReceiptManager requestId={data.id} receipts={data.receipts} />
          <LineItemManager requestId={data.id} lineItems={data.lineItems} totalAmount={data.totalAmount} />
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              {backButton}
              <button
                type="button"
                disabled={!canContinueFromExpenses}
                onClick={goNext}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                Continue →
              </button>
            </div>
            {!canContinueFromExpenses && (
              <p className="text-right text-xs text-slate-500">
                {data.lineItems.length === 0
                  ? "Add at least one expense to continue."
                  : "Attach a receipt to continue."}
              </p>
            )}
          </div>
        </>
      )}

      {currentStep === 3 && (
        <>
          <BankDetailsManager requestId={data.id} bankDetails={data.bankDetails} />
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              {backButton}
              <button
                type="button"
                disabled={!canContinueFromPayment}
                onClick={goNext}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                Continue →
              </button>
            </div>
            {!canContinueFromPayment && (
              <p className="text-right text-xs text-slate-500">Save bank details to continue.</p>
            )}
          </div>
        </>
      )}

      {currentStep === 4 && (
        <>
          <ReviewStep data={data} />
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
            <SignaturePad sigPadRef={sigPadRef} />
            {submitError && <ErrorBanner message={submitError} />}
            <div className="flex justify-between">
              {backButton}
              <button
                type="button"
                disabled={isSubmitPending}
                onClick={handleSubmit}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {isSubmitPending ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
