import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { signOutAction } from "@/app/requester-login/actions";

export const dynamic = "force-dynamic";

export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/requester-login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">CCF Australia</p>
          <h1 className="text-lg font-bold text-slate-900">Reimbursements</h1>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-teal-700 hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-2xl p-6">{children}</main>
    </div>
  );
}
