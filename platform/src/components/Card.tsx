import type { HTMLAttributes } from "react";

// Matches the bordered-container styling already used everywhere in the
// app for a self-contained block of fields (BankDetailsManager's form,
// LineItemManager's add-item form, RegionalDirectorOverride's list rows).
// Existing call sites still inline these classes directly -- adopting this
// component there is a separate migration -- but this is the canonical
// version Storybook documents, and new bordered containers should use it.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-md border border-slate-200 p-4 ${className ?? ""}`} {...props} />;
}
