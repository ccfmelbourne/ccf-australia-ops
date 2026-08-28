import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user-session";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RequesterLoginPage() {
  const userId = await getCurrentUserId();
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  if (user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">You&apos;re signed in</h1>
          <p className="text-sm text-slate-500">
            {user.name} ({user.email})
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Request creation isn&apos;t built yet — check back soon.
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">CCF Australia — Reimbursements</h1>
        <p className="text-sm text-slate-500">Sign in with your Google account to continue.</p>
      </div>
      <a
        href="/api/auth/google"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Sign in with Google
      </a>
    </main>
  );
}
