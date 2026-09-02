import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cleanupStaleEmptyDrafts } from "@/lib/request-data";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (vercel.json's "crons") -- Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` when that env var is set, so
// checking it here is what stops anyone else who finds this URL from
// triggering it. Refuses the request outright if CRON_SECRET isn't
// configured at all, rather than matching against the literal string
// "Bearer undefined".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deletedCount = await cleanupStaleEmptyDrafts();
  return NextResponse.json({ ok: true, deletedCount });
}
