import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { getMeetingDetails } from "@/lib/fireflies/client";
import { fetchSyncContext } from "@/lib/sync/fetch-sync-context";
import { extractFromTranscript } from "@/lib/sync/sync-extraction";
import { applyExtractionResult, buildRawSnippet, touchedProjectIds } from "@/lib/sync/apply-writes";
import { recomputeDelayForProjects } from "@/lib/sync/recompute-delay";
import type { SyncRunTrigger } from "@/lib/types";

export type ProcessResult =
  | { status: "success" }
  | { status: "no_confident_match" }
  | { status: "skipped_duplicate" }
  | { status: "failed"; error: string };

// Shared by the webhook route and the cron route so classification/write
// rules can never diverge between the two triggers. Never throws — every
// failure is caught, logged to sync_runs, and returned as a typed result so
// callers can decide how to respond (webhook still 200s to Fireflies; cron
// moves on to the next transcript) without ever reporting success it didn't
// achieve (prompt.md rule 25).
export async function processTranscript(
  transcriptId: string,
  options: { trigger: SyncRunTrigger; dryRun?: boolean }
): Promise<ProcessResult> {
  const supabase = createServiceRoleClient();
  const dryRun = options.dryRun ?? false;

  // Idempotency layer 1: cheap check before spending an LLM call. The
  // advisory lock inside the RPCs is the layer-2 guard against a true race;
  // ON CONFLICT DO NOTHING on the final insert is layer 3.
  const { data: existing, error: existingError } = await supabase
    .from("processed_transcripts")
    .select("id")
    .eq("fireflies_transcript_id", transcriptId)
    .maybeSingle();

  if (existingError) {
    return { status: "failed", error: `processed_transcripts lookup failed: ${existingError.message}` };
  }

  if (existing) {
    return { status: "skipped_duplicate" };
  }

  const { data: runRow, error: runInsertError } = await supabase
    .from("sync_runs")
    .insert({ fireflies_transcript_id: transcriptId, trigger: options.trigger, status: "failed" })
    .select("id")
    .single();

  if (runInsertError || !runRow) {
    return { status: "failed", error: `sync_runs insert failed: ${runInsertError?.message}` };
  }

  try {
    const transcript = await getMeetingDetails(transcriptId);
    const context = await fetchSyncContext();
    const { result, rawResponse } = await extractFromTranscript(transcript, context);

    if (dryRun) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", llm_raw_response: rawResponse, finished_at: new Date().toISOString() })
        .eq("id", runRow.id);
      return { status: "success" };
    }

    const outcome = await applyExtractionResult(result, context, {
      transcriptId,
      meetingDate: transcript.dateString,
      meetingTitle: transcript.title,
      attendees: transcript.participants,
      rawSnippet: buildRawSnippet(transcript),
    });

    if (outcome.status === "success") {
      await recomputeDelayForProjects(touchedProjectIds(result));
    }

    await supabase
      .from("sync_runs")
      .update({
        status: outcome.status,
        llm_raw_response: rawResponse,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);

    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await supabase
      .from("sync_runs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", runRow.id);

    return { status: "failed", error: message };
  }
}
