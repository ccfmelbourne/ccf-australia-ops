"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import type { UserProfileView } from "@/lib/user-session";

// Replaces the old AppHeader-only shell -- a persistent sidebar on wide
// viewports, collapsing to a hamburger + MobileNav drawer below lg. The
// layout (a Server Component) fetches user/pendingApprovalCount and
// passes them down as plain data props; the interactivity (mobile nav
// open/close, the user menu) lives here and in its children instead.
export function AppShell({
  user,
  pendingApprovalCount,
  children,
}: {
  user: UserProfileView | null;
  pendingApprovalCount: number;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="-m-2 flex h-9 w-9 items-center justify-center rounded-md p-2 text-lg hover:bg-slate-100 lg:hidden"
            >
              <span aria-hidden>☰</span>
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">CCF Australia</p>
              <h1 className="text-lg font-bold text-slate-900">Reimbursements</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell pendingApprovalCount={pendingApprovalCount} />
            {user && <UserMenu user={user} />}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      {mobileNavOpen && <MobileNav onClose={() => setMobileNavOpen(false)} />}
    </div>
  );
}
