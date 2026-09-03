import type { HTMLAttributes } from "react";

// Matches the bordered-container styling already used app-wide for a
// self-contained block of fields. Existing call sites still inline these
// classes directly (a separate migration), but new bordered containers
// should use this.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-md border border-slate-200 p-4 ${className ?? ""}`} {...props} />;
}
