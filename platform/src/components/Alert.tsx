import type { ReactNode } from "react";

export type AlertTone = "danger" | "warning";

const TONE_CLASSES: Record<AlertTone, string> = {
  danger: "border-red-300 bg-red-50 text-red-700",
  warning: "border-amber-300 bg-amber-50 text-amber-700",
};

export interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
}

// The bordered-banner styling ErrorBanner already used, pulled out as a
// generic tone-parameterized primitive that ErrorBanner now builds on.
// Only danger/warning exist -- the only two flat single-message banners
// the app needed (RequestDrawer's richer heading+body box stays its own
// markup).
export function Alert({ tone = "danger", children }: AlertProps) {
  return (
    <div role="alert" className={`rounded-md border p-3 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
