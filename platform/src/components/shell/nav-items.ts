// One shared list so Sidebar (desktop) and MobileNav (the hamburger
// drawer) never drift out of sync with each other.
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/requests", label: "My Requests" },
  { href: "/approvals", label: "Approvals" },
] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
