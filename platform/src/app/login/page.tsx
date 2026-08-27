import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">CCF Australia — Finance</h1>
        <p className="text-sm text-slate-500">Sign in to access the Finance queue.</p>
      </div>
      <LoginForm />
    </main>
  );
}
