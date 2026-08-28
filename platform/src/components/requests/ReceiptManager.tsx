"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadReceiptAction,
  removeReceiptAction,
  extractReceiptAction,
  addLineItemAction,
} from "@/app/requests/actions";
import type { DraftReceiptView } from "@/lib/request-data";
import type { ReceiptExtractionResult } from "@/lib/receipt-extraction";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.heic";

interface SuggestionState {
  receiptId: string;
  merchant: string;
  amount: string;
  date: string | null;
  gst: number | null;
  editing: boolean;
}

function toSuggestionState(receiptId: string, result: ReceiptExtractionResult): SuggestionState {
  return {
    receiptId,
    merchant: result.merchant ?? "",
    amount: result.amount !== null ? result.amount.toFixed(2) : "",
    date: result.date,
    gst: result.gst,
    editing: false,
  };
}

export function ReceiptManager({
  requestId,
  receipts,
}: {
  requestId: string;
  receipts: DraftReceiptView[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The suggestion card is purely a review step -- nothing is added as a
  // real line item until "Confirm" is clicked, and it never auto-populates
  // financial data without that explicit confirmation.
  const [scanningReceiptId, setScanningReceiptId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadReceiptAction(requestId, formData);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
      // Clear so choosing the same file again still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemove(receiptId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeReceiptAction(receiptId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleScan(receiptId: string) {
    setError(null);
    setSuggestion(null);
    setScanningReceiptId(receiptId);
    startTransition(async () => {
      const result = await extractReceiptAction(receiptId);
      setScanningReceiptId(null);
      if (result.ok && result.result) {
        setSuggestion(toSuggestionState(receiptId, result.result));
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleConfirmSuggestion() {
    if (!suggestion) return;
    const description = suggestion.merchant.trim();
    if (!description || Number(suggestion.amount) <= 0) return;
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(requestId, description, suggestion.amount);
      if (result.ok) {
        setSuggestion(null);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Receipts
      </h2>
      {receipts.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">No receipts attached yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="truncate font-mono text-slate-700">{r.filename}</span>
              <span className="flex shrink-0 gap-3">
                {/* Signed URL computed server-side at render time (expires
                    after a few minutes) -- a plain link, no click-time
                    fetch needed. */}
                <a
                  href={r.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:underline"
                >
                  View
                </a>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleScan(r.id)}
                  className="text-teal-700 hover:underline disabled:opacity-60"
                >
                  {scanningReceiptId === r.id ? "Scanning…" : "Scan for suggested information"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(r.id)}
                  className="text-red-600 hover:underline disabled:opacity-60"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {suggestion && (
        <div className="mb-3 flex flex-col gap-3 rounded-md border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-slate-700">Suggested information</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Merchant</dt>
            <dd>
              {suggestion.editing ? (
                <input
                  value={suggestion.merchant}
                  onChange={(e) => setSuggestion({ ...suggestion, merchant: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              ) : (
                suggestion.merchant || "—"
              )}
            </dd>
            <dt className="text-slate-500">Date</dt>
            <dd>{suggestion.date ?? "—"}</dd>
            <dt className="text-slate-500">Amount</dt>
            <dd>
              {suggestion.editing ? (
                <input
                  value={suggestion.amount}
                  onChange={(e) => setSuggestion({ ...suggestion, amount: e.target.value })}
                  type="number"
                  step="0.01"
                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              ) : suggestion.amount ? (
                `$${suggestion.amount}`
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-slate-500">GST</dt>
            <dd>{suggestion.gst !== null ? `$${suggestion.gst.toFixed(2)}` : "—"}</dd>
          </dl>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isPending || !suggestion.merchant.trim() || !(Number(suggestion.amount) > 0)}
              onClick={handleConfirmSuggestion}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {isPending ? "Adding…" : "✓ Confirm"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setSuggestion({ ...suggestion, editing: true })}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setSuggestion(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
        {/* The real file input stays functional (keyboard/AT accessible)
            but visually hidden -- the button below triggers it, so
            "choose a file" and "upload" are a single click instead of two
            separate steps. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChosen}
          className="sr-only"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {isPending ? "Uploading…" : "Upload a receipt"}
        </button>
        <p className="text-xs text-slate-500">PDF, JPEG, PNG, or HEIC. Max 10MB.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
