import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "active" | "warning" | "success" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  active: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-teal-50 text-teal-700",
  danger: "bg-red-50 text-red-700",
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}

// The pill styling RequestStatusBadge already used for every request
// status -- pulled out here as the generic primitive so any future badge
// (not just request status) can reuse the same five tones instead of
// re-deriving its own color map. RequestStatusBadge now builds on this.
export function Badge({ tone = "neutral", icon, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
