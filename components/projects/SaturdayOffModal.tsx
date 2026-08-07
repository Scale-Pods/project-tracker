"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SaturdayOffBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MemberSaturdayOff } from "@/lib/types";

const MAX_SHOWN_TASKS = 3;

/** The "why": what this person actually cleared this week, across every
 * project — short (a one-line total + a capped list), not a full task dump. */
function CompletedSummary({ tasks }: { tasks: MemberSaturdayOff["completedThisWeek"] }) {
  if (tasks.length === 0) {
    return <p className="mt-1 text-xs text-text-secondary">No tasks were due this week.</p>;
  }

  const projectNames = Array.from(new Set(tasks.map((t) => t.projectName)));
  const shown = tasks.slice(0, MAX_SHOWN_TASKS);
  const overflow = tasks.length - shown.length;

  return (
    <div className="mt-1 max-w-md">
      <p className="text-xs text-text-secondary">
        Cleared {tasks.length} task{tasks.length === 1 ? "" : "s"} this week across{" "}
        {projectNames.join(", ")}:
      </p>
      <ul className="mt-1 space-y-0.5">
        {shown.map((t) => (
          <li key={t.id} title={t.description} className="truncate text-[11px] text-text-secondary/70">
            · {t.description}
          </li>
        ))}
        {overflow > 0 && <li className="text-[11px] text-text-secondary/50">+{overflow} more</li>}
      </ul>
    </div>
  );
}

export function SaturdayOffModal({
  open,
  onOpenChange,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSaturdayOff[];
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
        aria-labelledby="saturday-off-title"
        className="glass-dropdown relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.85)] sm:max-h-[85vh] sm:max-w-2xl sm:rounded-[24px]"
      >
        <div className="flex items-start justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="saturday-off-title" className="text-xl font-medium text-text-primary">
              Saturday Eligibility
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Eligible once every pending task someone owns — across all their projects — is
              cleared as of this week&apos;s Friday.
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
          {members.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Assignees will show up here once they're added to a project."
            />
          ) : (
            <div className="space-y-3">
              {members.map((member, i) => (
                <div
                  key={member.name}
                  className="glass-card flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={member.name} index={i} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{member.name}</p>
                      {member.eligible ? (
                        <CompletedSummary tasks={member.completedThisWeek} />
                      ) : (
                        member.openProjects.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {member.openProjects.map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center rounded-full border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[11px] text-text-secondary"
                              >
                                {p.project_name}
                              </span>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <SaturdayOffBadge
                    eligible={member.eligible}
                    openCount={member.openCount}
                    saturday={new Date(member.saturdayDate)}
                  />
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
