import { redirect } from "next/navigation";
import { getCurrentActiveUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // getCurrentActiveUserId, not the plain cookie-only getCurrentUserId --
  // a suspended user's still-valid cookie must not count as "already
  // signed in" here, or this redirects them to /dashboard only for the
  // (app) layout's own active-user check to immediately bounce them back,
  // an infinite redirect loop (found live).
  const userId = await getCurrentActiveUserId();
  if (userId) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">CCF Australia — Reimbursements</h1>
        <p className="text-sm text-slate-500">Sign in with your Google account to continue.</p>
      </div>
      {error && (
        <p className="max-w-xs rounded-md border border-red-300 bg-red-50 p-3 text-center text-sm text-red-700">
          Access denied, your account isn&apos;t authorised to use CCF Australia Operations. Please
          contact the CCOMMS administrator if you need access.
        </p>
      )}
      <a
        href="/api/auth/google"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Sign in with Google
      </a>
      {process.env.NODE_ENV !== "production" && (
        <div className="flex flex-col items-center gap-2 border-t border-slate-200 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Local testing only
          </p>
          <div className="flex gap-3">
            <a
              href="/api/dev/login?as=requester"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Log in as test requester
            </a>
            <a
              href="/api/dev/login?as=approver"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Log in as test approver
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
