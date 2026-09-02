import { signOutAction } from "@/app/sign-in/actions";

// Approvals and My Requests both render on the single /requests landing
// page now, so no nav is needed here -- just the header/sign-out.
export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">CCF Australia</p>
        <h1 className="text-lg font-bold text-slate-900">Reimbursements</h1>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="-m-1 p-1 text-sm text-teal-700 hover:underline">
          Sign out
        </button>
      </form>
    </header>
  );
}
