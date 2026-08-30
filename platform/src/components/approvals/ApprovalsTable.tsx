"use client";

import { useState } from "react";
import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { ApprovalDrawer } from "./ApprovalDrawer";
import type { PendingApprovalView } from "@/lib/approval-data";

export function ApprovalsTable({ approvals }: { approvals: PendingApprovalView[] }) {
  const [selected, setSelected] = useState<PendingApprovalView | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-slate-900">Approvals</h2>

      {approvals.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing pending your approval.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {approvals.map((a) => (
            <li key={a.approvalId}>
              <button
                type="button"
                onClick={() => setSelected(a)}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 p-4 text-left hover:bg-slate-50"
              >
                <span className="flex flex-col">
                  <span className="font-mono text-sm text-slate-700">{a.voucherNo}</span>
                  <span className="text-xs text-slate-500">
                    {a.requesterName} · {REQUEST_TYPE_LABELS[a.requestType]} ·{" "}
                    {MINISTRY_TYPE_LABELS[a.ministryType]}
                  </span>
                </span>
                <span className="font-mono font-semibold text-slate-900">${a.totalAmount}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <ApprovalDrawer approval={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
