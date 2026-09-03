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
// Submit is clicked -- before the confirm dialog opens -- rather than only
// after confirming. The wizard's own step gating (canContinueFromExpenses/
// canContinueFromPayment) already stops most of this at the Continue
// button, but it's re-checked here too: jumping back via the step pills to
// remove a receipt or line item, then jumping forward to Review again,
// bypasses that gate without re-validating it. The flat edit view
// (EditContent) has no such per-step gating at all, so this is the only
// check it gets before submitting.
function getSubmitBlockingError(data: DraftRequestView): string | null {
  if (data.lineItems.length === 0) return "Add at least one item before submitting.";
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

type RequestDrawerProps =
  | { mode: "create"; onCreated: (data: DraftRequestView) => void; onClose: () => void }
  | { mode: "edit"; data: DraftRequestView; showWizard: boolean; onClose: () => void };

export function RequestDrawer(props: RequestDrawerProps) {
  const closeRef = useRef<(() => void) | null>(null);
  // Identifies which logical session (creating vs. editing a specific
  // request) this render represents, passed to Dialog as resetKey.
  // RequestsTable.tsx deliberately keeps the same <RequestDrawer> instance
  // across the create -> edit handoff (see its comment), and native
  // dialog.close() closes the panel synchronously while the router
  // navigation that clears `openRequest` resolves asynchronously -- so a
  // fast close-then-open-a-different-request can also land as new props on
  // this same instance, without a remount, rather than the close having
  // actually completed first. Dialog's showModal effect keyed on [] alone
  // would only ever run once per mount and silently never reopen it for
  // that later session (found via a live report of the panel
  // intermittently not opening) -- resetKey re-runs it whenever the
  // session actually changes, regardless of whether the component
  // instance was reused. Dialog's own `!dialog.open` guard still makes
  // this a no-op during the create -> edit handoff, where the dialog is
  // already open and calling showModal() again would throw.
  const sessionKey = props.mode === "edit" ? props.data.id : "create";
  // Set inside handleDialogClose below, which Dialog's onClose fires for
  // every genuine close path uniformly (the X button, the lower Close
  // button, and Escape). Passed down to CreateStep so it can tell a real
  // close-while-creating apart from React Strict Mode's dev-only
  // synthetic unmount/remount of every component on initial mount --
  // CreateStep previously inferred "closed" from its own cleanup effect,
  // which Strict Mode's double-invoke set permanently true on every
  // mount regardless of whether the requester ever closed anything,
  // silently deleting every draft it created in dev. A ref owned here,
  // set only by an actual close event, isn't affected by that.
  const closedRef = useRef(false);

  // Every close path (the X button, Escape, and CreateWizard's own
  // post-submit close) funnels through this one Dialog onClose -- the
  // single place to catch "closed a fresh draft that never got a single
  // line item" and clean it up instead of leaving an empty row cluttering
  // the requester's own request list (this exact clutter was found and
  // manually cleaned up earlier in this project's history). Scoped to
  // data.returnReason === null (a never-submitted draft -- independent of
  // whether it was shown via the wizard or the flat view, since clicking
  // Edit on an unsubmitted draft now shows flat too) -- a returned request
  // has real submission history and is never deleted just because its
  // line items were edited down to zero before closing. The native dialog
  // itself has already closed by the time this fires (that part is
  // instant, browser-native), but props.onClose() is awaited until the
  // delete finishes -- it's what tells RequestsTable to drop the `open`
  // query param and re-fetch the table. Calling it before the delete
  // lands used to show the still-there draft row for a moment, then
  // remove it visibly a beat later once a second refresh caught up --
  // found via the decision-maker actually watching it happen. Awaiting
  // first means the table's one and only re-fetch already reflects the
  // row being gone.
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
      // DraftRequestView doesn't carry a status field directly --
      // getDraftRequest only ever returns DRAFT/NEEDS_CLARIFICATION/
      // REJECTED_RETURNED, and returnReason already distinguishes which,
      // the same way EditContent's own banner below does.
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
        // The step-by-step wizard is only for the live moment right
        // after clicking "Create Request" (RequestsTable.tsx's
        // openedViaCreate) -- clicking "Edit" on any existing row, even
        // a never-submitted draft, always shows the flat EditContent
        // instead. Confirmed with the decision-maker after an earlier
        // version wrongly kept showing the wizard on every reopen of an
        // unsubmitted draft, not just the initial creation.
        // Keyed by request id (not just relying on the props update) so
        // this component's own internal state -- RequestDetailsFields'
        // request-type/ministry dropdowns, the signature pad, etc. --
        // always resets when switching to a different request, even in
        // the rare case where the outer RequestDrawer instance above
        // wasn't remounted (see sessionKey's comment).
        <CreateWizard key={props.data.id} data={props.data} onClose={() => closeRef.current?.()} />
      ) : (
        <EditContent key={props.data.id} data={props.data} onClose={() => closeRef.current?.()} />
      )}
    </Dialog>
  );
}

// Requires an explicit request-type and ministry pick before the draft is
// even created -- no request exists yet at this point, so there's nothing
// to default to that wouldn't just be an arbitrary "first in the list"
// guess the requester has to notice and override (confirmed with the
// decision-maker after a live report that every new request looked like
// it was auto-selecting "Cash Advance"/"Admin", since that's genuinely
// what it always defaulted to). The draft is only created -- with the
// requester's own chosen values -- once they click Continue; the button's
// own isPending disabled state stops a double-click from racing two picks
// into two separate drafts.
//
// onCreated receives the full initial DraftRequestView, built right here
// from the action's result, rather than just an id -- the caller used to
// navigate to ?open=<id> and wait for a server round-trip through
// getDraftRequest to fetch back data it could already predict (a fresh
// draft has no line items/receipts/bank details/return reason yet). That
// round-trip created a render where neither this "creating" step nor the
// eventual edit view was mounted, which visibly closed and reopened the
// dialog -- found via live testing.
//
// closedRef (owned by RequestDrawer, set inside its handleDialogClose)
// covers a fast close-while-creating: the X/lower Close button/Escape
// aren't gated by isPending the way Continue is, so the draft-creation
// call can still be in flight when the requester closes the drawer. If it
// resolves after that, this deletes the just-created draft instead of
// calling onCreated -- otherwise the drawer would silently reopen on a
// request the requester already tried to cancel, and (since the request
// list already filters out empty drafts) leave an invisible orphaned row
// in the database if they didn't notice. This used to be a ref local to
// this component, set from its own unmount-cleanup effect -- but that
// cleanup also runs during React Strict Mode's dev-only synthetic
// unmount/remount of every component on initial mount, which permanently
// marked every draft "closed" (and therefore deleted) the instant it was
// created, in development only -- found by the create flow silently
// failing in local testing right after this landed. A ref that's only
// ever set by a genuine close event, owned above this component, isn't
// affected by that.
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
  useEffect(() => {
    // react-signature-canvas sizes its underlying canvas from the
    // container's rendered dimensions at mount time, and only recalculates
    // on a window "resize" event. If it mounts before the enclosing native
    // <dialog>'s showModal() layout has fully settled, it can capture the
    // wrong size -- a real, live-reported crash (InvalidStateError from
    // getTrimmedCanvas on a 0-sized canvas) traced to exactly this:
    // EditContent renders this pad immediately when the dialog opens,
    // unlike CreateWizard's copy, which only appears at the Review step,
    // well after the dialog has settled. Dispatching a synthetic resize
    // shortly after mount is the standard workaround for this library --
    // it forces a recalculation once the dialog's real layout is in place.
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
// content rather than opened as a second, nested native <dialog>.
// Submitting a request can't be undone once approvers start deciding on
// it, so this is a deliberate extra "are you sure" step rather than firing
// straight off the Review step's Submit button.
//
// This used to be its own showModal()'d <dialog>, stacked on top of
// RequestDrawer's -- browsers do support multiple top-layer modals, and
// that part worked. But closing this second dialog (via Cancel calling
// .close() on it) made the OUTER dialog's own native "close" event fire
// too, silently closing the whole drawer -- found live: clicking Cancel
// here closed the entire panel, not just this confirmation. Traced with
// an instrumented .close() and a stack trace on the outer close handler:
// .close() was only ever called on this dialog, never the outer one, yet
// the outer's "close" event fired anyway, immediately after -- a genuine
// browser behavior in the modal-dialog stack (tracked internally, not by
// DOM position -- moving this dialog to a document.body portal, fully
// decoupling it from the outer dialog's DOM subtree, didn't stop it
// either). The outer dialog already paints a full-viewport backdrop via
// its own top-layer promotion, so nothing here needs a second competing
// top-layer dialog to render above the rest of the page -- a plain
// overlay positioned to cover the same box as the drawer itself (see
// className below, deliberately mirroring RequestDrawer's own
// inset-y-0/left-0/max-w-xl) sits on top of the drawer's own content
// without ever opening a second modal, sidestepping the browser behavior
// entirely instead of working around it.
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
  // A line-item/receipt remove (or a receipt upload) is a server
  // round-trip followed by router.refresh() -- until that resolves, `data`
  // still reflects the pre-mutation state. Without this, removing the
  // only receipt/item and clicking Submit in that window passed
  // getSubmitBlockingError's check on stale data and opened the confirm
  // dialog for a request that no longer actually qualified -- found live.
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
    // isEmpty() only inspects the recorded stroke points, while
    // getTrimmedCanvas() also needs the canvas's actual pixel dimensions to
    // be valid at the moment it's called, and those two can fall out of
    // sync (found live: a real InvalidStateError from a 0-sized canvas
    // here despite passing the earlier isEmpty() check). Never let that
    // reach the user as an uncaught exception -- fail back to the same
    // "please sign" state they'd have seen if the first check had caught it.
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
  // Starts at step 2 (Expenses & Receipts), not step 1 (Details) -- by the
  // time this renders, CreateStep has already collected an explicit
  // request-type/ministry pick and created the draft with it, so re-showing
  // the exact same two fields as "step 1" would just be the same screen
  // twice with a Continue click doing nothing visible in between (reported
  // live: "the panel does not move to the next step"). Step 1 is still
  // reachable via the step pills, to go back and change that choice later
  // -- furthestStep starts at 2 so that jump stays allowed (goTo only
  // blocks going *ahead* of furthestStep).
  const [currentStep, setCurrentStep] = useState<WizardStep>(2);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(2);
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  // A line-item/receipt remove (or a receipt upload) is a server
  // round-trip followed by router.refresh() -- until that resolves, `data`
  // still reflects the pre-mutation state. Without this, removing the
  // only receipt/item and clicking Continue in that window advanced past
  // this step on stale data, with zero items/receipts actually attached
  // -- found live. Only gates this step's own Continue button (see
  // canContinueFromExpenses below) -- step 4's Submit doesn't need the
  // same guard, since Continue being disabled here already makes it
  // impossible to reach step 4 while a step-2 mutation is still pending.
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
    // and wrapped in a try/catch rather than trusting handleSubmitClick's
    // earlier isEmpty() check alone.
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

  // Receipts moved into the same step as line items -- a receipt upload
  // now auto-creates its own line item (ReceiptManager.tsx), so this is
  // where a requester actually builds up their expenses, not a separate
  // step reached later. Cash advances are requested before the money's
  // spent -- nothing to attach a receipt for yet (mirrors submitRequest's
  // own check, request-data.ts).
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
