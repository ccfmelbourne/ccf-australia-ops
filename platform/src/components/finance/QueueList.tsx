import Link from "next/link";
import type { QueueItemView } from "@/types/finance";
import { StatusBadge } from "./StatusBadge";

export function QueueList({ items }: { items: QueueItemView[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Nothing in the Finance queue right now.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-4">Voucher</th>
          <th className="py-2 pr-4">Requester</th>
          <th className="py-2 pr-4">Ministry</th>
          <th className="py-2 pr-4 text-right">Amount</th>
          <th className="py-2 pr-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-3 pr-4">
              <Link
                href={`/finance/${item.id}`}
                className="font-mono text-teal-700 hover:underline"
              >
                {item.voucherNo}
              </Link>
            </td>
            <td className="py-3 pr-4">{item.requesterName}</td>
            <td className="py-3 pr-4">{item.ministryType}</td>
            <td className="py-3 pr-4 text-right font-mono">${item.totalAmount}</td>
            <td className="py-3 pr-4">
              <StatusBadge status={item.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
