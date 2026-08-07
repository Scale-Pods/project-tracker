import { getProjectSummary } from "@/lib/ai/project-summary";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Blocker, Milestone, PendingTask, Project, RemarksLogEntry } from "@/lib/types";

export async function ProjectSummarySection({
  project,
  blockers,
  pendingTasks,
  milestones,
  remarks,
}: {
  project: Project;
  blockers: Blocker[];
  pendingTasks: PendingTask[];
  milestones: Milestone[];
  remarks: RemarksLogEntry[];
}) {
  const result = await getProjectSummary({ project, blockers, pendingTasks, milestones, remarks });

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
