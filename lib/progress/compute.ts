// Pure functions for the Development Progress Index (DPI) — a 0-100 read of how
// far a project has actually come, blending three independent signals whose
// weights adapt to which signals a given project has data for:
//
//   S_stage — lifecycle stage progression (project_stages.completion_fraction,
//             rescaled into dev-window progress the same way recompute-delay.ts
//             does). Always present; acts as the backbone and a floor.
//   S_ms    — milestone checkpoints: (done + 0.5*in_progress) / total. Only
//             counts when the project has milestone rows.
//   S_task  — task-backlog resolution WITH implicit completion: a task that
//             hasn't been re-mentioned across the last STALE_MEETINGS meetings
//             (spanning >= STALE_DAYS) while the project kept meeting is treated
//             as "presumed complete". This recovers the signal the extraction
//             pipeline misses — it only ever sets pending_tasks.status='done' on
//             explicit "it's finished" evidence, so done/total sits near 0 for
//             any active project.
//
// Everything here is a deterministic function of its inputs (no DB, no clock) so
// it can be replayed "as of" any past date to build a time series. The as-of
// inputs are assembled in lib/progress/reconstruct.ts.
//
// Tuning constants live here as exported values so a change to the model shows
// up as a reviewable diff (same rationale as the RULESET constant in
// lib/sync/sync-extraction.ts).

import { daysBetween } from "@/lib/format";

/** A task not re-mentioned for this many days is a candidate for "presumed complete". */
export const STALE_DAYS = 14;
/** ...but only if the project also held at least this many meetings since the last mention. */
export const STALE_MEETINGS = 2;

/** Base signal weights when a project has data for all three. Renormalised
 * after the adaptive rules below zero out or shrink the ones without data. */
export const BASE_WEIGHTS = { stage: 0.35, milestone: 0.4, task: 0.25 } as const;

/** Each open, >5-day-old client-side blocker subtracts this fraction... */
export const BLOCKER_PENALTY_PER = 0.02;
/** ...up to this cap. Mirrors the stale-client-blocker override in recompute-delay.ts. */
export const BLOCKER_PENALTY_CAP = 0.1;

/** DPI can never read below this fraction of the proven stage progress. */
export const FLOOR_FACTOR = 0.5;

export type DpiSignalKey = "stage" | "milestone" | "task";

export type DpiWeights = { stage: number; milestone: number; task: number };

export type DpiBreakdown = {
  stageScore: number; // 0..1
  milestoneScore: number | null; // 0..1, null when the project has no milestones
  taskScore: number | null; // 0..1, null when no task is in scope yet
  blockerPenalty: number; // fraction, 0..BLOCKER_PENALTY_CAP
  weights: DpiWeights; // renormalised, sum to 1
  tasksInScope: number;
  tasksConfirmedDone: number;
  tasksPresumedDone: number;
  milestonesTotal: number;
  milestonesDone: number;
  dominantSignal: DpiSignalKey;
};

export type DpiResult = {
  dpi: number; // 0..100 — always computable (stage-anchored); see `lowSignal`
  lowSignal: boolean; // no milestones AND no tasks in scope — the UI shows a
  // "tracking from lifecycle stage only" caption instead of the number, but the
  // number is still stored so the trend line stays continuous
  breakdown: DpiBreakdown;
};

export type MilestoneState = { status: string };

export type TaskState = {
  status: string;
  first_mentioned_date: string;
  last_mentioned_date: string;
  completed_date: string | null;
};

export type BlockerState = {
  side: string;
  status: string;
  first_seen_date: string;
  resolved_date: string | null;
};

export type DevelopmentProgressInput = {
  /** YYYY-MM-DD the score is computed as of. */
  asOf: string;
  /** completion_fraction of the project's stage as of `asOf`. */
  stageFraction: number;
  /** completion_fraction of the "Development" stage — the dev/support boundary. */
  devBoundaryFraction: number;
  milestones: MilestoneState[];
  tasks: TaskState[];
  blockers: BlockerState[];
  /** Sorted YYYY-MM-DD meeting dates of every processed transcript for this project. */
  projectMeetingDates: string[];
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Stage completion_fraction rescaled to a 0-1 ratio of progress through the
 * development window — identical rule to computeForProject in recompute-delay.ts
 * so the progress bar and the delay badge never disagree on where a project is. */
export function rescaleStageFraction(stageFraction: number, devBoundaryFraction: number): number {
  if (stageFraction > devBoundaryFraction) return 1;
  if (devBoundaryFraction <= 0) return 1;
  return clamp01(stageFraction / devBoundaryFraction);
}

/** (done + 0.5*in_progress) / total, or null when the project has no milestones. */
export function computeMilestoneScore(
  milestones: MilestoneState[]
): { score: number | null; total: number; done: number } {
  if (milestones.length === 0) return { score: null, total: 0, done: 0 };
  let done = 0;
  let inProgress = 0;
  for (const m of milestones) {
    const s = m.status.toLowerCase();
    if (s === "done") done += 1;
    else if (s === "in_progress") inProgress += 1;
  }
  return { score: clamp01((done + 0.5 * inProgress) / milestones.length), total: milestones.length, done };
}

export type TaskResolution =
  | { resolved: false }
  | { resolved: true; kind: "confirmed" | "presumed" };

/** Whether a task counts as resolved as of `asOf`: explicitly done and closed by
 * then (confirmed), or gone quiet — not re-raised for STALE_DAYS while the
 * project held >= STALE_MEETINGS further meetings (presumed). */
export function resolveTaskAsOf(
  task: TaskState,
  asOf: string,
  projectMeetingDates: string[]
): TaskResolution {
  if (
    task.status.toLowerCase() === "done" &&
    task.completed_date !== null &&
    task.completed_date <= asOf
  ) {
    return { resolved: true, kind: "confirmed" };
  }

  if (daysBetween(task.last_mentioned_date, asOf) >= STALE_DAYS) {
    const meetingsSince = projectMeetingDates.filter(
      (d) => d > task.last_mentioned_date && d <= asOf
    ).length;
    if (meetingsSince >= STALE_MEETINGS) return { resolved: true, kind: "presumed" };
  }

  return { resolved: false };
}

export function computeTaskScore(
  tasks: TaskState[],
  asOf: string,
  projectMeetingDates: string[]
): { score: number | null; inScope: number; confirmed: number; presumed: number } {
  const inScopeTasks = tasks.filter((t) => t.first_mentioned_date <= asOf);
  if (inScopeTasks.length === 0) return { score: null, inScope: 0, confirmed: 0, presumed: 0 };

  let confirmed = 0;
  let presumed = 0;
  for (const t of inScopeTasks) {
    const r = resolveTaskAsOf(t, asOf, projectMeetingDates);
    if (!r.resolved) continue;
    if (r.kind === "confirmed") confirmed += 1;
    else presumed += 1;
  }

  return {
    score: clamp01((confirmed + presumed) / inScopeTasks.length),
    inScope: inScopeTasks.length,
    confirmed,
    presumed,
  };
}

/** A client-side blocker counts against the score at `asOf` if it had been
 * raised by then and was still open then — i.e. not resolved, or resolved only
 * afterwards — and had been open more than 5 days. */
export function computeBlockerPenalty(blockers: BlockerState[], asOf: string): number {
  const staleClientBlockers = blockers.filter((b) => {
    if (b.side.toLowerCase() !== "client") return false;
    if (b.first_seen_date > asOf) return false;
    const openAtAsOf =
      b.status.toLowerCase() !== "resolved" || b.resolved_date === null || b.resolved_date > asOf;
    if (!openAtAsOf) return false;
    return daysBetween(b.first_seen_date, asOf) > 5;
  }).length;
  return Math.min(BLOCKER_PENALTY_CAP, BLOCKER_PENALTY_PER * staleClientBlockers);
}

/** How many in-scope tasks it takes for the task signal to carry its full base
 * weight; below this it ramps in linearly, so a project that has just had its
 * first couple of tasks logged doesn't lurch. */
export const TASK_WEIGHT_FULL_AT = 5;

/** Base weights, with the milestone/task terms zeroed or shrunk when the project
 * lacks the data to support them, then renormalised to sum to 1. */
export function computeAdaptiveWeights(args: {
  milestoneCount: number;
  taskScoreIsNull: boolean;
  tasksInScope: number;
}): DpiWeights {
  const stage: number = BASE_WEIGHTS.stage;

  let milestone: number = BASE_WEIGHTS.milestone;
  if (args.milestoneCount === 0) milestone = 0;
  else if (args.milestoneCount < 2) milestone = 0.2;

  let task = 0;
  if (!args.taskScoreIsNull) {
    task = BASE_WEIGHTS.task * Math.min(1, args.tasksInScope / TASK_WEIGHT_FULL_AT);
  }

  const sum = stage + milestone + task;
  if (sum <= 0) return { stage: 1, milestone: 0, task: 0 };
  return { stage: stage / sum, milestone: milestone / sum, task: task / sum };
}

function dominantSignal(weights: DpiWeights): DpiSignalKey {
  const entries: [DpiSignalKey, number][] = [
    ["milestone", weights.milestone],
    ["stage", weights.stage],
    ["task", weights.task],
  ];
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export function computeDevelopmentProgress(input: DevelopmentProgressInput): DpiResult {
  const stageScore = rescaleStageFraction(input.stageFraction, input.devBoundaryFraction);
  const ms = computeMilestoneScore(input.milestones);
  const taskAgg = computeTaskScore(input.tasks, input.asOf, input.projectMeetingDates);
  const blockerPenalty = computeBlockerPenalty(input.blockers, input.asOf);

  const weights = computeAdaptiveWeights({
    milestoneCount: ms.total,
    taskScoreIsNull: taskAgg.score === null,
    tasksInScope: taskAgg.inScope,
  });

  const lowSignal = ms.total === 0 && taskAgg.inScope === 0;

  const raw =
    weights.stage * stageScore +
    weights.milestone * (ms.score ?? 0) +
    weights.task * (taskAgg.score ?? 0);

  const floor = Math.round(FLOOR_FACTOR * stageScore * 100);
  const dpiNum = Math.min(100, Math.max(floor, Math.round((raw - blockerPenalty) * 100)));

  return {
    dpi: dpiNum,
    lowSignal,
    breakdown: {
      stageScore,
      milestoneScore: ms.score,
      taskScore: taskAgg.score,
      blockerPenalty,
      weights,
      tasksInScope: taskAgg.inScope,
      tasksConfirmedDone: taskAgg.confirmed,
      tasksPresumedDone: taskAgg.presumed,
      milestonesTotal: ms.total,
      milestonesDone: ms.done,
      dominantSignal: dominantSignal(weights),
    },
  };
}

/** Planned-pace progress (0-100) at `asOf` — the straight elapsed-time ratio
 * through the dev window, the line the DPI curve is read against. Mirrors
 * computeTimelineProgress in lib/format.ts but evaluated at an arbitrary date. */
export function expectedPaceAt(devStartDate: string, devEndDate: string, asOf: string): number {
  const start = new Date(devStartDate).getTime();
  const end = new Date(devEndDate).getTime();
  const at = new Date(asOf).getTime();
  if (end <= start) return 0;
  return Math.round(clamp01((at - start) / (end - start)) * 100);
}

export type ProgressSeriesPoint = {
  as_of_date: string;
  source_meeting_id: string | null;
  dpi: number;
  expected: number;
  result: DpiResult;
};

/** Replay the DPI at each supplied as-of point. `points` is assembled by
 * lib/progress/reconstruct.ts (stage/milestones/tasks as they stood on each
 * date); this just runs the model and attaches the planned-pace overlay. */
export function computeProgressSeries(
  points: { asOf: string; sourceMeetingId: string | null; input: DevelopmentProgressInput }[],
  devWindow: { start: string; end: string }
): ProgressSeriesPoint[] {
  return points.map((p) => {
    const result = computeDevelopmentProgress(p.input);
    return {
      as_of_date: p.asOf,
      source_meeting_id: p.sourceMeetingId,
      dpi: result.dpi,
      expected: expectedPaceAt(devWindow.start, devWindow.end, p.asOf),
      result,
    };
  });
}
