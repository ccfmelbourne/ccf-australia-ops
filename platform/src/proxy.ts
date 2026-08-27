import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic check only (cookie presence), per Next's own guidance — Proxy
// isn't meant for the slow/authoritative check. It exists specifically to
// stop /finance/* Server Components from starting their data fetch (and
// hitting Postgres) before an unauthenticated request gets redirected; the
// authoritative signature check still happens in src/app/finance/layout.tsx
// via isFinanceAuthenticated().
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has("finance_session");
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/finance/:path*",
};
