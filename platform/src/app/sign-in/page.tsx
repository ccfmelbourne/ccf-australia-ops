import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentActiveUserId } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // getCurrentActiveUserId, not the plain cookie-only getCurrentUserId --
  // a suspended user's still-valid cookie must not redirect here, or the
  // (app) layout's own active-user check immediately bounces them back
  // (an infinite redirect loop, found live).
  const userId = await getCurrentActiveUserId();
  if (userId) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-6">
      {/* Static, not an ambient loop -- keeps the "no background
          animation" rule's spirit even on this one exception page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_var(--color-cyan-100),transparent)]"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="signin-fade-up flex flex-col items-center gap-3 text-center">
          <Image src="/ccfmelbourne-logo.png" alt="CCF Melbourne" width={140} height={70} priority />
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
            CCF Australia Operations
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Reimbursements</h1>
          <p className="text-sm text-slate-500">Sign in with your Google account to continue.</p>
        </div>

        {error && (
          <p
            className="signin-fade-up w-full rounded-md border border-red-300 bg-red-50 p-3 text-center text-sm text-red-700"
            style={{ animationDelay: "80ms" }}
          >
            Access denied, your account isn&apos;t authorised to use CCF Australia Operations. Please
            contact the CCOMMS administrator if you need access.
          </p>
        )}

        <a
          href="/api/auth/google"
          className="signin-fade-up flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:bg-teal-700 hover:-translate-y-0.5 active:translate-y-0"
          style={{ animationDelay: "120ms" }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path
              fill="currentColor"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
            />
            <path
              fill="currentColor"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="currentColor"
              d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09Z"
            />
            <path
              fill="currentColor"
              d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
            />
          </svg>
          Sign in with Google
        </a>

        {process.env.NODE_ENV !== "production" && (
          <div className="signin-fade-up flex flex-col items-center gap-2 border-t border-slate-200 pt-6" style={{ animationDelay: "160ms" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Local testing only
            </p>
            <div className="flex gap-3">
              <a
                href="/api/dev/login?as=requester"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log in as test requester
              </a>
              <a
                href="/api/dev/login?as=approver"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log in as test approver
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
