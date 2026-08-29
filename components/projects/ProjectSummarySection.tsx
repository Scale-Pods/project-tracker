import { getProjectSummary } from "@/lib/ai/project-summary";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { DpiResult } from "@/lib/progress/compute";
import type {
  Blocker,
  Milestone,
  PendingTask,
  ProgressSnapshot,
  Project,
  RemarksLogEntry,
} from "@/lib/types";

/** "up 12 pts over last 3 meetings" / "flat" / "down 4 pts …" — from the tail
 * of the persisted DPI series. */
function describeTrend(series: ProgressSnapshot[]): string {
  const tail = series.slice(-3).map((s) => Number(s.dpi));
  if (tail.length < 2) return "no prior points";
  const delta = Math.round(tail[tail.length - 1] - tail[0]);
  const span = `over last ${tail.length} meeting${tail.length === 1 ? "" : "s"}`;
  if (delta === 0) return `flat ${span}`;
  return `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} pts ${span}`;
}

export async function ProjectSummarySection({
  project,
  blockers,
  pendingTasks,
  milestones,
  remarks,
  progress,
}: {
  project: Project;
  blockers: Blocker[];
  pendingTasks: PendingTask[];
  milestones: Milestone[];
  remarks: RemarksLogEntry[];
  progress: { current: DpiResult; series: ProgressSnapshot[] };
}) {
  const result = await getProjectSummary({
    project,
    blockers,
    pendingTasks,
    milestones,
    remarks,
    developmentProgress: {
      dpi: progress.current.dpi,
      lowSignal: progress.current.lowSignal,
      trend: describeTrend(progress.series),
    },
  });

  return (
    <section id="summary" className="scroll-mt-24">
      <SectionHeading eyebrow="At a glance" title="Summary" />
      <div className="glass-panel rounded-2xl p-6">
        {result.ok ? (
          <p className="text-sm leading-relaxed text-text-primary">{result.summary}</p>
        ) : (
          <p className="text-sm text-text-secondary">Summary unavailable right now.</p>
        )}
      </div>
    </section>
  );
}
