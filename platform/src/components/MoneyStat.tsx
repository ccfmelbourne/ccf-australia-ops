// A single dollar figure given its own visual weight -- label above, large
// bold number below -- instead of sitting as just another row in a plain
// details list. Used wherever one total is the most important number on
// the screen (a request's own progress view, an approver's decision view).
export function MoneyStat({ label, amount }: { label: string; amount: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">${amount}</p>
    </div>
  );
}
