import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { milestoneKey, toDateKey } from "@/lib/format";
import type { DevelopmentProgressInput } from "@/lib/progress/compute";

// Assembles the "as of date D" inputs the DPI model needs for a single project,
// so the score can be replayed at any past meeting date to build a time series.
//
// Two of the three signals need history, not just the current row:
//   - stage: reconstructed from audit_log field_changed='stage' (structured
//     old_value/new_value), each change dated by its meeting rather than by
//     changed_at (which is processing time).
//   - milestones: reconstructed from audit_log field_changed='milestones', whose
//     new_value is prose like "<name>: <status>[, notes]" — parsed best-effort,
//     then merged with the live milestones snapshot as the most-current truth.
// tasks and blockers already carry their own dated columns, so the pure model
// filters them by date itself; they're passed through unchanged.

type MilestoneEvent = { date: string; status: string; live?: boolean };

export type ProjectProgressContext = {
  project: {
    id: string;
    stage: string;
    created_at: string;
    dev_start_date: string;
    dev_end_date: string;
  };
  devBoundaryFraction: number;
  fractionByStage: Map<string, number>;
  tasks: DevelopmentProgressInput["tasks"];
  blockers: DevelopmentProgressInput["blockers"];
  /** Unique processed-meeting dates that touched this project, ascending. */
  meetingDates: string[];
  /** transcript id for each meeting date (last one wins on a shared date). */
  meetingIdByDate: Map<string, string>;
  /** The stage in effect before the first recorded stage change. */
  initialStage: string;
  /** Recorded stage changes only, ascending by effective date. */
  stageTimeline: { date: string; stage: string }[];
  /** One series per LIVE milestone (keyed by its canonical key): status events,
   * ascending. Audit narrations are matched onto these, never used to invent a
   * milestone the project doesn't actually have. */
  milestoneTimeline: Map<string, MilestoneEvent[]>;
};

const MS_STATUS_RE = /(not_started|in_progress|done)/g;

/** Pull "<name>" and "<status>" out of an audit_log milestones `new_value`. */
export function parseMilestoneAuditValue(
  value: string
): { name: string; status: string } | null {
  MS_STATUS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((match = MS_STATUS_RE.exec(value)) !== null) last = match;
  if (!last) return null;

  const colonIdx = value.lastIndexOf(":", last.index);
  const rawName = (colonIdx >= 0 ? value.slice(0, colonIdx) : value.slice(0, last.index)).trim();
  if (!rawName) return null;
  return { name: rawName, status: last[1] };
}

export async function loadProjectProgressContext(
  projectId: string
): Promise<ProjectProgressContext | null> {
  const supabase = createServiceRoleClient();

  const [projectRes, stagesRes, milestonesRes, tasksRes, blockersRes, auditRes, transcriptsRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, stage, created_at, dev_start_date, dev_end_date")
        .eq("id", projectId)
        .maybeSingle(),
      supabase.from("project_stages").select("name, completion_fraction"),
      supabase.from("milestones").select("name, status, updated_at").eq("project_id", projectId),
      supabase
        .from("pending_tasks")
        .select("status, first_mentioned_date, last_mentioned_date, completed_date")
        .eq("project_id", projectId),
      supabase
        .from("blockers")
        .select("side, status, first_seen_date, resolved_date")
        .eq("project_id", projectId),
      supabase
        .from("audit_log")
        .select("field_changed, old_value, new_value, source_meeting_id, changed_at")
        .eq("project_id", projectId)
        .order("changed_at", { ascending: true }),
      supabase
        .from("processed_transcripts")
        .select("fireflies_transcript_id, meeting_date")
        .not("meeting_date", "is", null),
    ]);

  for (const res of [
    projectRes,
    stagesRes,
    milestonesRes,
    tasksRes,
    blockersRes,
    auditRes,
    transcriptsRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }
  if (!projectRes.data) return null;

  const project = projectRes.data;
  const fractionByStage = new Map(
    (stagesRes.data ?? []).map((s) => [s.name, Number(s.completion_fraction)])
  );
  const devBoundaryFraction = fractionByStage.get("Development") ?? 1;

  const meetingDateByTranscript = new Map(
    (transcriptsRes.data ?? [])
      .filter((t): t is { fireflies_transcript_id: string; meeting_date: string } => !!t.meeting_date)
      .map((t) => [t.fireflies_transcript_id, t.meeting_date] as const)
  );

  const audit = auditRes.data ?? [];
  const devStart = project.dev_start_date;

  // Effective date of an audit row: the meeting it came from, else processing
  // date — but never before the dev window opened. Meeting dates can predate a
  // project's onboarding (a pre-sales / internal call), and a stage or milestone
  // can't meaningfully be "in effect" before development started.
  const effectiveDate = (row: {
    source_meeting_id: string | null;
    changed_at: string;
  }): string => {
    const raw =
      (row.source_meeting_id && meetingDateByTranscript.get(row.source_meeting_id)) ||
      toDateKey(new Date(row.changed_at));
    return raw < devStart ? devStart : raw;
  };

  // Meetings that touched this project.
  const meetingIdByDate = new Map<string, string>();
  for (const row of audit) {
    if (!row.source_meeting_id) continue;
    const d = meetingDateByTranscript.get(row.source_meeting_id);
    if (d) meetingIdByDate.set(d, row.source_meeting_id);
  }
  const meetingDates = Array.from(meetingIdByDate.keys()).sort();

  // Stage timeline — recorded changes only, ordered by effective date then by
  // processing order for same-day ties. No synthetic "created" entry: a change
  // can be back-dated, so anchoring the initial stage to a fixed date and
  // re-sorting risks putting it after a real change.
  const stageChanges = audit
    .filter((r) => r.field_changed === "stage" && r.new_value)
    .map((r) => ({
      date: effectiveDate(r),
      stage: r.new_value as string,
      oldStage: r.old_value,
      changedAt: r.changed_at,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.changedAt.localeCompare(b.changedAt));

  const initialStage = stageChanges[0]?.oldStage ?? project.stage;
  const stageTimeline = stageChanges.map((c) => ({ date: c.date, stage: c.stage }));

  // Milestone timeline: one series per LIVE milestone. Audit narrations are
  // matched onto them by milestoneKey (so "Phase 2: done" and "Phase 2 — AI
  // personalisation" are one milestone, not two); an audit line that matches no
  // live milestone is dropped rather than inflating the denominator.
  const milestoneTimeline = new Map<string, MilestoneEvent[]>();
  const liveByKey = new Map<string, { status: string; updated_at: string }>();
  for (const m of milestonesRes.data ?? []) {
    liveByKey.set(milestoneKey(m.name), { status: m.status, updated_at: m.updated_at });
    milestoneTimeline.set(milestoneKey(m.name), []);
  }

  for (const r of audit) {
    if (r.field_changed !== "milestones" || !r.new_value) continue;
    const parsed = parseMilestoneAuditValue(r.new_value);
    if (!parsed) continue;
    const key = milestoneKey(parsed.name);
    const events = milestoneTimeline.get(key);
    if (!events) continue; // no live milestone this maps to -> ignore
    events.push({ date: effectiveDate(r), status: parsed.status });
  }

  // Anchor every series to its live row's current status, dated to when that
  // status last moved (updated_at). The live row is the authoritative present
  // state — a later audit narration can be a stale/misparsed phrasing, and a
  // manual DB correction leaves no audit trail at all — so it must win for
  // "as of now" while the audit events still drive earlier points.
  for (const [key, live] of liveByKey) {
    const events = milestoneTimeline.get(key)!;
    const seed = toDateKey(new Date(live.updated_at));
    events.push({ date: seed < devStart ? devStart : seed, status: live.status, live: true });
  }

  // Ascending by date; on a tied date the live-row seed sorts last (it's the
  // authoritative present state), then a "done" audit event beats an earlier
  // in-progress one. milestonesAsOf takes the last event on/before the date.
  for (const events of milestoneTimeline.values()) {
    events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(a.live ?? false) - Number(b.live ?? false) ||
        Number(a.status === "done") - Number(b.status === "done")
    );
  }

  return {
    project,
    devBoundaryFraction,
    fractionByStage,
    tasks: tasksRes.data ?? [],
    blockers: blockersRes.data ?? [],
    meetingDates,
    meetingIdByDate,
    initialStage,
    stageTimeline,
    milestoneTimeline,
  };
}

function stageAsOf(ctx: ProjectProgressContext, asOf: string): string {
  let stage = ctx.initialStage;
  for (const entry of ctx.stageTimeline) {
    if (entry.date <= asOf) stage = entry.stage;
    else break;
  }
  return stage;
}

function milestonesAsOf(
  ctx: ProjectProgressContext,
  asOf: string
): DevelopmentProgressInput["milestones"] {
  const out: { status: string }[] = [];
  for (const events of ctx.milestoneTimeline.values()) {
    let status: string | null = null;
    for (const e of events) {
      if (e.date <= asOf) status = e.status;
      else break;
    }
    if (status !== null) out.push({ status }); // milestone not yet mentioned by asOf -> excluded
  }
  return out;
}

/** The DPI model input for this project as it stood on `asOf` (YYYY-MM-DD). */
export function buildInputAsOf(
  ctx: ProjectProgressContext,
  asOf: string
): DevelopmentProgressInput {
  const stageName = stageAsOf(ctx, asOf);
  return {
    asOf,
    stageFraction: ctx.fractionByStage.get(stageName) ?? ctx.devBoundaryFraction,
    devBoundaryFraction: ctx.devBoundaryFraction,
    milestones: milestonesAsOf(ctx, asOf),
    tasks: ctx.tasks,
    blockers: ctx.blockers,
    projectMeetingDates: ctx.meetingDates,
  };
}

/** The as-of dates the trend chart / backfill should score at: every meeting
 * that touched the project within its dev window, plus today. */
export function seriesDatesFor(
  ctx: ProjectProgressContext,
  todayKey: string
): { asOf: string; sourceMeetingId: string | null }[] {
  const points = ctx.meetingDates
    .filter((d) => d >= ctx.project.dev_start_date && d <= todayKey)
    .map((d) => ({ asOf: d, sourceMeetingId: ctx.meetingIdByDate.get(d) ?? null }));

  if (!points.some((p) => p.asOf === todayKey)) {
    points.push({ asOf: todayKey, sourceMeetingId: null });
  }
  return points;
}
