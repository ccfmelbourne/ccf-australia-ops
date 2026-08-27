import { redirect } from "next/navigation";
import { isFinanceAuthenticated, getFinanceAccountantName } from "@/lib/finance-auth";
import { financeLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const authed = await isFinanceAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">CCF Australia</p>
          <h1 className="text-lg font-bold text-slate-900">Finance</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{getFinanceAccountantName()}</span>
          <form action={financeLogoutAction}>
            <button type="submit" className="text-teal-700 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
