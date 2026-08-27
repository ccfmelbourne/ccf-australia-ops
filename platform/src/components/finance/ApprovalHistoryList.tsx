import type { ApprovalHistoryEntryView } from "@/types/finance";

const ROLE_LABELS: Record<ApprovalHistoryEntryView["role"], string> = {
  MINISTRY_OVERSEER: "Ministry Overseer",
  COS1: "COS 1",
  COS2: "COS 2",
  FINANCE_OVERSEER: "Finance Overseer",
  REGIONAL_DIRECTOR: "Regional Director",
};

export function ApprovalHistoryList({ entries }: { entries: ApprovalHistoryEntryView[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No approval history recorded.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-slate-800">{ROLE_LABELS[entry.role]}</p>
            <p className="text-slate-500">{entry.approverName ?? "Unassigned"}</p>
          </div>
          <div className="text-right">
            <p
              className={
                entry.status === "APPROVED"
                  ? "font-semibold text-emerald-700"
                  : entry.status === "REJECTED"
                    ? "font-semibold text-red-700"
                    : "text-slate-500"
              }
            >
              {entry.status}
            </p>
            {entry.decidedAt && (
              <p className="text-xs text-slate-400">
                {new Date(entry.decidedAt).toLocaleDateString("en-AU")}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
