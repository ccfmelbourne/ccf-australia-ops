import Link from "next/link";

// A plain outline SVG rather than the 🔔 emoji -- the emoji renders in
// full color via the OS's own emoji font, which stood out against the
// rest of the app's monochrome icons/symbols (×, ↑, ✓, ●, ○, all
// currentColor). This one line-icon path is common/standard (a bell with
// its clapper), stroked so it inherits text-slate-600 like everything
// else in the header instead of carrying its own fixed color.
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// No notification inbox exists in this app -- the badge is a real count
// (derived from the same getPendingApprovalsForUser count /approvals
// itself uses), not a decorative one, so it only ever appears when
// there's something to actually act on. Capped at "9+" past 9 rather than
// growing the badge to fit an arbitrarily wide number.
export function NotificationBell({ pendingApprovalCount }: { pendingApprovalCount: number }) {
  const badgeText = pendingApprovalCount > 9 ? "9+" : String(pendingApprovalCount);
  return (
    <Link
      href="/approvals"
      aria-label={
        pendingApprovalCount > 0 ? `${pendingApprovalCount} approval(s) awaiting you` : "Notifications"
      }
      className="relative -m-2 flex h-9 w-9 items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100"
    >
      <BellIcon />
      {pendingApprovalCount > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
