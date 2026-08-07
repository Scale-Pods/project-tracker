import Link from "next/link";
import { StatusBadge, PriorityBadge, StageBadge, UnverifiedFlag } from "@/components/ui/Badge";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import type { Project } from "@/lib/types";

export function ProjectHeader({ project }: { project: Project }) {
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
          <div className="shrink-0">
            <StatusBadge status={project.actual_end_date ? "Completed" : project.status} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <StageBadge stage={project.stage} />
          <PriorityBadge priority={project.priority} />
          {project.delay_days > 0 && (
            <span className="inline-flex items-center rounded-full border border-status-bad/60 bg-status-bad/20 px-2.5 py-1 text-xs font-semibold text-status-bad shadow-[0_0_16px_-6px_var(--color-status-bad)]">
              {project.delay_days}d behind schedule
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

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
          <Stat label="Deal size" value={formatCurrency(project.project_value)} />
          <Stat
            className="col-span-2 sm:col-span-1"
            label="Timeline"
            value={formatDateRange(project.start_date, project.planned_end_date)}
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
