"use client";

import { useEffect, useRef } from "react";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS, REQUEST_STATUS_LABELS } from "@/lib/request-types";
import { getApproverRoleLabel } from "@/lib/approval-routing";
import type { RequestProgressView } from "@/lib/request-data";

// The requester's own read-only view of a submitted (non-editable)
// request -- there was previously no UI at all for this; RequestsTable
// only ever showed Edit/Delete for editable statuses, so a submitted
// request was otherwise invisible until it resolved. Same native <dialog>
// pattern as RequestDrawer/ApprovalDrawer.
export function RequestProgressDrawer({
  data,
  onClose,
}: {
  data: RequestProgressView;
  onClose: () => void;
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
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      aria-labelledby="progress-drawer-title"
      className="fixed inset-y-0 right-0 m-0 h-dvh w-full max-w-xl overflow-y-auto rounded-l-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 id="progress-drawer-title" className="text-lg font-bold text-slate-900">
          {data.voucherNo}
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
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Status</dt>
          <dd>{REQUEST_STATUS_LABELS[data.status] ?? data.status}</dd>
          <dt className="text-slate-500">Type</dt>
          <dd>{REQUEST_TYPE_LABELS[data.requestType]}</dd>
          <dt className="text-slate-500">Ministry</dt>
          <dd>{MINISTRY_TYPE_LABELS[data.ministryType]}</dd>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-mono font-semibold">${data.totalAmount}</dd>
        </dl>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Line items
          </p>
          {data.lineItems.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="text-sm">
              {data.lineItems.map((li, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{li.description}</span>
                  <span className="font-mono">${li.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Receipts
          </p>
          {data.receipts.length === 0 ? (
            <p className="text-sm text-slate-500">None attached.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.receipts.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-slate-700">{r.filename}</span>
                  <a
                    href={r.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-teal-700 hover:underline"
                  >
                    View
                  </a>
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

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approval progress
          </p>
          <ul className="text-sm">
            {data.approvals.map((a, i) => (
              <li key={i} className="flex justify-between border-b border-slate-100 py-1">
                <span>{getApproverRoleLabel(a.role, data.ministryType)}</span>
                <span className="text-slate-600">
                  {a.status === "APPROVED"
                    ? `Approved${a.approverName ? ` — ${a.approverName}` : ""}`
                    : a.status === "REJECTED"
                      ? "Rejected"
                      : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
