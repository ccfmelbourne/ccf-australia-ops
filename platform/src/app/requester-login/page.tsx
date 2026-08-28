export default function RequesterLoginPage() {
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
