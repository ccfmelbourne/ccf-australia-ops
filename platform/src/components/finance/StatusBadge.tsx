import type { FinanceStatus } from "@/types/finance";

const LABELS: Record<FinanceStatus, string> = {
  READY_FOR_PROCESSING: "Ready for Processing",
  NEEDS_CLARIFICATION: "Needs Clarification",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  REJECTED_RETURNED: "Rejected / Returned",
};

const STYLES: Record<FinanceStatus, string> = {
  READY_FOR_PROCESSING: "bg-teal-50 text-teal-800 border-teal-300",
  NEEDS_CLARIFICATION: "bg-amber-50 text-amber-800 border-amber-300",
  PROCESSING: "bg-blue-50 text-blue-800 border-blue-300",
  PROCESSED: "bg-emerald-50 text-emerald-800 border-emerald-300",
  REJECTED_RETURNED: "bg-red-50 text-red-800 border-red-300",
};

export function StatusBadge({ status }: { status: FinanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
