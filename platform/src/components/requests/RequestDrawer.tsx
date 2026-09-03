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
import { CloseButton } from "./CloseButton";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { WizardSteps } from "./WizardSteps";
import type { WizardStep } from "./WizardSteps";
import { ReviewStep } from "./ReviewStep";
import type { DraftRequestView } from "@/lib/request-data";

// Mirrors submitRequest's own preconditions (request-data.ts), in the same
// order, so a blocking problem surfaces as an inline error right when
// Submit is clicked, before the confirm dialog opens. The wizard's own
// step gating already stops most of this at Continue, but jumping back
// via the step pills to remove a receipt/item then forward again bypasses
// that gate -- and EditContent has no per-step gating at all, so this is
// its only check before submitting.
function getSubmitBlockingError(data: DraftRequestView): string | null {
  if (data.lineItems.length === 0) return "Add at least one item before submitting.";
  if (!data.bankDetails) return "Add bank details before submitting.";
  if (data.requestType !== "CASH_ADVANCE" && data.receipts.length === 0) {
    return "Attach at least one receipt before submitting.";
  }
  return null;
}

// Sorted alphabetically by label for the dropdowns only -- REQUEST_TYPES/
// MINISTRY_TYPES themselves stay in declared order, since other code (e.g.
// the voucher PDF's ministry directory) iterates them and shouldn't be
// affected by a dropdown-only display preference.
const SORTED_REQUEST_TYPES = [...REQUEST_TYPES].sort((a, b) =>
  REQUEST_TYPE_LABELS[a].localeCompare(REQUEST_TYPE_LABELS[b]),
);
const SORTED_MINISTRY_TYPES = [...MINISTRY_TYPES].sort((a, b) =>
  MINISTRY_TYPE_LABELS[a].localeCompare(MINISTRY_TYPE_LABELS[b]),
);

type RequestDrawerProps =
  | { mode: "create"; onCreated: (data: DraftRequestView) => void; onClose: () => void }
  | { mode: "edit"; data: DraftRequestView; showWizard: boolean; onClose: () => void };

export function RequestDrawer(props: RequestDrawerProps) {
  const closeRef = useRef<(() => void) | null>(null);
  // Identifies which logical session (creating vs. editing a specific
  // request) this render represents, passed to Dialog as resetKey.
  // RequestsTable.tsx reuses the same <RequestDrawer> instance across the
  // create -> edit handoff, and a fast close-then-open-a-different-request
  // can also land as new props on this same instance without a remount --
  // resetKey re-runs Dialog's showModal effect whenever the session
  // actually changes, regardless of instance reuse (a key of [] alone
  // silently never reopened it for a later session, found via a live
  // report of the panel intermittently not opening).
  const sessionKey = props.mode === "edit" ? props.data.id : "create";
  // Set inside handleDialogClose below, which Dialog's onClose fires for
  // every genuine close path uniformly. Passed to CreateStep so it can
  // tell a real close-while-creating apart from React Strict Mode's
  // dev-only synthetic unmount/remount -- CreateStep previously inferred
  // "closed" from its own cleanup effect, which Strict Mode's
  // double-invoke set permanently true on every mount, silently deleting
  // every draft it created in dev.
  const closedRef = useRef(false);

  // Every close path funnels through this one Dialog onClose -- the single
  // place to catch "closed a fresh draft that never got a single line
  // item" and delete it instead of leaving an empty row cluttering the
  // requester's list. Scoped to data.returnReason === null (a
  // never-submitted draft) -- a returned request has real submission
  // history and is never deleted just because its items were edited down
  // to zero. props.onClose() is awaited until the delete finishes, since
  // it's what tells RequestsTable to re-fetch the table -- calling it
  // first used to show the still-there row for a moment before a second
  // refresh caught up (found live).
  async function handleDialogClose() {
    closedRef.current = true;
    if (props.mode === "edit" && props.data.returnReason === null && props.data.lineItems.length === 0) {
      await deleteRequestAction(props.data.id);
    }
    props.onClose();
  }

  return (
    <Dialog
      titleId="drawer-title"
      title={props.mode === "create" ? "New request" : props.data.voucherNo}
      // DraftRequestView has no status field -- getDraftRequest only ever
      // returns DRAFT/NEEDS_CLARIFICATION/REJECTED_RETURNED, and
      // returnReason already distinguishes which.
      badge={
        props.mode === "edit" ? (
          <RequestStatusBadge
            status={
              props.data.returnReason === null
                ? "DRAFT"
                : props.data.returnReason.decision === "REJECTED"
                  ? "REJECTED_RETURNED"
                  : "NEEDS_CLARIFICATION"
            }
          />
        ) : undefined
      }
      onClose={handleDialogClose}
      resetKey={sessionKey}
      closeRef={closeRef}
    >
      {props.mode === "create" ? (
        <CreateStep onCreated={props.onCreated} onClose={() => closeRef.current?.()} closedRef={closedRef} />
      ) : props.showWizard ? (
        // The step-by-step wizard is only for the live moment right after
        // clicking "Create Request" -- clicking "Edit" on any existing
        // row, even a never-submitted draft, always shows the flat
        // EditContent instead (an earlier version wrongly kept showing
        // the wizard on every reopen). Keyed by request id so this
        // component's internal state always resets when switching
        // requests, even if the outer RequestDrawer instance wasn't
        // remounted (see sessionKey's comment).
        <CreateWizard key={props.data.id} data={props.data} onClose={() => closeRef.current?.()} />
      ) : (
        <EditContent key={props.data.id} data={props.data} onClose={() => closeRef.current?.()} />
      )}
    </Dialog>
  );
}

// Requires an explicit request-type/ministry pick before the draft
// exists, rather than defaulting to an arbitrary first choice the
// requester has to notice and override (found live: every new request
// looked auto-selected to "Cash Advance"/"Admin"). isPending stops a
// double-click from racing two picks into two drafts.
//
// onCreated receives the full DraftRequestView built right here, not just
// an id, since round-tripping through getDraftRequest for already-known
// data visibly closed and reopened the dialog (found live).
//
// closedRef (owned by RequestDrawer, not a local unmount-cleanup ref)
// covers a fast close-while-creating: if the draft-creation call resolves
// after the drawer already closed, this deletes it instead of calling
// onCreated. A local ref broke this in dev, since React Strict Mode's
// synthetic remount permanently marked every draft "closed" the instant
// it was created (found live).
function CreateStep({
  onCreated,
  onClose,
  closedRef,
}: {
  onCreated: (data: DraftRequestView) => void;
  onClose: () => void;
  closedRef: React.RefObject<boolean>;
}) {
  const [requestType, setRequestType] = useState<RequestTypeValue | "">("");
  const [ministryType, setMinistryType] = useState<MinistryTypeValue | "">("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!requestType || !ministryType) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createDraftRequestForDrawerAction(requestType, ministryType);
        if (closedRef.current) {
          if (result.ok && result.id) void deleteRequestAction(result.id);
          return;
        }
        if (result.ok && result.id && result.voucherNo && result.requesterName) {
          onCreated({
            id: result.id,
            voucherNo: result.voucherNo,
            requesterName: result.requesterName,
            requestType,
            ministryType,
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
        if (!closedRef.current) setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <WizardSteps currentStep={1} furthestStep={1} onJump={() => {}} />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-requestType" className="text-sm font-medium text-slate-700">
          Request type
        </label>
        <select
          id="new-requestType"
          value={requestType}
          disabled={isPending}
          onChange={(e) => setRequestType(e.target.value as RequestTypeValue)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="" disabled>
            Select a request type…
          </option>
          {SORTED_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-ministryType" className="text-sm font-medium text-slate-700">
          Ministry
        </label>
        <select
          id="new-ministryType"
          value={ministryType}
          disabled={isPending}
          onChange={(e) => setMinistryType(e.target.value as MinistryTypeValue)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="" disabled>
            Select a ministry…
          </option>
          {SORTED_MINISTRY_TYPES.map((m) => (
            <option key={m} value={m}>
              {MINISTRY_TYPE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex justify-between">
        <CloseButton onClose={onClose} />
        <Button disabled={isPending || !requestType || !ministryType} onClick={handleContinue}>
          {isPending ? "Creating…" : "Continue →"}
        </Button>
      </div>
    </div>
  );
}

// Request type + ministry selects, each change saved immediately via
// updateRequestDetailsAction -- self-contained so both EditContent and
// CreateWizard's Details step can reuse it without duplicating logic.
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
// submission -- same canvas/markup as the approver's signature pad
// (ApprovalDrawer.tsx), shared here between EditContent and CreateWizard's
// Review step so the canvas JSX isn't duplicated (each keeps its own
// submit handler).
function SignaturePad({ sigPadRef }: { sigPadRef: React.RefObject<SignatureCanvas | null> }) {
  useEffect(() => {
    // react-signature-canvas sizes itself from the container's rendered
    // dimensions at mount, recalculating only on window "resize". If it
    // mounts before the enclosing <dialog>'s showModal() layout has
    // settled, it can capture the wrong size -- a real crash
    // (InvalidStateError from getTrimmedCanvas on a 0-sized canvas) traced
    // to EditContent rendering this pad immediately on open, unlike
    // CreateWizard's copy at the Review step. Dispatching a synthetic
    // resize shortly after mount is the standard workaround.
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, []);

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

// A confirm-before-submit step, layered on top of RequestDrawer's own
// content rather than opened as a second, nested native <dialog>. As a
// nested dialog, closing it via Cancel made the OUTER dialog's own native
// "close" event fire too, silently closing the whole drawer -- a genuine
// browser behavior in the modal-dialog stack (confirmed by instrumenting
// .close(): only ever called on this dialog, yet the outer one's "close"
// fired anyway). A plain overlay sidesteps it entirely instead of working
// around it.
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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-y-0 left-0 z-10 flex w-full max-w-xl items-center justify-center bg-black/40 p-6"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="submit-confirm-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 id="submit-confirm-title" className="text-base font-bold text-slate-900">
          {isResubmit ? "Resubmit reimbursement?" : "Submit reimbursement?"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Your request will be sent to the required approvers for review.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? "Submitting…" : isResubmit ? "Resubmit request" : "Submit request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditContent({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  // A line-item/receipt remove (or receipt upload) is a server round-trip
  // followed by router.refresh() -- until that resolves, `data` still
  // reflects the pre-mutation state. Without this, removing the only
  // receipt/item and clicking Submit in that window passed
  // getSubmitBlockingError's check on stale data (found live).
  const [lineItemsBusy, setLineItemsBusy] = useState(false);
  const [receiptsBusy, setReceiptsBusy] = useState(false);
  const stepBusy = lineItemsBusy || receiptsBusy;

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
    // handleSubmitClick already checked isEmpty() before showing this
    // confirm dialog, but that check and this read can still disagree --
    // getTrimmedCanvas() also needs valid pixel dimensions at call time,
    // which can fall out of sync with isEmpty() (found live: a real
    // InvalidStateError from a 0-sized canvas despite passing isEmpty()).
    // Fail back to the same "please sign" state rather than an uncaught
    // exception.
    let signatureDataUrl: string;
    try {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) throw new Error("empty");
      signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");
    } catch {
      setShowConfirm(false);
      setSubmitError("Your signature didn't save correctly -- please sign again and resubmit.");
      return;
    }
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
            onPendingChange={setLineItemsBusy}
          />
        </div>
        <div className="py-6">
          <ReceiptManager requestId={data.id} receipts={data.receipts} onPendingChange={setReceiptsBusy} />
        </div>
        <div className="pt-6">
          <BankDetailsManager requestId={data.id} bankDetails={data.bankDetails} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <SignaturePad sigPadRef={sigPadRef} />
        {submitError && <ErrorBanner message={submitError} />}
        <div className="flex justify-between">
          <CloseButton onClose={onClose} />
          <Button disabled={isSubmitPending || stepBusy} onClick={handleSubmitClick}>
            {data.returnReason ? "Resubmit" : "Submit"}
          </Button>
        </div>
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

// WizardSteps and ReviewStep live in their own files -- pulled out so
// Storybook can story these presentation-only pieces without pulling in
// this file's Server Action/Prisma dependency graph. CreateWizard below
// still imports and uses both.

// The step-by-step flow for a fresh draft. Each field still saves
// immediately through its own existing action (LineItemManager/
// ReceiptManager/BankDetailsManager/RequestDetailsFields, reused
// unchanged) -- this only adds step navigation, not a new batch-save
// mechanism. "Continue" is gated by the same three checks submitRequest
// itself makes at submit time, surfaced earlier instead of only failing
// at the end.
function CreateWizard({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const sigPadRef = useRef<SignatureCanvas>(null);
  // Starts at step 2 (Expenses & Receipts), not step 1 (Details) -- by the
  // time this renders, CreateStep has already collected the request-type/
  // ministry pick and created the draft with it, so step 1 would just be
  // the same screen twice (reported live: "the panel does not move to the
  // next step"). Step 1 is still reachable via the step pills to change
  // that choice later -- furthestStep starts at 2 so that jump stays
  // allowed.
  const [currentStep, setCurrentStep] = useState<WizardStep>(2);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(2);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  // A line-item/receipt remove (or receipt upload) is a server round-trip
  // followed by router.refresh() -- until that resolves, `data` still
  // reflects the pre-mutation state, and Continue could otherwise advance
  // past this step with zero items/receipts actually attached (found
  // live). Only gates this step's Continue (see canContinueFromExpenses)
  // -- step 4's Submit doesn't need the same guard, since it's already
  // unreachable while this is pending.
  const [lineItemsBusy, setLineItemsBusy] = useState(false);
  const [receiptsBusy, setReceiptsBusy] = useState(false);
  const stepBusy = lineItemsBusy || receiptsBusy;

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
    // See EditContent's handleConfirmedSubmit for why this is re-checked
    // rather than trusting handleSubmitClick's earlier isEmpty() alone.
    let signatureDataUrl: string;
    try {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) throw new Error("empty");
      signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");
    } catch {
      setShowConfirm(false);
      setSubmitError("Your signature didn't save correctly -- please sign again and resubmit.");
      return;
    }
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

  // Receipts share this step with line items -- a receipt upload
  // auto-creates its own line item (ReceiptManager.tsx). Cash advances are
  // requested before the money's spent -- nothing to attach a receipt for
  // yet (mirrors submitRequest's own check).
  const receiptRequired = data.requestType !== "CASH_ADVANCE";
  const canContinueFromExpenses =
    data.lineItems.length > 0 && (!receiptRequired || data.receipts.length > 0) && !stepBusy;
  const canContinueFromPayment = data.bankDetails !== null;

  const backButton = (
    <Button variant="secondary" onClick={goBack}>
      ← Back
    </Button>
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
          <div className="flex justify-between">
            <CloseButton onClose={onClose} />
            <Button onClick={goNext}>Continue →</Button>
          </div>
        </>
      )}

      {currentStep === 2 && (
        <>
          <div className="flex flex-col divide-y divide-slate-200">
            <div className="pb-6">
              <LineItemManager
                requestId={data.id}
                lineItems={data.lineItems}
                totalAmount={data.totalAmount}
                onPendingChange={setLineItemsBusy}
              />
            </div>
            <div className="pt-6">
              <ReceiptManager requestId={data.id} receipts={data.receipts} onPendingChange={setReceiptsBusy} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <div className="flex gap-3">
                {backButton}
                <CloseButton onClose={onClose} />
              </div>
              <Button disabled={!canContinueFromExpenses} onClick={goNext}>
                Continue →
              </Button>
            </div>
            {!canContinueFromExpenses && !stepBusy && (
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
              <div className="flex gap-3">
                {backButton}
                <CloseButton onClose={onClose} />
              </div>
              <Button disabled={!canContinueFromPayment} onClick={goNext}>
                Continue →
              </Button>
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
              <div className="flex gap-3">
                {backButton}
                <CloseButton onClose={onClose} />
              </div>
              <Button disabled={isSubmitPending} onClick={handleSubmitClick}>
                Submit reimbursement
              </Button>
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
