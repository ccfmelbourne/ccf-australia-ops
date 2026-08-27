"use client";

import { useActionState } from "react";
import { financeLoginAction } from "@/app/finance/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(financeLoginAction, { error: null });

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Finance password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
