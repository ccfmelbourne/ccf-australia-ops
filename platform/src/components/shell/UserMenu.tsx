"use client";

import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/sign-in/actions";
import type { UserProfileView } from "@/lib/user-session";

// The one dropdown-with-outside-click-to-close in this app -- everywhere
// else that needs a dismissible panel is either a native <dialog> (which
// gets focus-trapping and Escape for free) or a plain inline toggle. A
// user-menu button doesn't warrant a full Dialog, so this owns its own
// close-on-outside-click via a document-level mousedown listener,
// registered only while open and torn down on close/unmount.
export function UserMenu({ user }: { user: UserProfileView }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-m-1 flex items-center gap-2 rounded-md p-1 hover:bg-slate-100"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- an external Google profile picture URL, not a local/optimizable asset
          <img src={user.picture} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white"
          >
            {initial}
          </span>
        )}
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user.name}</span>
        <span aria-hidden className="text-xs text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
