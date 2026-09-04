// One shared function so Sidebar (desktop) and MobileNav (the hamburger
// drawer) never drift out of sync with each other. The Admin link is only
// a UI nicety hidden for non-admins -- the actual gate is /admin/page.tsx's
// own requireAdmin() check, not this list.
export function getNavItems(isAdmin: boolean) {
  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/requests", label: "My Requests" },
    { href: "/approvals", label: "Approvals" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ] as const;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
