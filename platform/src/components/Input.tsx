import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

// Matches the text input styling already used app-wide. Existing call
// sites still inline these classes directly (a separate migration), but
// new inputs should use this.
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
