"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  onTransition: (
    requestId: string,
    toStatus: FinanceStatus,
  ) => Promise<{ ok: boolean; error?: string; emailWarning?: string }>;
}) {
  // Track the status just submitted (not just a "done" flag) so this can
  // tell whether the *new* status is terminal — currentStatus itself stays
  // stale until the page reloads/navigates back.
  const [submittedStatus, setSubmittedStatus] = useState<FinanceStatus | null>(null);
  const effectiveStatus = submittedStatus ?? currentStatus;
  const allowed = getAllowedNextStatuses(effectiveStatus);
  const [selected, setSelected] = useState<FinanceStatus | "">(allowed[0] ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = submittedStatus !== null;

  if (allowed.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">
          <StatusBadge status={effectiveStatus} /> is a final status — no further action needed.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected || done) return;
        setError(null);
        startTransition(async () => {
          const result = await onTransition(requestId, selected);
          if (result.ok) {
            setSubmittedStatus(selected);
            if (result.emailWarning) {
              toast.warning(result.emailWarning);
            } else {
              toast.success("Status updated.");
            }
          } else {
            setError(result.error ?? "Something went wrong.");
          }
        });
      }}
    >
      <label className="text-sm font-medium text-slate-700" htmlFor="next-status">
        Mark next status
      </label>
      {/* disabled once submitted: currentStatus is now stale until the page
          reloads or navigates back, so this can't be safely resubmitted */}
      <fieldset disabled={done} className="flex flex-col gap-3 disabled:opacity-60">
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
          disabled={isPending || !selected || done}
          className="inline-flex w-fit items-center gap-2 self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {isPending && (
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {done ? "Submitted" : isPending ? "Submitting…" : "Submit"}
        </button>
      </fieldset>
    </form>
  );
}
