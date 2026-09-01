"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRequestAction } from "@/app/requests/actions";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { RequestDrawer } from "./RequestDrawer";
import { RequestProgressDrawer } from "./RequestProgressDrawer";
import type { RequestListItemView, DraftRequestView, RequestProgressView } from "@/lib/request-data";

export function RequestsTable({
  requests,
  openRequest,
  progressRequest,
}: {
  requests: RequestListItemView[];
  openRequest: DraftRequestView | null;
  progressRequest: RequestProgressView | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Holds the full view for a request just created in this drawer, so the
  // create -> edit transition doesn't have to wait on the router.push below
  // to actually resolve and re-fetch openRequest from the server before
  // showing anything -- a fresh draft's shape (no line items/receipts/bank
  // details/return reason yet) is already fully known the moment creation
  // succeeds. Without this, there was a render where neither `creating` nor
  // `openRequest` was set, which unmounted and remounted the dialog --
  // visible as the panel closing and reopening. Superseded automatically
  // once the real openRequest arrives from the server (see below).
  const [justCreated, setJustCreated] = useState<DraftRequestView | null>(null);
  // The step-by-step wizard is only for the live moment right after
  // clicking "Create Request" -- true from handleCreated onward (through
  // the justCreated -> openRequest handoff above, which doesn't touch
  // this), reset to false the instant the user does anything else
  // (clicks Edit on a row, or closes the drawer). Clicking "Edit" always
  // shows the flat layout, even for a draft that was never submitted --
  // confirmed with the decision-maker after the wizard's first version
  // wrongly kept showing it on every reopen of an unsubmitted draft.
  const [openedViaCreate, setOpenedViaCreate] = useState(false);
  // Deleting a request is permanent (line items/receipts/bank
  // details/approval history all go with it) -- clicking Delete arms this
  // row rather than firing immediately, so a second click is required.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveOpenRequest = openRequest ?? justCreated;

  function openEdit(id: string) {
    setCreating(false);
    setJustCreated(null);
    setOpenedViaCreate(false);
    router.push(`/requests?open=${id}`);
  }

  function openProgress(id: string) {
    setCreating(false);
    setJustCreated(null);
    setOpenedViaCreate(false);
    router.push(`/requests?progress=${id}`);
  }

  function handleCreated(data: DraftRequestView) {
    setCreating(false);
    setJustCreated(data);
    setOpenedViaCreate(true);
    router.push(`/requests?open=${data.id}`);
  }

  function closeDrawer() {
    setCreating(false);
    setJustCreated(null);
    setOpenedViaCreate(false);
    router.push("/requests");
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteRequestAction(id);
      if (result.ok) {
        setConfirmDeleteId(null);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">My requests</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Create Request
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">No requests yet.</p>
      ) : (
        // Six columns don't reflow on a narrow phone screen -- scrolls
        // horizontally inside its own container instead of squishing text
        // or overflowing the page, rather than a full mobile-card redesign.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Request</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Ministry</th>
                <th className="py-2 pr-6 text-right min-w-[100px]">Amount</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-mono">{r.voucherNo}</td>
                  <td className="py-2 pr-2">{REQUEST_TYPE_LABELS[r.requestType]}</td>
                  <td className="py-2 pr-2">{MINISTRY_TYPE_LABELS[r.ministryType]}</td>
                  <td className="py-2 pr-6 text-right font-mono font-semibold">${r.totalAmount}</td>
                  <td className="py-2 pr-2">
                    <RequestStatusBadge status={r.status} />
                  </td>
                  <td className="py-2 text-right">
                    {(r.status === "DRAFT" ||
                      r.status === "NEEDS_CLARIFICATION" ||
                      r.status === "REJECTED_RETURNED") && (
                      <span className="flex justify-end items-center gap-3">
                        {confirmDeleteId === r.id ? (
                          <>
                            <span className="text-slate-600">Delete this request?</span>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDelete(r.id)}
                              className="font-semibold text-red-600 hover:underline disabled:opacity-60"
                            >
                              {isPending ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-slate-600 hover:underline disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(r.id)}
                              className="text-teal-700 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </span>
                    )}
                    {(r.status === "IN_APPROVAL" || r.status === "APPROVED") && (
                      <button
                        type="button"
                        onClick={() => openProgress(r.id)}
                        className="text-teal-700 hover:underline"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <RequestDrawer mode="create" onCreated={handleCreated} onClose={closeDrawer} />}
      {effectiveOpenRequest && (
        <RequestDrawer
          mode="edit"
          data={effectiveOpenRequest}
          showWizard={openedViaCreate}
          onClose={closeDrawer}
        />
      )}
      {progressRequest && <RequestProgressDrawer data={progressRequest} onClose={closeDrawer} />}
    </div>
  );
}
