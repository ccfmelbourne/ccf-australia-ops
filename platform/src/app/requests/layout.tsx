import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/user-session";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
