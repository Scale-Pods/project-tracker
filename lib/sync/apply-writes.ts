import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import type { FirefliesMeetingDetails } from "@/lib/fireflies/client";
import type { SyncContext } from "@/lib/sync/fetch-sync-context";
import type { ExtractionResult, ExtractionSegment } from "@/lib/sync/sync-extraction";

// Confidence-routing thresholds, prompt.md Section 6.5. Gemini assigns a
// confidence per statement; this is the one place that decides where it
// actually lands. Never trust Gemini's own opinion on which table to write.
const LIVE_THRESHOLD = 0.8;
const REVIEW_THRESHOLD = 0.5;

type QueueItem = { field_name: string; proposed_value: string; confidence: number };

type SegmentWrites = {
  blockers: Record<string, unknown>[];
  pending_tasks: Record<string, unknown>[];
  milestones: Record<string, unknown>[];
  remarks: Record<string, unknown>[];
  pending_review_queue: QueueItem[];
  stage_change: { new_stage: string; confidence: number } | null;
  awaiting_closure: boolean;
};

function confidenceTier(confidence: number): "live" | "unverified" | "review" {
  if (confidence >= LIVE_THRESHOLD) return "live";
  if (confidence >= REVIEW_THRESHOLD) return "unverified";
  return "review";
}

function buildSegmentWrites(
  segment: ExtractionSegment,
  context: SyncContext
): SegmentWrites {
  const writes: SegmentWrites = {
    blockers: [],
    pending_tasks: [],
    milestones: [],
    remarks: [],
    pending_review_queue: [],
    stage_change: null,
    awaiting_closure: segment.awaitingClosure,
  };

  const rosterNames = new Set(
    context.roster.filter((r) => r.project_id === segment.projectId).map((r) => r.name)
  );

  for (const b of segment.blockers) {
    if (b.confidence < 0 || b.confidence > 1) continue; // malformed, drop silently
    if (b.status === "resolved" && !b.resolvedDate) {
      // Can't satisfy the paired-column constraint — never write, never
      // reshape the value to slip past it (prompt.md rule 15).
      writes.pending_review_queue.push({
        field_name: "blockers.status",
        proposed_value: `resolved without resolved_date: ${b.description}`,
        confidence: b.confidence,
      });
      continue;
    }

    const tier = confidenceTier(b.confidence);
    if (tier === "review") {
      writes.pending_review_queue.push({
        field_name: "blockers",
        proposed_value: b.description,
        confidence: b.confidence,
      });
      continue;
    }

    writes.blockers.push({
      action: b.action,
      matchedBlockerId: b.matchedBlockerId,
      description: b.description,
      side: b.side,
      status: b.status,
      raised_by: b.raisedBy,
      first_seen_date: b.firstSeenDate,
      last_mentioned_date: b.lastMentionedDate,
      resolved_date: b.resolvedDate,
      unverified: tier === "unverified",
      confidence: b.confidence,
    });
  }

  for (const t of segment.pendingTasks) {
    if (t.confidence < 0 || t.confidence > 1) continue;

    if (!rosterNames.has(t.assigneeName)) {
      // Ambiguous/unresolved assignee — a task with the wrong assignee is
      // worse than no task (prompt.md Section 6.3). Never insert with a
      // placeholder; the NOT NULL constraint wouldn't allow it anyway.
      writes.pending_review_queue.push({
        field_name: "pending_tasks.assignee_name",
        proposed_value: `${t.assigneeName}: ${t.description}`,
        confidence: t.confidence,
      });
      continue;
    }

    if (t.status === "done" && !t.completedDate) {
      writes.pending_review_queue.push({
        field_name: "pending_tasks.status",
        proposed_value: `done without completed_date: ${t.description}`,
        confidence: t.confidence,
      });
      continue;
    }

    const tier = confidenceTier(t.confidence);
    if (tier === "review") {
      writes.pending_review_queue.push({
        field_name: "pending_tasks",
        proposed_value: t.description,
        confidence: t.confidence,
      });
      continue;
    }

    writes.pending_tasks.push({
      action: t.action,
      matchedTaskId: t.matchedTaskId,
      assignee_name: t.assigneeName,
      description: t.description,
      status: t.status,
      first_mentioned_date: t.firstMentionedDate,
      last_mentioned_date: t.lastMentionedDate,
      completed_date: t.completedDate,
      due_date: t.dueDate,
      unverified: tier === "unverified",
      confidence: t.confidence,
    });
  }

  for (const m of segment.milestones) {
    if (m.confidence < REVIEW_THRESHOLD) continue; // no natural queue destination for a checkpoint name; drop
    writes.milestones.push({ name: m.name, status: m.status });
  }

  for (const r of segment.remarks) {
    if (r.confidence < 0 || r.confidence > 1) continue;

    const tier = confidenceTier(r.confidence);
    if (tier === "review") {
      writes.pending_review_queue.push({
        field_name: "remarks_log",
        proposed_value: r.summary,
        confidence: r.confidence,
      });
      continue;
    }

    writes.remarks.push({ summary: r.summary, unverified: tier === "unverified", confidence: r.confidence });
  }

  if (segment.stageChange) {
    const validStage = context.stages.some((s) => s.name === segment.stageChange!.newStage);
    if (validStage && segment.stageChange.confidence >= LIVE_THRESHOLD) {
      writes.stage_change = {
        new_stage: segment.stageChange.newStage,
        confidence: segment.stageChange.confidence,
      };
    } else {
      // Unmapped stage or insufficient evidence: record as a remark instead
      // of forcing an invalid/uncertain value (prompt.md Section 6.4 /
      // Example 4). The remark itself still goes through the tier check
      // above if the caller included one; this just prevents the stage
      // write.
      writes.pending_review_queue.push({
        field_name: "projects.stage",
        proposed_value: segment.stageChange.newStage,
        confidence: segment.stageChange.confidence,
      });
    }
  }

  return writes;
}

export type ApplyOutcome =
  | { status: "success" }
  | { status: "no_confident_match" };

export async function applyExtractionResult(
  result: ExtractionResult,
  context: SyncContext,
  meta: {
    transcriptId: string;
    meetingDate: string;
    meetingTitle: string;
    attendees: string[];
    rawSnippet: string;
  }
): Promise<ApplyOutcome> {
  const supabase = createServiceRoleClient();

  if (result.notAProjectMeeting || result.noConfidentMatch) {
    const { error } = await supabase.rpc("log_unmatched_meeting", {
      p_transcript_id: meta.transcriptId,
      p_meeting_date: meta.meetingDate,
      p_meeting_title: meta.meetingTitle,
      p_attendees: meta.attendees,
      p_raw_snippet: meta.rawSnippet,
    });
    if (error) throw new Error(`log_unmatched_meeting failed: ${error.message}`);
    return { status: "no_confident_match" };
  }

  const matchedSegments = result.segments.filter(
    (s): s is ExtractionSegment & { projectId: string } => s.projectId !== null
  );
  const unmatchedSegments = result.segments.filter((s) => s.projectId === null && s.unmatchedSnippet);

  for (let i = 0; i < matchedSegments.length; i++) {
    const segment = matchedSegments[i];
    const writes = buildSegmentWrites(segment, context);
    const isLastSegment = unmatchedSegments.length === 0 && i === matchedSegments.length - 1;

    const { error } = await supabase.rpc("apply_transcript_segment", {
      p_project_id: segment.projectId,
      p_writes: writes,
      p_transcript_id: meta.transcriptId,
      p_meeting_date: meta.meetingDate,
      p_meeting_title: meta.meetingTitle,
      p_is_last_segment: isLastSegment,
    });

    if (error) throw new Error(`apply_transcript_segment failed for project ${segment.projectId}: ${error.message}`);
  }

  if (unmatchedSegments.length > 0) {
    const residue = unmatchedSegments.map((s) => s.unmatchedSnippet).join("\n---\n").slice(0, 500);
    const { error } = await supabase.rpc("log_unmatched_meeting", {
      p_transcript_id: meta.transcriptId,
      p_meeting_date: meta.meetingDate,
      p_meeting_title: meta.meetingTitle,
      p_attendees: meta.attendees,
      p_raw_snippet: residue,
    });
    if (error) throw new Error(`log_unmatched_meeting (residue) failed: ${error.message}`);
  }

  if (matchedSegments.length === 0 && unmatchedSegments.length === 0) {
    // Extraction returned no segments at all without flagging either scope
    // gate — treat conservatively as unmatched so the transcript still gets
    // recorded and a human can inspect it, rather than silently dropping it.
    const { error } = await supabase.rpc("log_unmatched_meeting", {
      p_transcript_id: meta.transcriptId,
      p_meeting_date: meta.meetingDate,
      p_meeting_title: meta.meetingTitle,
      p_attendees: meta.attendees,
      p_raw_snippet: meta.rawSnippet,
    });
    if (error) throw new Error(`log_unmatched_meeting (empty result) failed: ${error.message}`);
    return { status: "no_confident_match" };
  }

  return { status: "success" };
}

export function buildRawSnippet(transcript: FirefliesMeetingDetails): string {
  return transcript.sentences
    .slice(0, 20)
    .map((s) => `${s.speaker_name ?? "Unknown"}: ${s.text}`)
    .join("\n")
    .slice(0, 500);
}

export function touchedProjectIds(result: ExtractionResult): string[] {
  return Array.from(
    new Set(result.segments.map((s) => s.projectId).filter((id): id is string => id !== null))
  );
}
