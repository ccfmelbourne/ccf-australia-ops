"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRequestAction } from "@/app/requests/actions";
import {
  REQUEST_TYPE_LABELS,
  MINISTRY_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
} from "@/lib/request-types";
import { RequestDrawer } from "./RequestDrawer";
import type { RequestListItemView, DraftRequestView } from "@/lib/request-data";

export function RequestsTable({
  requests,
  openRequest,
}: {
  requests: RequestListItemView[];
  openRequest: DraftRequestView | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function openEdit(id: string) {
    setCreating(false);
    router.push(`/requests?open=${id}`);
  }

  function closeDrawer() {
    setCreating(false);
    router.push("/requests");
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteRequestAction(id);
      if (result.ok) {
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">No requests yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Request</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Ministry</th>
              <th className="py-2 pr-2 text-right">Amount</th>
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
                <td className="py-2 pr-2 text-right font-mono">${r.totalAmount}</td>
                <td className="py-2 pr-2">{REQUEST_STATUS_LABELS[r.status] ?? r.status}</td>
                <td className="py-2 text-right">
                  {r.status === "DRAFT" && (
                    <span className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(r.id)}
                        className="text-teal-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 hover:underline disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <RequestDrawer mode="create" onCreated={openEdit} onClose={closeDrawer} />}
      {openRequest && <RequestDrawer mode="edit" data={openRequest} onClose={closeDrawer} />}
    </div>
  );
}
