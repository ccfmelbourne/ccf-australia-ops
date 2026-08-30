"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { decideApprovalAction } from "@/app/approvals/actions";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import type { PendingApprovalView } from "@/lib/approval-data";

// Approver role labels -- only shown here (inside the detail panel), not
// in the compact list row, which was getting cluttered with too many
// subheading fields.
const ROLE_LABELS: Record<string, string> = {
  MINISTRY_OVERSEER: "Ministry Overseer",
  COS1: "COS 1",
  COS2: "COS 2",
  FINANCE_OVERSEER: "Finance Overseer",
  REGIONAL_DIRECTOR: "Regional Director",
};

// Same native-<dialog> side-panel pattern as RequestDrawer.tsx -- gives a
// fixed, independently-scrollable area regardless of how many line items a
// request has, instead of an inline table-row expansion that grows
// unbounded and pushes the rest of the list down.
export function ApprovalDrawer({
  approval,
  onClose,
}: {
  approval: PendingApprovalView;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  function handleDecide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideApprovalAction(approval.approvalId, decision, comment);
      if (result.ok) {
        router.refresh();
        handleClose();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      aria-labelledby="approval-drawer-title"
      className="fixed inset-y-0 right-0 m-0 h-dvh w-full max-w-xl overflow-y-auto rounded-l-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <h2 id="approval-drawer-title" className="text-lg font-bold text-slate-900">
          {approval.voucherNo}
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
          <dt className="text-slate-500">Requester</dt>
          <dd>{approval.requesterName}</dd>
          <dt className="text-slate-500">Type</dt>
          <dd>{REQUEST_TYPE_LABELS[approval.requestType]}</dd>
          <dt className="text-slate-500">Ministry</dt>
          <dd>{MINISTRY_TYPE_LABELS[approval.ministryType]}</dd>
          <dt className="text-slate-500">Your role</dt>
          <dd>{ROLE_LABELS[approval.role] ?? approval.role}</dd>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-mono font-semibold">${approval.totalAmount}</dd>
        </dl>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Line items
          </p>
          {approval.lineItems.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="text-sm">
              {approval.lineItems.map((li, i) => (
                <li key={i} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{li.description}</span>
                  <span className="font-mono">${li.amount}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {approval.receiptCount} receipt{approval.receiptCount === 1 ? "" : "s"} attached.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="approval-comment" className="text-sm font-medium text-slate-700">
            Comment (required to reject)
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("APPROVED")}
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("REJECTED")}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </dialog>
  );
}
