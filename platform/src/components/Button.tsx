import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "warning";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-100",
  danger: "border border-red-300 text-red-600 hover:bg-red-50",
  warning: "border border-amber-300 text-amber-700 hover:bg-amber-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Matches the button styling already used app-wide. Existing call sites
// still inline these classes directly (a separate migration), but new
// buttons should use this.
export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
