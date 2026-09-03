"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { CloseButton } from "@/components/requests/CloseButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { decideApprovalAction, requestChangesAction } from "@/app/approvals/actions";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { getApproverRoleLabel } from "@/lib/approval-routing";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { MoneyStat } from "@/components/MoneyStat";
import { SectionHeading } from "@/components/SectionHeading";
import type { PendingApprovalView } from "@/lib/approval-data";

// Same Dialog side-panel shell RequestDrawer/RequestProgressDrawer use --
// gives a fixed, independently-scrollable area regardless of how many
// line items a request has, instead of an inline table-row expansion
// that grows unbounded and pushes the rest of the list down.
export function ApprovalDrawer({
  approval,
  onClose,
}: {
  approval: PendingApprovalView;
  onClose: () => void;
}) {
  const router = useRouter();
  const closeRef = useRef<(() => void) | null>(null);
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  // Inline error state, not a toast -- this component IS a native
  // <dialog>, which the browser promotes to the "top layer" the instant
  // it's opened via showModal(). Anything in the top layer renders above
  // *all* regular-positioned content regardless of z-index, so a toast
  // fired while the dialog is open would render behind it -- invisible to
  // the user. Inline text inside the dialog's own DOM doesn't have this
  // problem.
  const [error, setError] = useState<string | null>(null);

  function handleDecide(decision: "APPROVED" | "REJECTED") {
    setError(null);
    let signatureDataUrl: string | null = null;
    if (decision === "APPROVED") {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        setError("Please sign to approve.");
        return;
      }
      signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");
    }

    startTransition(async () => {
      const result = await decideApprovalAction(approval.approvalId, decision, comment, signatureDataUrl);
      if (result.ok) {
        router.refresh();
        closeRef.current?.();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleRequestChanges() {
    setError(null);
    startTransition(async () => {
      const result = await requestChangesAction(approval.approvalId, comment);
      if (result.ok) {
        router.refresh();
        closeRef.current?.();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Dialog
      titleId="approval-drawer-title"
      title={approval.voucherNo}
      // Reaching this drawer at all means the request is IN_APPROVAL --
      // same fixed status as ApprovalsTable.tsx's list.
      badge={<RequestStatusBadge status="IN_APPROVAL" />}
      onClose={onClose}
      closeRef={closeRef}
    >
      <MoneyStat label="Total amount" amount={approval.totalAmount} />

      <div className="flex flex-col divide-y divide-slate-200">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 pb-6 text-sm">
          <dt className="text-slate-500">Requester</dt>
          <dd>{approval.requesterName}</dd>
          <dt className="text-slate-500">Type</dt>
          <dd>{REQUEST_TYPE_LABELS[approval.requestType]}</dd>
          <dt className="text-slate-500">Ministry</dt>
          <dd>{MINISTRY_TYPE_LABELS[approval.ministryType]}</dd>
          <dt className="text-slate-500">Your role</dt>
          <dd>{getApproverRoleLabel(approval.role, approval.ministryType)}</dd>
        </dl>

        <div className="py-6">
          <SectionHeading>Items</SectionHeading>
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
              <li className="flex justify-between border-t-2 border-slate-300 py-1.5 font-semibold">
                <span>Total</span>
                <span className="font-mono">${approval.totalAmount}</span>
              </li>
            </ul>
          )}
        </div>

        <div className="pt-6">
          <SectionHeading>Receipts</SectionHeading>
          {approval.receipts.length === 0 ? (
            <p className="text-sm text-slate-500">None attached.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {approval.receipts.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="truncate font-mono text-slate-700">{r.filename}</span>
                  {/* Signed URL, computed server-side at render time -- lets
                      an approver check a receipt against the line-item list
                      before deciding, not just see a count. */}
                  <a
                    href={r.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-m-1 shrink-0 p-1 text-teal-700 hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="approval-comment" className="text-sm font-medium text-slate-700">
          Comment (required to reject or request changes)
        </label>
        <textarea
          id="approval-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Sign to approve</label>
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

      {error && <ErrorBanner message={error} />}

      <div className="flex justify-between">
        <CloseButton onClose={() => closeRef.current?.()} />
        <div className="flex gap-3">
          <Button disabled={isPending} onClick={() => handleDecide("APPROVED")}>
            {isPending ? "Saving…" : "Approve"}
          </Button>
          <Button variant="danger" disabled={isPending} onClick={() => handleDecide("REJECTED")}>
            Reject
          </Button>
          <Button variant="warning" disabled={isPending} onClick={handleRequestChanges}>
            Request Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
