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

// The bordered-banner styling ErrorBanner already used for every inline
// error -- pulled out here as the generic, tone-parameterized primitive.
// ErrorBanner now builds on this. Only danger/warning exist because
// they're the only two the app actually needed a flat single-message
// banner for (RequestDrawer's richer amber "changes requested" box has a
// heading plus body text, not a single message, so it isn't a fit here
// and stays as its own markup).
export function Alert({ tone = "danger", children }: AlertProps) {
  return (
    <div role="alert" className={`rounded-md border p-3 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
