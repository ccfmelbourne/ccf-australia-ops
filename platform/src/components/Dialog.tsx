"use client";

import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

export interface DialogProps {
  titleId: string;
  title: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  // Re-runs the showModal() effect when it changes, instead of only once
  // on mount -- RequestDrawer deliberately reuses one <Dialog> instance
  // across its create -> edit handoff (see RequestDrawer.tsx's own
  // sessionKey comment for why: a fast close-then-reopen can land as new
  // props on the same instance, and an effect keyed on [] would silently
  // never reopen it). Omit it for a panel that's always freshly mounted
  // per session (ApprovalDrawer, RequestProgressDrawer) -- it then
  // defaults to a stable value, i.e. functionally just [].
  resetKey?: string | number;
  // Filled in with a stable close() function once the dialog mounts, via
  // an effect rather than during render -- every real panel needs to
  // trigger a close from places besides a plain JSX onClick (a Close
  // button reachable after scrolling, an async action's success path,
  // RequestDrawer's own empty-draft cleanup on close), so this is a ref
  // the caller creates and reads from wherever it needs to, rather than
  // a callback threaded through every intermediate function.
  closeRef?: RefObject<(() => void) | null>;
}

// The native <dialog> shell every side panel in the app already uses
// (RequestDrawer, ApprovalDrawer, RequestProgressDrawer): shown via
// showModal() on mount, a left-aligned panel that's full-width on small
// viewports (max-w-xl caps it on wide ones), no backdrop-click-to-close
// (closedby="none" -- confirmed with the decision-maker after a report of
// accidentally closing a panel via a stray click near its edge), and a
// header row with a title, an optional badge, and the X that's the
// primary way to dismiss it.
export function Dialog({ titleId, title, badge, onClose, children, resetKey, closeRef }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleClose() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [resetKey]);

  // No dependency array -- keeps closeRef.current pointing at the latest
  // handleClose on every render, matching how a plain onClick prop would
  // always call the current render's version. handleClose itself doesn't
  // actually change between renders (dialogRef is stable), so this is
  // cheap regardless.
  useEffect(() => {
    if (closeRef) closeRef.current = handleClose;
  });

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      closedby="none"
      aria-labelledby={titleId}
      className="drawer-panel fixed inset-y-0 left-0 m-0 h-dvh w-full max-w-xl overflow-y-auto rounded-r-lg bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="flex items-center gap-2">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          {badge}
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="-m-2 p-2 text-2xl leading-none text-slate-500 hover:text-slate-700"
        >
          &times;
        </button>
      </div>

      <div className="flex flex-col gap-6 pt-4">{children}</div>
    </dialog>
  );
}
