"use client";

import { useState, useTransition } from "react";
import type { FinanceStatus } from "@/types/finance";
import { getAllowedNextStatuses } from "@/lib/status-transitions";
import { StatusBadge } from "./StatusBadge";

const LABELS: Record<FinanceStatus, string> = {
  READY_FOR_PROCESSING: "Ready for Processing",
  NEEDS_CLARIFICATION: "Needs Clarification",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  REJECTED_RETURNED: "Rejected / Returned",
};

export function StatusTransitionForm({
  requestId,
  currentStatus,
  onTransition,
}: {
  requestId: string;
  currentStatus: FinanceStatus;
  onTransition: (requestId: string, toStatus: FinanceStatus) => Promise<{ ok: boolean; error?: string }>;
}) {
  const allowed = getAllowedNextStatuses(currentStatus);
  const [selected, setSelected] = useState<FinanceStatus | "">(allowed[0] ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (allowed.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">
          <StatusBadge status={currentStatus} /> is a final status — no further action needed.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Status updated. Refresh the queue to see the change reflected there too.
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        setError(null);
        startTransition(async () => {
          const result = await onTransition(requestId, selected);
          if (result.ok) {
            setDone(true);
          } else {
            setError(result.error ?? "Something went wrong.");
          }
        });
      }}
    >
      <label className="text-sm font-medium text-slate-700" htmlFor="next-status">
        Mark next status
      </label>
      <select
        id="next-status"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value as FinanceStatus)}
      >
        {allowed.map((status) => (
          <option key={status} value={status}>
            {LABELS[status]}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !selected}
        className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {isPending ? "Updating…" : "Update status"}
      </button>
    </form>
  );
}
