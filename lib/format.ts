import type { BandwidthStatus } from "@/lib/types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

export function formatDateRange(start: string, end: string): string {
  return `${shortDateFormatter.format(new Date(start))} → ${dateFormatter.format(new Date(end))}`;
}

export function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffSeconds = Math.round(diffMs / 1000);

  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffSeconds < 60) return "Added just now";

  for (const [unit, secondsInUnit] of divisions) {
    if (diffSeconds >= secondsInUnit) {
      const amount = Math.floor(diffSeconds / secondsInUnit);
      return `Added ${rtf.format(-amount, unit)}`;
    }
  }

  return "Added just now";
}

/** Clamped 0-100 progress through the planned schedule. */
export function computeTimelineProgress(
  startDate: string,
  plannedEndDate: string,
  actualEndDate: string | null
): number {
  if (actualEndDate) return 100;

  const start = new Date(startDate).getTime();
  const end = new Date(plannedEndDate).getTime();
  const now = Date.now();

  if (end <= start) return 0;

  const ratio = (now - start) / (end - start);
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

export type TimelineWindow = { start: string; end: string };

/** Which calendar window "Timeline progress" should measure against: the
 * dev window while the project's current stage is at or below the
 * Development-stage boundary, the support window once it's past that —
 * mirroring the same phase split used for delay computation (recompute-delay.ts),
 * so the progress bar and the delay/status badge always agree on which
 * window is "current". Without this, a project that has moved into
 * Testing/UAT/Client Review would stay pinned at a clamped 100% against a
 * dev window that already closed, instead of reflecting the window it's
 * actually in now. */
export function resolveTimelineWindow(
  project: {
    dev_start_date: string;
    dev_end_date: string;
    support_start_date: string;
    support_end_date: string;
  },
  stageFraction: number,
  devBoundaryFraction: number
): TimelineWindow {
  const inDevPhase = stageFraction <= devBoundaryFraction;
  return inDevPhase
    ? { start: project.dev_start_date, end: project.dev_end_date }
    : { start: project.support_start_date, end: project.support_end_date };
}

/** Whole days between two dates, floored at 0 (never negative). */
export function daysBetween(start: string, end: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.max(0, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
}

// "Milestone progress" (done_tasks / total_tasks) was removed — it read ~0% for
// any active project because the extraction pipeline almost never flips a task
// to "done". It is replaced by the Development Progress Index in lib/progress/,
// which blends lifecycle stage, milestone checkpoints, and task resolution
// (with stale tasks counted as presumed-complete) and is tracked over time.

/** Bandwidth read against the allocation model: 1 lead project + 2 member
 * projects is "balanced". Exceeding either is "overloaded" (tight bandwidth);
 * falling short of either without exceeding the other is "light" (spare capacity). */
export function computeBandwidthStatus(
  leadCount: number,
  memberCount: number
): BandwidthStatus {
  if (leadCount > 1 || memberCount > 2) return "overloaded";
  if (leadCount === 1 && memberCount === 2) return "balanced";
  return "light";
}

/** YYYY-MM-DD for a Date, in local time. ISO-formatted date strings sort and
 * compare correctly as plain strings, which sidesteps timezone parsing
 * pitfalls when comparing against the `date`-typed columns from Supabase
 * (already plain "YYYY-MM-DD" strings with no time component). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The Monday of the Monday-start week containing `now`. On a Sat/Sun, this
 * is the Monday that started the week just ending, not the upcoming one. */
export function currentWeekMonday(now: Date = new Date()): Date {
  const day = now.getDay(); // 0 = Sun ... 6 = Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
}

/** The Friday of the Monday-start week containing `now`. On a Sat/Sun, this
 * is the Friday that just passed (the week's cutoff already happened); on a
 * weekday, it's the Friday still ahead in the same week. */
export function currentWeekFriday(now: Date = new Date()): Date {
  const monday = currentWeekMonday(now);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
}

export type SaturdayOffTask = {
  status: string;
  first_mentioned_date: string;
  completed_date: string | null;
};

/** Whether a task counts as still open at the close of `fridayKey`: it has
 * to have existed by then (a task first surfaced after this week's Friday
 * belongs to next week, not this one) and not have been marked done by then. */
function wasOpenAsOfFriday(task: SaturdayOffTask, fridayKey: string): boolean {
  if (task.first_mentioned_date > fridayKey) return false;
  if (task.status.toLowerCase() !== "done") return true;
  // Done, but only actually cleared *by* Friday if completed on or before it.
  return Boolean(task.completed_date) && task.completed_date! > fridayKey;
}

/** Subset of `tasks` that were still open at the close of this week's Friday
 * (or the Friday just passed, on a Sat/Sun) — the set that blocks Saturday off. */
export function filterOpenAsOfFriday<T extends SaturdayOffTask>(
  tasks: T[],
  now: Date = new Date()
): T[] {
  const fridayKey = toDateKey(currentWeekFriday(now));
  return tasks.filter((t) => wasOpenAsOfFriday(t, fridayKey));
}

type CompletedThisWeekTask = { status: string; completed_date: string | null };

/** Subset of `tasks` actually marked done within the current Monday-start
 * week (Monday through Friday) — the work that explains *why* someone is
 * clear, as opposed to tasks closed out in an earlier week. */
export function filterCompletedThisWeek<T extends CompletedThisWeekTask>(
  tasks: T[],
  now: Date = new Date()
): T[] {
  const mondayKey = toDateKey(currentWeekMonday(now));
  const fridayKey = toDateKey(currentWeekFriday(now));
  return tasks.filter(
    (t) =>
      t.status.toLowerCase() === "done" &&
      Boolean(t.completed_date) &&
      t.completed_date! >= mondayKey &&
      t.completed_date! <= fridayKey
  );
}

/** Saturday-off eligibility for one person's pending tasks: eligible only
 * when nothing they own is left open as of this week's Friday close. Works
 * both as a live, updating projection during the week and as the settled
 * answer once Friday has actually passed. */
export function computeSaturdayOff(
  tasks: SaturdayOffTask[],
  now: Date = new Date()
): { eligible: boolean; openCount: number; friday: Date; saturday: Date } {
  const friday = currentWeekFriday(now);
  const saturday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 1);
  const openCount = filterOpenAsOfFriday(tasks, now).length;
  return { eligible: openCount === 0, openCount, friday, saturday };
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
