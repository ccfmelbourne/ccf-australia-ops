"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLineItemAction, removeLineItemAction } from "@/app/requests/actions";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SectionHeading } from "@/components/SectionHeading";
import type { DraftLineItemView } from "@/lib/request-data";

export function LineItemManager({
  requestId,
  lineItems,
  totalAmount,
}: {
  requestId: string;
  lineItems: DraftLineItemView[];
  totalAmount: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

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

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeading>Line items</SectionHeading>
        {lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">No line items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-sm">
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-slate-100">
                    <td className="py-2">{li.description}</td>
                    <td className="py-2 text-right font-mono">${li.amount}</td>
                    <td className="py-2 pl-2 text-right">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRemove(li.id)}
                        className="-m-1 p-1 text-xs text-red-600 hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
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
        <SectionHeading>Add a line item</SectionHeading>
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Description
            </label>
            <input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm font-medium text-slate-700">
              Amount
            </label>
            <input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              min="0.01"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <ErrorBanner message={error} />}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Add line item"}
          </button>
        </form>
      </section>
    </div>
  );
}
