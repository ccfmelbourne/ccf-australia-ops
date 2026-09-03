"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLineItemAction, removeLineItemAction, updateLineItemAction } from "@/app/requests/actions";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { SectionHeading } from "@/components/SectionHeading";
import type { DraftLineItemView } from "@/lib/request-data";

export function LineItemManager({
  requestId,
  lineItems,
  totalAmount,
  onPendingChange,
}: {
  requestId: string;
  lineItems: DraftLineItemView[];
  totalAmount: string;
  // Reports this component's own isPending upward -- a remove (or an
  // add) is a server round-trip followed by router.refresh(), and until
  // that resolves, the `lineItems` prop is still the pre-mutation value.
  // A wizard step's own Continue button gates on lineItems.length alone,
  // so without this, removing the only line item and clicking Continue
  // in that window advanced to the next step with zero items -- found
  // live. The caller factors this into its own gating instead of this
  // component trying to disable buttons outside itself.
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  // Correcting an auto-scanned "<merchant> | <item>" description OCR got
  // wrong -- common enough (real receipt/invoice layouts vary a lot) that
  // remove-and-re-add alone wasn't a good enough fix. Only one row edits
  // at a time; its own error stays scoped to editError rather than the
  // shared banner below, since a failed save shouldn't look like it came
  // from the "Add a line item" form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addLineItemAction(requestId, description, amount);
      if (result.ok) {
        setDescription("");
        setAmount("");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleRemove(lineItemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeLineItemAction(lineItemId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function startEdit(li: DraftLineItemView) {
    setEditError(null);
    setEditingId(li.id);
    setEditDescription(li.description);
    setEditAmount(li.amount);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleSaveEdit(lineItemId: string) {
    setEditError(null);
    startTransition(async () => {
      const result = await updateLineItemAction(lineItemId, editDescription, editAmount);
      if (result.ok) {
        setEditingId(null);
        router.refresh();
      } else {
        setEditError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeading>Items</SectionHeading>
        {lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-sm">
              <tbody>
                {lineItems.map((li) =>
                  editingId === li.id ? (
                    <tr key={li.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2" colSpan={2}>
                        <div className="flex flex-col gap-2">
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            aria-label="Description"
                            disabled={isPending}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
                          />
                          <input
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            aria-label="Amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            disabled={isPending}
                            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-right font-mono text-sm disabled:opacity-60"
                          />
                          {editError && <ErrorBanner message={editError} />}
                        </div>
                      </td>
                      <td className="py-2 pl-2 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSaveEdit(li.id)}
                            className="-m-1 p-1 text-xs text-teal-700 hover:underline disabled:opacity-60"
                          >
                            {isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={cancelEdit}
                            className="-m-1 p-1 text-xs text-slate-500 hover:underline disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={li.id} className="border-b border-slate-100">
                      <td className="py-2">{li.description}</td>
                      <td className="py-2 text-right font-mono">${li.amount}</td>
                      <td className="py-2 pl-2 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => startEdit(li)}
                            className="-m-1 p-1 text-xs text-teal-700 hover:underline disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRemove(li.id)}
                            className="-m-1 p-1 text-xs text-red-600 hover:underline disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                <tr className="border-t-2 border-slate-300">
                  <td className="py-2 font-semibold">Total</td>
                  <td className="py-2 text-right font-mono font-semibold">${totalAmount}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeading>Add an item</SectionHeading>
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm font-medium text-slate-700">
              Amount
            </label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? "Saving…" : "Add item"}
          </Button>
        </form>
      </section>
    </div>
  );
}
