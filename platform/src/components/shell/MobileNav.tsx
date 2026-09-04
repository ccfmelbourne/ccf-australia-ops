"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { getNavItems, isNavItemActive } from "./nav-items";

// The same nav items Sidebar renders as a column, shown here inside the
// existing Dialog component as a slide-in drawer -- reuses its
// showModal()/closedby="none"/left-aligned-panel behavior rather than
// building a second, parallel drawer implementation.
export function MobileNav({ onClose, isAdmin }: { onClose: () => void; isAdmin: boolean }) {
  const closeRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  return (
    <Dialog titleId="mobile-nav-title" title="Menu" onClose={onClose} closeRef={closeRef}>
      <nav className="flex flex-col gap-1">
        {getNavItems(isAdmin).map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => closeRef.current?.()}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </Dialog>
  );
}
