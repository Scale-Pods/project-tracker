import { PayoutRoleBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatDate } from "@/lib/format";
import type { ProjectAssignee } from "@/lib/types";

export function TeamSection({ assignees }: { assignees: ProjectAssignee[] }) {
  return (
    <section id="team" className="scroll-mt-24">
      <SectionHeading
        eyebrow={`${assignees.length} member${assignees.length === 1 ? "" : "s"}`}
        title="Team"
      />

      {assignees.length === 0 ? (
        <EmptyState
          title="No team members recorded"
          description="Assignees will show up here once they're added to this project."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignees.map((a, i) => (
            <div
              key={a.id}
              className="glass-card glass-card-interactive rounded-2xl p-5 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <Avatar name={a.name} index={i} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{a.name}</p>
                  <p className="truncate text-xs text-text-secondary">{a.role}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <PayoutRoleBadge role={a.payout_role} />
                <span
                  className="flex items-center gap-1.5 text-xs text-text-secondary"
                  title={a.testimonial_received ? "Testimonial received" : "Testimonial not yet received"}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${a.testimonial_received ? "bg-status-good" : "bg-text-secondary/40"}`}
                    aria-hidden="true"
                  />
                  {a.testimonial_received ? "Testimonial ✓" : "Testimonial"}
                </span>
              </div>

              <p className="mt-3 text-[11px] text-text-secondary">Added {formatDate(a.added_at)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
