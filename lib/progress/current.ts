import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { toDateKey } from "@/lib/format";
import {
  computeDevelopmentProgress,
  type BlockerState,
  type DpiResult,
  type TaskState,
} from "@/lib/progress/compute";

// "Current" DPI for the detail page — computed live from the rows getProjectDetail
// already fetched, so the headline never lags the last persisted snapshot. Only
// the project's meeting-date list has to be fetched here (needed for the
// stale-task heuristic); everything else is passed in.

/** Sorted YYYY-MM-DD dates of every processed Fireflies meeting that touched
 * this project. Used both by the DPI stale-task heuristic and by the detail
 * page's quiet-settle filter (lib/staleness.ts) — fetch once, pass to both. */
export async function fetchProjectMeetingDates(projectId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();

  const { data: auditRows, error: auditErr } = await supabase
    .from("audit_log")
    .select("source_meeting_id")
    .eq("project_id", projectId)
    .not("source_meeting_id", "is", null);
  if (auditErr) throw new Error(auditErr.message);

  const ids = Array.from(
    new Set((auditRows ?? []).map((r) => r.source_meeting_id).filter((id): id is string => !!id))
  );
  if (ids.length === 0) return [];

  const { data: transcripts, error: tErr } = await supabase
    .from("processed_transcripts")
    .select("meeting_date")
    .in("fireflies_transcript_id", ids)
    .not("meeting_date", "is", null);
  if (tErr) throw new Error(tErr.message);

  return Array.from(
    new Set(
      (transcripts ?? [])
        .map((t) => t.meeting_date)
        .filter((d): d is string => !!d)
    )
  ).sort();
}

export async function computeCurrentProgress(args: {
  projectId: string;
  stage: string;
  fractionByStage: Map<string, number>;
  devBoundaryFraction: number;
  milestones: { status: string }[];
  tasks: TaskState[];
  blockers: BlockerState[];
  /** Pass the project's meeting dates if already fetched, to skip a query. */
  meetingDates?: string[];
}): Promise<DpiResult> {
  const meetingDates = args.meetingDates ?? (await fetchProjectMeetingDates(args.projectId));

  return computeDevelopmentProgress({
    asOf: toDateKey(new Date()),
    stageFraction: args.fractionByStage.get(args.stage) ?? args.devBoundaryFraction,
    devBoundaryFraction: args.devBoundaryFraction,
    milestones: args.milestones,
    tasks: args.tasks,
    blockers: args.blockers,
    projectMeetingDates: meetingDates,
  });
}
