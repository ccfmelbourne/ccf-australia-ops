import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendStaleDraftReminders } from "@/lib/request-data";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron -- see cleanup-stale-drafts/route.ts for why the
// CRON_SECRET check is what stops anyone else who finds this URL from
// triggering it.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sent, candidateCount } = await sendStaleDraftReminders();
  return NextResponse.json({ ok: true, sent, candidateCount });
}
