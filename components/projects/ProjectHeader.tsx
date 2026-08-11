import Link from "next/link";
import { StatusBadge, PriorityBadge, StageBadge, UnverifiedFlag } from "@/components/ui/Badge";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { EditProjectButton } from "@/components/projects/EditProjectButton";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import type { Project, ProjectAssignee } from "@/lib/types";

export function ProjectHeader({
  project,
  assignees,
}: {
  project: Project;
  assignees: ProjectAssignee[];
}) {
  return (
    <header
      id="overview"
      className="glass-header relative scroll-mt-24 overflow-hidden rounded-3xl p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent-primary/20 blur-3xl"
      />

      <div className="relative">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-accent-primary"
        >
          <span aria-hidden="true">←</span> All projects
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-balance text-text-primary sm:text-4xl">
                {project.project_name}
              </h1>
              {project.unverified && <UnverifiedFlag />}
            </div>
            <p className="mt-1.5 text-base text-text-secondary">{project.client_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={project.actual_end_date ? "Completed" : project.status} />
            <EditProjectButton project={project} assignees={assignees} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StageBadge stage={project.stage} />
          <PriorityBadge priority={project.priority} />
          {project.dev_delay_days > 0 && (
            <span className="inline-flex items-center rounded-full border border-status-bad/60 bg-status-bad/20 px-2.5 py-1 text-xs font-semibold text-status-bad shadow-[0_0_16px_-6px_var(--color-status-bad)]">
              {project.dev_delay_days}d behind on development
            </span>
          )}
          {project.support_delay_days > 0 && (
            <span className="inline-flex items-center rounded-full border border-status-bad/60 bg-status-bad/20 px-2.5 py-1 text-xs font-semibold text-status-bad shadow-[0_0_16px_-6px_var(--color-status-bad)]">
              {project.support_delay_days}d behind on testing/support
            </span>
          )}
        </div>

        {project.scope && (
          <div className="mt-6 max-w-3xl">
            <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">Scope</p>
            <div className="mt-1.5">
              <TruncatedText text={project.scope} />
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Deal size" value={formatCurrency(project.project_value)} />
          <Stat
            label="Development timeline"
            value={formatDateRange(project.dev_start_date, project.dev_end_date)}
          />
          <Stat
            label="Testing/Support timeline"
            value={formatDateRange(project.support_start_date, project.support_end_date)}
          />
          <Stat label="Added on" value={formatDate(project.created_at)} />
          <Stat label="Last updated" value={formatDate(project.updated_at)} />
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">{label}</p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums text-text-primary">{value}</p>
    </div>
  );
}
