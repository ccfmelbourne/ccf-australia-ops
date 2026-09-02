import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

// Matches the text input styling already used everywhere in the app
// (BankDetailsManager, LineItemManager's add-item form). Existing call
// sites still inline these classes directly -- adopting this component
// there is a separate migration -- but this is the canonical version
// Storybook documents, and new inputs should use it.
export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={`rounded-md border px-3 py-2 text-sm ${
        error ? "border-red-400 focus:border-red-500" : "border-slate-300"
      } ${className ?? ""}`}
      {...props}
    />
  );
}
