"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmRegionalDirectorOverrideAction } from "@/app/approvals/actions";
import { MINISTRY_TYPE_LABELS } from "@/lib/request-types";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { RegionalDirectorOverrideOpportunityView } from "@/lib/request-data";

// Visible only to Ross Callado -- getRegionalDirectorOverrideOpportunities
// (request-data.ts) returns [] for anyone else, so this renders nothing
// for almost every user. Much lighter than PR #20's OverrideOpportunities:
// one button, no voting, since this is Ross's own explicit "within
// budget" confirmation, not a 3-person vote.
export function RegionalDirectorOverride({
  opportunities,
}: {
  opportunities: RegionalDirectorOverrideOpportunityView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (opportunities.length === 0) return null;

  function handleConfirm(requestId: string) {
    setError(null);
    startTransition(async () => {
      const result = await confirmRegionalDirectorOverrideAction(requestId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-slate-900">Regional Director Override</h2>
      {error && <ErrorBanner message={error} />}
      <ul className="flex flex-col gap-2">
        {opportunities.map((o) => (
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
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirm(o.requestId)}
                className="rounded-md border border-amber-400 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {isPending ? "Confirming…" : "Confirm — Within Budget"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
