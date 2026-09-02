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
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { Skeleton } from "@/components/Skeleton";
import { WizardSteps } from "./WizardSteps";
import type { WizardStep } from "./WizardSteps";
import { ReviewStep } from "./ReviewStep";
import type { DraftRequestView } from "@/lib/request-data";

// Mirrors submitRequest's own preconditions (request-data.ts), in the same
// order, so a blocking problem surfaces as an inline error right when
// Submit is clicked -- before the confirm dialog opens -- rather than only
// after confirming. The wizard's own step gating (canContinueFromExpenses/
// canContinueFromPayment) already stops most of this at the Continue
// button, but it's re-checked here too: jumping back via the step pills to
// remove a receipt or line item, then jumping forward to Review again,
// bypasses that gate without re-validating it. The flat edit view
// (EditContent) has no such per-step gating at all, so this is the only
// check it gets before submitting.
function getSubmitBlockingError(data: DraftRequestView): string | null {
  if (data.lineItems.length === 0) return "Add at least one line item before submitting.";
  if (!data.bankDetails) return "Add bank details before submitting.";
  if (data.requestType !== "CASH_ADVANCE" && data.receipts.length === 0) {
    return "Attach at least one receipt before submitting.";
  }
  return null;
}

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
  // closing. The native dialog itself has already closed by the time this
  // fires (that part is instant, browser-native), but props.onClose() is
  // awaited until the delete finishes -- it's what tells RequestsTable to
  // drop the `open` query param and re-fetch the table. Calling it before
  // the delete lands used to show the still-there draft row for a moment,
  // then remove it visibly a beat later once a second refresh caught up --
  // found via the decision-maker actually watching it happen. Awaiting
  // first means the table's one and only re-fetch already reflects the
  // row being gone.
  async function handleDialogClose() {
    if (props.mode === "edit" && props.data.returnReason === null && props.data.lineItems.length === 0) {
      await deleteRequestAction(props.data.id);
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
      className="drawer-panel fixed inset-y-0 right-0 m-0 h-dvh w-full max-w-xl overflow-y-auto rounded-l-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="flex items-center gap-2">
          <h2 id="drawer-title" className="text-lg font-bold text-slate-900">
            {props.mode === "create" ? "New request" : props.data.voucherNo}
          </h2>
          {/* DraftRequestView doesn't carry a status field directly --
              getDraftRequest only ever returns DRAFT/NEEDS_CLARIFICATION/
              REJECTED_RETURNED, and returnReason already distinguishes
              which, the same way EditContent's own banner below does. */}
          {props.mode === "edit" && (
            <RequestStatusBadge
              status={
                props.data.returnReason === null
                  ? "DRAFT"
                  : props.data.returnReason.decision === "REJECTED"
                    ? "REJECTED_RETURNED"
                    : "NEEDS_CLARIFICATION"
              }
            />
          )}
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="-m-2 p-2 text-2xl leading-none text-slate-500 hover:text-slate-700"
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
      // Belt-and-suspenders alongside the action's own try/catch -- a
      // transport-level failure calling the action at all (not just a
      // failure inside it) would otherwise reject this promise with
      // nothing here to catch it, leaving the skeleton showing forever
      // instead of an actual error the requester can see.
      try {
        const result = await createDraftRequestForDrawerAction(REQUEST_TYPES[0], MINISTRY_TYPES[0]);
        if (result.ok && result.id && result.voucherNo && result.requesterName) {
          onCreated({
            id: result.id,
            voucherNo: result.voucherNo,
            requesterName: result.requesterName,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shaped like the wizard's step 1 (WizardSteps pills + the two
  // RequestDetailsFields selects) -- a fresh draft always transitions
  // straight into that view once created, so the skeleton previews it
  // instead of a generic spinner.
  return error ? (
    <ErrorBanner message={error} />
  ) : (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
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
          className="-m-1 p-1 text-xs font-medium text-slate-500 hover:text-slate-700"
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

// A second, stacked native <dialog> -- browsers support multiple top-layer
// modals, each showModal() pushes above the last, so this opens on top of
// RequestDrawer's own <dialog> without any manual z-index/positioning.
// Submitting a request can't be undone once approvers start deciding on
// it, so this is a deliberate extra "are you sure" step rather than firing
// straight off the Review step's Submit button.
function SubmitConfirmDialog({
  isResubmit,
  isPending,
  onConfirm,
  onCancel,
}: {
  isResubmit: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      aria-labelledby="submit-confirm-title"
      className="m-auto w-full max-w-sm rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <h3 id="submit-confirm-title" className="text-base font-bold text-slate-900">
        {isResubmit ? "Resubmit reimbursement?" : "Submit reimbursement?"}
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        Your request will be sent to the required approvers for review.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onConfirm}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {isPending ? "Submitting…" : isResubmit ? "Resubmit request" : "Submit request"}
        </button>
      </div>
    </dialog>
  );
}

function EditContent({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSubmitClick() {
    setSubmitError(null);
    const blockingError = getSubmitBlockingError(data);
    if (blockingError) {
      setSubmitError(blockingError);
      return;
    }
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSubmitError("Please sign to submit.");
      return;
    }
    setShowConfirm(true);
  }

  function handleConfirmedSubmit() {
    // Signature was already validated non-empty in handleSubmitClick, and
    // the canvas hasn't been touched since (the confirm dialog has no
    // "back to edit" path that would let it change) -- safe to read again.
    const signatureDataUrl = sigPadRef.current!.getTrimmedCanvas().toDataURL("image/png");
    startSubmitTransition(async () => {
      const result = await submitRequestAction(data.id, signatureDataUrl);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setShowConfirm(false);
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

      <div className="flex flex-col divide-y divide-slate-200">
        <div className="pb-6">
          <LineItemManager
            requestId={data.id}
            lineItems={data.lineItems}
            totalAmount={data.totalAmount}
          />
        </div>
        <div className="py-6">
          <ReceiptManager requestId={data.id} receipts={data.receipts} />
        </div>
        <div className="pt-6">
          <BankDetailsManager requestId={data.id} bankDetails={data.bankDetails} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <SignaturePad sigPadRef={sigPadRef} />
        {submitError && <ErrorBanner message={submitError} />}
        <button
          type="button"
          disabled={isSubmitPending}
          onClick={handleSubmitClick}
          className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {data.returnReason ? "Resubmit" : "Submit"}
        </button>
      </div>

      {showConfirm && (
        <SubmitConfirmDialog
          isResubmit={data.returnReason !== null}
          isPending={isSubmitPending}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

// WizardSteps and ReviewStep now live in their own files
// (WizardSteps.tsx, ReviewStep.tsx) -- pulled out so Storybook can story
// these pure, presentation-only pieces without also pulling in the
// Server Action imports (and their Prisma dependency graph) this file
// carries. CreateWizard below still imports and uses both.

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
  const [showConfirm, setShowConfirm] = useState(false);

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

  function handleSubmitClick() {
    setSubmitError(null);
    const blockingError = getSubmitBlockingError(data);
    if (blockingError) {
      setSubmitError(blockingError);
      return;
    }
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSubmitError("Please sign to submit.");
      return;
    }
    setShowConfirm(true);
  }

  function handleConfirmedSubmit() {
    // Signature was already validated non-empty in handleSubmitClick, and
    // the confirm dialog has no path back to the canvas that would let it
    // change -- safe to read again.
    const signatureDataUrl = sigPadRef.current!.getTrimmedCanvas().toDataURL("image/png");
    startSubmitTransition(async () => {
      const result = await submitRequestAction(data.id, signatureDataUrl);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setShowConfirm(false);
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
          <div className="flex flex-col divide-y divide-slate-200">
            <div className="pb-6">
              <ReceiptManager requestId={data.id} receipts={data.receipts} />
            </div>
            <div className="pt-6">
              <LineItemManager requestId={data.id} lineItems={data.lineItems} totalAmount={data.totalAmount} />
            </div>
          </div>
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
                onClick={handleSubmitClick}
                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                Submit reimbursement
              </button>
            </div>
          </div>
        </>
      )}

      {showConfirm && (
        <SubmitConfirmDialog
          isResubmit={false}
          isPending={isSubmitPending}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
