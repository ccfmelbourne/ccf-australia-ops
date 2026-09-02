import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

// Matches the <select> styling already used everywhere in the app
// (RequestDrawer's request-type/ministry pickers) -- same base classes as
// Input, since a native select is styled identically to a text input here.
// Existing call sites still inline these classes directly -- adopting this
// component there is a separate migration -- but this is the canonical
// version Storybook documents, and new selects should use it.
export function Select({ error, className, ...props }: SelectProps) {
  return (
    <select
      className={`rounded-md border px-3 py-2 text-sm disabled:opacity-60 ${
        error ? "border-red-400 focus:border-red-500" : "border-slate-300"
      } ${className ?? ""}`}
      {...props}
    />
  );
}
