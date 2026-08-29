import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TrendChart } from "@/components/ui/TrendChart";
import { computeTimelineProgress, formatDate } from "@/lib/format";
import { expectedPaceAt, type DpiResult } from "@/lib/progress/compute";
import type { Milestone, Project, ProgressSnapshot, TimelineWindow } from "@/lib/types";

const HEALTH_STYLES: Record<
  "good" | "warn" | "bad",
  { border: string; bg: string; text: string; glow: string }
> = {
  good: {
    border: "border-status-good/50",
    bg: "bg-gradient-to-br from-status-good/25 via-status-good/8 to-transparent",
    text: "text-status-good",
    glow: "shadow-[0_0_70px_-18px_rgba(52,217,164,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
  },
  warn: {
    border: "border-status-warn/50",
    bg: "bg-gradient-to-br from-status-warn/25 via-status-warn/8 to-transparent",
    text: "text-status-warn",
    glow: "shadow-[0_0_70px_-18px_rgba(245,180,80,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
  },
  bad: {
    border: "border-status-bad/50",
    bg: "bg-gradient-to-br from-status-bad/25 via-status-bad/8 to-transparent",
    text: "text-status-bad",
    glow: "shadow-[0_0_70px_-18px_rgba(255,107,107,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
  },
};

const STATUS_TONE: Record<string, "good" | "warn" | "bad"> = {
  "On Track": "good",
  "At Risk": "warn",
  Delayed: "bad",
};

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const MILESTONE_STATUS_TONE: Record<string, "good" | "warn" | "neutral"> = {
  not_started: "neutral",
  in_progress: "warn",
  done: "good",
};

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function ProgressOverview({
  project,
  milestones,
  progress,
  timelineWindow,
}: {
  project: Project;
  milestones: Milestone[];
  progress: { current: DpiResult; series: ProgressSnapshot[] };
  timelineWindow: TimelineWindow;
}) {
  const timelineProgress = computeTimelineProgress(
    timelineWindow.start,
    timelineWindow.end,
    project.actual_end_date
  );
  const isClosed = Boolean(project.actual_end_date);
  const health = HEALTH_STYLES[STATUS_TONE[project.status] ?? "good"];

  const { current } = progress;
  const dpi = current.dpi;
  // Tone the bar by how the score sits against the planned pace.
  const devProgressTone: "good" | "warn" | "bad" =
    dpi >= timelineProgress - 5 ? "good" : dpi >= timelineProgress - 15 ? "warn" : "bad";

  // Low-signal points would plot as a flat stage-only line — drop them so the
  // curve only shows dates the score is actually meaningful for.
  const chartPoints = progress.series
    .filter((s) => !s.low_signal)
    .map((s) => ({
      date: s.as_of_date,
      dpi: Number(s.dpi),
      expected: expectedPaceAt(project.dev_start_date, project.dev_end_date, s.as_of_date),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section id="progress" className="scroll-mt-24">
      <SectionHeading eyebrow="Progress" title="How this project is tracking" />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div
          className={`flex flex-col gap-3 self-start rounded-2xl border p-5 backdrop-blur-2xl ${health.border} ${health.bg} ${health.glow}`}
        >
          <div>
            <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">Health</p>
            <p className={`mt-1.5 flex items-center gap-2 text-2xl font-bold ${health.text}`}>
              <span
                className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_2px_currentColor]"
                style={{ backgroundColor: "currentColor" }}
                aria-hidden="true"
              />
              {project.status}
            </p>
          </div>
          <p className="text-xs text-text-secondary">
            {project.dev_delay_days > 0
              ? `${project.dev_delay_days} day${project.dev_delay_days === 1 ? "" : "s"} behind plan.`
              : "Computed daily by the automation pipeline, independent of meetings."}
          </p>
        </div>

        <div className="glass-panel space-y-6 rounded-2xl p-6">
          <div>
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Timeline progress</span>
              <span className="font-medium tabular-nums text-text-primary">
                {isClosed ? "Closed" : `${timelineProgress}%`}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={timelineProgress} tone="accent" label="Timeline progress" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-text-secondary">
              <span>{formatDate(timelineWindow.start)}</span>
              <span>{formatDate(timelineWindow.end)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>Development progress</span>
              {!current.lowSignal && (
                <span className="font-medium tabular-nums text-text-primary">{dpi}%</span>
              )}
            </div>

            {current.lowSignal ? (
              <p className="mt-2 text-sm text-text-secondary">
                Tracking from lifecycle stage only — not enough meeting activity yet.
              </p>
            ) : (
              <>
                <div className="mt-2">
                  <ProgressBar value={dpi} tone={devProgressTone} label="Development progress" />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                  <span>Stage {pct(current.breakdown.stageScore)}</span>
                  <span>Milestones {pct(current.breakdown.milestoneScore)}</span>
                  <span>Tasks {pct(current.breakdown.taskScore)}</span>
                  {current.breakdown.blockerPenalty > 0 && (
                    <span className="text-status-warn">
                      −{Math.round(current.breakdown.blockerPenalty * 100)} blockers
                    </span>
                  )}
                </div>
              </>
            )}

            {!current.lowSignal && chartPoints.length >= 2 && (
              <div className="mt-4">
                <TrendChart points={chartPoints} />
              </div>
            )}
          </div>
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="glass-card flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            >
              <span className="truncate text-sm text-text-primary">{m.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={MILESTONE_STATUS_TONE[m.status] ?? "neutral"}>
                  {MILESTONE_STATUS_LABEL[m.status] ?? m.status}
                </Badge>
                <span className="text-[11px] text-text-secondary">{formatDate(m.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
