import { Card } from "@/components/Card";

// A bordered tile for one count -- deliberately separate from MoneyStat
// (which is hardcoded to a $-prefixed dollar figure with no border) since
// this is a plain integer in a Card, not a currency amount.
export function StatCard({ label, count }: { label: string; count: number }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{count}</p>
    </Card>
  );
}
