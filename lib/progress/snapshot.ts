import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { toDateKey } from "@/lib/format";
import { computeDevelopmentProgress, type DpiResult } from "@/lib/progress/compute";
import {
  buildInputAsOf,
  loadProjectProgressContext,
  seriesDatesFor,
  type ProjectProgressContext,
} from "@/lib/progress/reconstruct";
import type { Database } from "@/lib/types";

type SnapshotInsert = Database["public"]["Tables"]["progress_snapshots"]["Insert"];

function snapshotRow(
  projectId: string,
  asOf: string,
  sourceMeetingId: string | null,
  result: DpiResult
): SnapshotInsert {
  const b = result.breakdown;
  return {
    project_id: projectId,
    as_of_date: asOf,
    source_meeting_id: sourceMeetingId,
    dpi: result.dpi,
    stage_score: b.stageScore,
    milestone_score: b.milestoneScore,
    task_score: b.taskScore,
    blocker_penalty: b.blockerPenalty,
    weights: b.weights,
    tasks_in_scope: b.tasksInScope,
    tasks_confirmed_done: b.tasksConfirmedDone,
    tasks_presumed_done: b.tasksPresumedDone,
    milestones_total: b.milestonesTotal,
    milestones_done: b.milestonesDone,
    low_signal: result.lowSignal,
  };
}

async function upsertSnapshots(rows: SnapshotInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("progress_snapshots")
    .upsert(rows, { onConflict: "project_id,as_of_date" });
  if (error) throw new Error(`progress_snapshots upsert failed: ${error.message}`);
}

function computeSeriesRows(
  ctx: ProjectProgressContext,
  points: { asOf: string; sourceMeetingId: string | null }[]
): SnapshotInsert[] {
  return points.map((p) =>
    snapshotRow(
      ctx.project.id,
      p.asOf,
      p.sourceMeetingId,
      computeDevelopmentProgress(buildInputAsOf(ctx, p.asOf))
    )
  );
}

/** Upsert one snapshot for a project at a single date — called right after a
 * transcript is applied (asOfDate = the meeting date, sourceMeetingId set) and
 * by the daily cron sweep (asOfDate = today, sourceMeetingId null). Idempotent
 * per (project_id, as_of_date). Never throws into the caller's happy path —
 * a snapshot failure must not fail transcript processing. */
export async function writeSnapshotForProject(
  projectId: string,
  asOfDate: string,
  sourceMeetingId: string | null = null
): Promise<void> {
  try {
    const ctx = await loadProjectProgressContext(projectId);
    if (!ctx) return;
    const result = computeDevelopmentProgress(buildInputAsOf(ctx, asOfDate));
    await upsertSnapshots([snapshotRow(projectId, asOfDate, sourceMeetingId, result)]);
  } catch (err) {
    console.error(
      `writeSnapshotForProject(${projectId}, ${asOfDate}) failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Daily "today" snapshot for every active project, so calendar drift still
 * produces a point when no meeting happened. */
export async function writeSnapshotsPortfolioWide(
  asOfDate: string = toDateKey(new Date())
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("projects").select("id").is("actual_end_date", null);
  if (error) throw new Error(error.message);

  for (const p of data ?? []) {
    await writeSnapshotForProject(p.id, asOfDate, null);
  }
}

/** One-time (or re-runnable) backfill of a project's whole DPI curve from
 * audit_log + task history. Safe to run repeatedly — every row upserts. */
export async function backfillProjectSeries(projectId: string): Promise<number> {
  const ctx = await loadProjectProgressContext(projectId);
  if (!ctx) return 0;
  const points = seriesDatesFor(ctx, toDateKey(new Date()));
  const rows = computeSeriesRows(ctx, points);
  await upsertSnapshots(rows);
  return rows.length;
}

export async function backfillAllSeries(): Promise<{ project_id: string; points: number }[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("projects").select("id");
  if (error) throw new Error(error.message);

  const out: { project_id: string; points: number }[] = [];
  for (const p of data ?? []) {
    out.push({ project_id: p.id, points: await backfillProjectSeries(p.id) });
  }
  return out;
}
