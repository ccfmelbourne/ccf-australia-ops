import { getFinanceQueue } from "@/lib/finance-data";
import { QueueList } from "@/components/finance/QueueList";

export const dynamic = "force-dynamic";

export default async function FinanceQueuePage() {
  const items = await getFinanceQueue();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Finance Queue ({items.length})
      </h2>
      <QueueList items={items} />
    </div>
  );
}
