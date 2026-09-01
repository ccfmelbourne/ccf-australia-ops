"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOverrideAction } from "@/app/requests/actions";
import { overrideApproveAction } from "@/app/approvals/actions";
import { MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { OverrideOpportunityView } from "@/lib/request-data";

// Visible only to the three fixed tier-4 override committee members --
// getOverrideOpportunities (request-data.ts) returns [] for anyone else,
// so this renders nothing for almost every user. They're not necessarily
// a RequiredApproval row on a given request (their per-ministry role
// assignments are separate from this fixed committee), so they'd
// otherwise have no way to discover a request eligible for the override
// on the normal Approvals list at all.
export function OverrideOpportunities({ opportunities }: { opportunities: OverrideOpportunityView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (opportunities.length === 0) return null;

  function handleRequestOverride(requestId: string) {
    setError(null);
    startTransition(async () => {
      const result = await requestOverrideAction(requestId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleVote(overrideApprovalId: string, approved: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await overrideApproveAction(overrideApprovalId, approved);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-slate-900">Committee Override Opportunities</h2>
      {error && <ErrorBanner message={error} />}
      <ul className="flex flex-col gap-2">
        {opportunities.map((o) => {
          const myApprovalId = o.myOverrideApprovalId;
          return (
            <li key={o.requestId} className="rounded-md border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="flex flex-col">
                  <span className="font-mono text-sm text-slate-700">{o.voucherNo}</span>
                  <span className="text-xs text-slate-500">
                    {o.requesterName} · {MINISTRY_TYPE_LABELS[o.ministryType]}
                  </span>
                </span>
                <span className="font-mono font-semibold text-slate-900">${o.totalAmount}</span>
              </div>
              <div className="mt-3">
                {!o.overrideRequested ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRequestOverride(o.requestId)}
                    className="rounded-md border border-amber-400 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    Request Committee Override
                  </button>
                ) : myApprovalId && o.myVote === null ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleVote(myApprovalId, true)}
                      className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleVote(myApprovalId, false)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {o.myVote === true
                      ? "You approved this override."
                      : o.myVote === false
                        ? "You declined this override."
                        : "Override requested — waiting on the committee."}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
