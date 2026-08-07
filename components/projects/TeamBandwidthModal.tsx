"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BandwidthBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TeamMemberWorkload, WorkloadProjectRef } from "@/lib/types";

function ProjectChip({ project }: { project: WorkloadProjectRef }) {
  return (
    <span
      title={project.client_name}
      className="inline-flex items-center rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-1 text-xs text-text-primary"
    >
      {project.project_name}
    </span>
  );
}

function AllocationRow({
  label,
  projects,
  emptyLabel,
}: {
  label: string;
  projects: WorkloadProjectRef[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.06em] text-text-secondary uppercase">
        {label} <span className="text-text-primary">({projects.length})</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {projects.length === 0 ? (
          <span className="text-xs text-text-secondary/60">{emptyLabel}</span>
        ) : (
          projects.map((p) => <ProjectChip key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}

export function TeamBandwidthModal({
  open,
  onOpenChange,
  workload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workload: TeamMemberWorkload[];
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onOpenChange(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-bandwidth-title"
        className="glass-dropdown relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.85)] sm:max-h-[85vh] sm:max-w-2xl sm:rounded-[24px]"
      >
        <div className="flex items-start justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="team-bandwidth-title" className="text-xl font-medium text-text-primary">
              Team Bandwidth
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Target allocation is 1 lead project + 2 member projects per person, counted across
              active (non-completed) projects only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-card hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {workload.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Assignees will show up here once they're added to a project."
            />
          ) : (
            <div className="space-y-4">
              {workload.map((member, i) => (
                <div key={member.name} className="glass-card rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} index={i} size="md" />
                      <p className="text-sm font-medium text-text-primary">{member.name}</p>
                    </div>
                    <BandwidthBadge status={member.bandwidth} />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <AllocationRow
                      label="Lead on"
                      projects={member.leadProjects}
                      emptyLabel="Not leading any project"
                    />
                    <AllocationRow
                      label="Member on"
                      projects={member.memberProjects}
                      emptyLabel="Not a member on any project"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border-subtle px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
