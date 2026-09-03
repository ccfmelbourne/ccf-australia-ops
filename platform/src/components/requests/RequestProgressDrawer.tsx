"use client";

import { useRef } from "react";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { getApproverRoleLabel } from "@/lib/approval-routing";
import { Dialog } from "@/components/Dialog";
import { RequestStatusBadge } from "@/components/RequestStatusBadge";
import { MoneyStat } from "@/components/MoneyStat";
import { SectionHeading } from "@/components/SectionHeading";
import { CloseButton } from "./CloseButton";
import type { RequestProgressView, RequestProgressApprovalView } from "@/lib/request-data";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type TimelineState = "approved" | "waived" | "auto_satisfied" | "rejected" | "pending";

const TIMELINE_ICON: Record<TimelineState, string> = {
  approved: "✓",
  waived: "✓",
  auto_satisfied: "✓",
  rejected: "×",
  pending: "◷",
};

const TIMELINE_ICON_CLASSES: Record<TimelineState, string> = {
  approved: "bg-teal-600 text-white",
  waived: "bg-teal-100 text-teal-700",
  auto_satisfied: "bg-teal-100 text-teal-700",
  rejected: "bg-red-600 text-white",
  pending: "bg-slate-200 text-slate-500",
};

// A vertical timeline instead of a plain "role / status" table -- each
// role gets an icon (checked/waived/rejected/awaiting), a connecting line
// to the next step, and the actual decision detail (who, when) instead of
// just a status word. This is the requester's main view of "where is my
// request," so it's worth more visual weight than a two-column list.
// Exported so Storybook can story it directly with fixture approval data.
export function ApprovalTimeline({
  approvals,
  ministryType,
  regionalDirectorOverrideConfirmedAt,
}: {
  approvals: RequestProgressApprovalView[];
  ministryType: RequestProgressView["ministryType"];
  regionalDirectorOverrideConfirmedAt: string | null;
}) {
  return (
    <div>
      <SectionHeading>Approval progress</SectionHeading>
      <ol className="flex flex-col">
        {approvals.map((a, i) => {
          const isLast = i === approvals.length - 1;
          // A tier-4 request can reach APPROVED via Ross Callado's "within
          // budget" confirmation instead of a direct Regional Director
          // decision -- his row stays genuinely PENDING forever in that
          // case (correct data, not a bug; voucher-pdf.tsx represents this
          // the same way on the final voucher).
          const waived =
            a.role === "REGIONAL_DIRECTOR" &&
            a.status === "PENDING" &&
            regionalDirectorOverrideConfirmedAt !== null;
          const state: TimelineState =
            a.status === "AUTO_SATISFIED"
              ? "auto_satisfied"
              : waived
                ? "waived"
                : a.status === "APPROVED"
                  ? "approved"
                  : a.status === "REJECTED"
                    ? "rejected"
                    : "pending";

          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${TIMELINE_ICON_CLASSES[state]}`}
                >
                  {TIMELINE_ICON[state]}
                </span>
                {!isLast && <span className="w-px flex-1 bg-slate-200" />}
              </div>
              <div className={isLast ? "pb-1" : "pb-6"}>
                <p className="text-sm font-semibold text-slate-900">
                  {getApproverRoleLabel(a.role, ministryType)}
                </p>
                {state === "approved" && (
                  <p className="text-xs text-slate-500">
                    Approved {formatDate(a.decidedAt)}
                    {a.approverName && (
                      <>
                        <br />
                        {a.approverName}
                      </>
                    )}
                  </p>
                )}
                {state === "rejected" && (
                  <p className="text-xs text-red-600">Rejected {formatDate(a.decidedAt)}</p>
                )}
                {state === "waived" && (
                  <p className="text-xs text-teal-600">Waived — satisfied via committee confirmation</p>
                )}
                {state === "auto_satisfied" && (
                  <p className="text-xs text-teal-600">{a.comments ?? "Auto-satisfied"}</p>
                )}
                {state === "pending" && <p className="text-xs text-slate-500">Awaiting approval</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// The requester's own read-only view of a submitted (non-editable)
// request -- there was previously no UI at all for this; RequestsTable
// only ever showed Edit/Delete for editable statuses, so a submitted
// request was otherwise invisible until it resolved. Same Dialog
// side-panel shell RequestDrawer/ApprovalDrawer use.
export function RequestProgressDrawer({
  data,
  onClose,
}: {
  data: RequestProgressView;
  onClose: () => void;
}) {
  const closeRef = useRef<(() => void) | null>(null);

  return (
    <Dialog titleId="progress-drawer-title" title={data.voucherNo} onClose={onClose} closeRef={closeRef}>
      {data.status === "APPROVED" && (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 p-6 text-center">
            <span
              aria-hidden
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white"
            >
              ✓
            </span>
            <p className="text-base font-bold text-slate-900">Reimbursement approved</p>
            <p className="max-w-xs text-sm text-slate-600">
              All required approvals are complete. Finance will now process your request.
            </p>
          <p className="mt-1 font-mono text-xs text-slate-500">Voucher #{data.voucherNo}</p>
        </div>
      )}

      <MoneyStat label="Total reimbursement" amount={data.totalAmount} />

      <div className="flex flex-col divide-y divide-slate-200">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 pb-6 text-sm">
          <dt className="text-slate-500">Status</dt>
          <dd>
            <RequestStatusBadge status={data.status} />
          </dd>
          <dt className="text-slate-500">Type</dt>
          <dd>{REQUEST_TYPE_LABELS[data.requestType]}</dd>
          <dt className="text-slate-500">Ministry</dt>
          <dd>{MINISTRY_TYPE_LABELS[data.ministryType]}</dd>
        </dl>

        <div className="py-6">
          <SectionHeading>Items</SectionHeading>
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
              <li className="flex justify-between border-t-2 border-slate-300 py-1.5 font-semibold">
                <span>Total</span>
                <span className="font-mono">${data.totalAmount}</span>
              </li>
            </ul>
          )}
        </div>

        <div className="py-6">
          <SectionHeading>Receipts</SectionHeading>
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
                    className="-m-1 shrink-0 p-1 text-teal-700 hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.bankDetails && (
          <div className="py-6">
            <SectionHeading>Bank details</SectionHeading>
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

        <div className="pt-6">
          <ApprovalTimeline
            approvals={data.approvals}
            ministryType={data.ministryType}
            regionalDirectorOverrideConfirmedAt={data.regionalDirectorOverrideConfirmedAt}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <CloseButton onClose={() => closeRef.current?.()} />
      </div>
    </Dialog>
  );
}
