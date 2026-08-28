"use client";

import { useActionState } from "react";
import { createDraftRequestAction } from "@/app/requests/actions";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  MINISTRY_TYPES,
  MINISTRY_TYPE_LABELS,
} from "@/lib/request-types";

export function CreateRequestForm() {
  const [state, formAction, pending] = useActionState(createDraftRequestAction, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-slate-200 p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="requestType" className="text-sm font-medium text-slate-700">
          Request type
        </label>
        <select
          id="requestType"
          name="requestType"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {REQUEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {REQUEST_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ministryType" className="text-sm font-medium text-slate-700">
          Ministry
        </label>
        <select
          id="ministryType"
          name="ministryType"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {MINISTRY_TYPES.map((type) => (
            <option key={type} value={type}>
              {MINISTRY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
