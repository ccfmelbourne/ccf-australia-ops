"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDraftRequestForDrawerAction,
  updateRequestDetailsAction,
  submitRequestAction,
} from "@/app/requests/actions";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  MINISTRY_TYPES,
  MINISTRY_TYPE_LABELS,
} from "@/lib/request-types";
import { LineItemManager } from "./LineItemManager";
import { ReceiptManager } from "./ReceiptManager";
import { BankDetailsManager } from "./BankDetailsManager";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { DraftRequestView } from "@/lib/request-data";

// A native <dialog> styled as a right-side panel on wide viewports and a
// full-screen sheet on small ones -- w-full capped by max-w-xl gives that
// responsiveness for free (below ~36rem viewport width it's already full
// width, no separate breakpoint needed). <dialog> gives focus-trapping,
// Escape-to-close, and a backdrop natively, so no new UI dependency.
type RequestDrawerProps =
  | { mode: "create"; onCreated: (id: string) => void; onClose: () => void }
  | { mode: "edit"; data: DraftRequestView; onClose: () => void };

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

  return (
    <dialog
      ref={dialogRef}
      onClose={props.onClose}
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
function CreateStep({ onCreated }: { onCreated: (id: string) => void }) {
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const result = await createDraftRequestForDrawerAction(REQUEST_TYPES[0], MINISTRY_TYPES[0]);
      if (result.ok && result.id) {
        onCreated(result.id);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return error ? <ErrorBanner message={error} /> : <p className="text-sm text-slate-500">Creating…</p>;
}

function EditContent({ data, onClose }: { data: DraftRequestView; onClose: () => void }) {
  const router = useRouter();
  const [requestType, setRequestType] = useState(data.requestType);
  const [ministryType, setMinistryType] = useState(data.ministryType);
  const [isDetailsPending, startDetailsTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleDetailsChange(nextType: string, nextMinistry: string) {
    setError(null);
    startDetailsTransition(async () => {
      const result = await updateRequestDetailsAction(data.id, nextType, nextMinistry);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleSubmit() {
    setSubmitError(null);
    startSubmitTransition(async () => {
      const result = await submitRequestAction(data.id);
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

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="requestType" className="text-sm font-medium text-slate-700">
            Request type
          </label>
          <select
            id="requestType"
            value={requestType}
            disabled={isDetailsPending}
            onChange={(e) => {
              setRequestType(e.target.value as typeof requestType);
              handleDetailsChange(e.target.value, ministryType);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            {REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {REQUEST_TYPE_LABELS[type]}
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
            value={ministryType}
            disabled={isDetailsPending}
            onChange={(e) => {
              setMinistryType(e.target.value as typeof ministryType);
              handleDetailsChange(requestType, e.target.value);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            {MINISTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {MINISTRY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        {error && <ErrorBanner message={error} />}
      </div>

      <LineItemManager
        requestId={data.id}
        lineItems={data.lineItems}
        totalAmount={data.totalAmount}
      />
      <ReceiptManager requestId={data.id} receipts={data.receipts} />
      <BankDetailsManager requestId={data.id} bankDetails={data.bankDetails} />

      <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
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
