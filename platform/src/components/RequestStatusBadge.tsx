import { REQUEST_STATUS_META, type RequestStatusTone } from "@/lib/request-types";

// One consistent visual language for a request's status, used everywhere
// it's shown (dashboard, request list, request detail, approval screen) --
// the label/icon/tone per status live in request-types.ts's
// REQUEST_STATUS_META, this component only owns how a "tone" maps to
// actual Tailwind classes.
const TONE_CLASSES: Record<RequestStatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  active: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-teal-50 text-teal-700",
  danger: "bg-red-50 text-red-700",
};

export function RequestStatusBadge({ status }: { status: string }) {
  // Falls back to the raw status string rather than throwing -- old/seeded
  // data or a future enum value this component hasn't been told about yet
  // should never break the page, just look slightly generic.
  const meta = REQUEST_STATUS_META[status] ?? { label: status, icon: "●" as const, tone: "neutral" as const };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[meta.tone]}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
