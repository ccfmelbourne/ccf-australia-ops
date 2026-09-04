"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems, isNavItemActive } from "./nav-items";

// Desktop-only (hidden below lg) -- MobileNav renders the same nav items
// inside a drawer for narrower viewports instead of this column.
export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 lg:flex">
      {getNavItems(isAdmin).map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
