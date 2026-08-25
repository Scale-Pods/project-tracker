import { NextRequest, NextResponse } from "next/server";
import { searchMeetings } from "@/lib/fireflies/client";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { processTranscript } from "@/lib/sync/process-transcript";
import { recomputeDelayPortfolioWide } from "@/lib/sync/recompute-delay";

export const runtime = "nodejs";
// Processing several transcripts sequentially (each a Claude call) can
// comfortably exceed 300s, especially for a long meeting — raised to the
// Vercel Pro/Fluid compute ceiling. The route is idempotent per transcript
// (processed_transcripts + the RPC's own guards), so even if a run is still
// cut off, re-triggering safely picks up wherever it left off.
export const maxDuration = 800;

// The reconciliation pass always looks at just the most recent N occurrences
// of one recurring meeting, not a date window or an account-wide listing —
// keeps each cron run's Fireflies listing and Claude spend bounded, and
// keeps this in sync with the Fireflies webhook, which is itself filtered
// to only fire for this same meeting title.
const RECONCILE_MEETING_COUNT = 10;
const RECONCILE_MEETING_TITLE = "Catchup Tech Team | ScalePods";

// Daily safety net: reconciles any of the last 10 occurrences of the
// Catchup Tech Team stand-up the webhook missed, then does a portfolio-wide
// delay/status sweep so calendar-day drift (a project silently becoming
// overdue with no new transcript) still gets corrected.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const meetings = await searchMeetings(RECONCILE_MEETING_COUNT, RECONCILE_MEETING_TITLE);

  const { data: processed, error: processedError } = await supabase
    .from("processed_transcripts")
    .select("fireflies_transcript_id")
    .in(
      "fireflies_transcript_id",
      meetings.map((m) => m.id)
    );

  if (processedError) {
    return NextResponse.json({ error: processedError.message }, { status: 500 });
  }

  const processedIds = new Set((processed ?? []).map((p) => p.fireflies_transcript_id));
  const unprocessed = meetings.filter((m) => !processedIds.has(m.id));

  const results = [];
  for (const meeting of unprocessed) {
    const result = await processTranscript(meeting.id, { trigger: "cron" });
    results.push({ meetingId: meeting.id, ...result });
  }

  await recomputeDelayPortfolioWide();

  return NextResponse.json({
    checked: meetings.length,
    processed: results.length,
    results,
  });
}
