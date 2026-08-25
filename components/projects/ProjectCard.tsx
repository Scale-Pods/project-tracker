import Link from "next/link";
import { StatusBadge, PriorityBadge, StageBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatCurrency,
  formatDateRange,
  formatRelativeTime,
  computeTimelineProgress,
} from "@/lib/format";
import type { ProjectWithAssignees } from "@/lib/types";

export function ProjectCard({
  project,
  style,
}: {
  project: ProjectWithAssignees;
  style?: React.CSSProperties;
}) {
  const progress = computeTimelineProgress(
    project.timelineWindow.start,
    project.timelineWindow.end,
    project.actual_end_date
  );
  const visibleAssignees = project.assignees.slice(0, 3);
  const overflowCount = project.assignees.length - visibleAssignees.length;
  const isClosed = Boolean(project.actual_end_date);

  return (
    <Link
      href={`/projects/${project.id}`}
      style={style}
      className="animate-card-in glass-card glass-card-interactive group relative flex flex-col overflow-hidden rounded-2xl hover:-translate-y-1 focus-visible:-translate-y-1"
    >
      {project.awaiting_closure_data && (
        <div className="border-b border-status-warn/20 bg-status-warn/10 px-5 py-1.5 text-xs font-medium text-status-warn">
          Closure details pending
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium text-text-primary">
              {project.project_name}
            </h3>
            <p className="mt-0.5 truncate text-sm text-text-secondary">
              {project.client_name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {project.unverified && (
              <span
                title="Contains at least one AI update below confidence threshold."
                aria-label="Contains an unverified AI update"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-text-secondary/50 text-[10px] text-text-secondary"
              >
                ?
              </span>
            )}
            <StatusBadge status={isClosed ? "Completed" : project.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StageBadge stage={project.stage} />
          <PriorityBadge priority={project.priority} />
          {project.dev_delay_days > 0 && (
            <span className="inline-flex items-center rounded-full border border-status-bad/60 bg-status-bad/20 px-2.5 py-1 text-xs font-semibold text-status-bad shadow-[0_0_16px_-6px_var(--color-status-bad)]">
              {project.dev_delay_days}d behind
            </span>
          )}
        </div>

        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{formatDateRange(project.timelineWindow.start, project.timelineWindow.end)}</span>
            <span className="font-medium tabular-nums text-text-primary">
              {isClosed ? "Closed" : `${progress}%`}
            </span>
          </div>
          <ProgressBar value={progress} tone="accent" label="Timeline progress" />
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">
              Deal size
            </p>
            <p className="text-sm font-medium tabular-nums text-text-primary">
              {formatCurrency(project.project_value)}
            </p>
          </div>

          {visibleAssignees.length > 0 && (
            <div className="flex shrink-0 items-center -space-x-2">
              {visibleAssignees.map((assignee, i) => (
                <Avatar key={assignee.id} name={assignee.name} index={i} />
              ))}
              {overflowCount > 0 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-card bg-surface-elevated text-[10px] font-medium text-text-secondary">
                  +{overflowCount}
                </span>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-right text-[11px] text-text-secondary">
          {formatRelativeTime(project.created_at)}
        </p>
      </div>
    </Link>
  );
}
