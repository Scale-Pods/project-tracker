import { Avatar } from "@/components/ui/Avatar";
import { PayoutRoleBadge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatCurrency } from "@/lib/format";
import { computePayoutBreakdown } from "@/lib/incentive";
import type { Project, ProjectAssignee } from "@/lib/types";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-text-secondary">{hint}</p>}
    </div>
  );
}

// Shown once closure data (completion date + client rating) exists, directly
// below the Closure panel — a plain in-page section, no modal.
export function PayoutBreakdownSection({
  project,
  assignees,
}: {
  project: Project;
  assignees: ProjectAssignee[];
}) {
  const breakdown = computePayoutBreakdown(project, assignees);
  if (!breakdown) return null;

  const {
    incentivePool,
    delayDays,
    qualityFactor,
    speedFactor,
    finalPool,
    perAssignee,
  } = breakdown;

  return (
    <section id="payout" className="scroll-mt-24">
      <SectionHeading eyebrow="Payout" title="Incentive payout breakdown" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Incentive pool (10%)"
          value={formatCurrency(incentivePool)}
          hint={`${formatCurrency(project.project_value)} project value`}
        />
        <StatTile
          label="Quality bonus"
          value={`${Math.round(qualityFactor * 100)}%`}
          hint={`Client rating ${breakdown.clientRating}/10`}
        />
        <StatTile
          label="Speed bonus"
          value={`${Math.round(speedFactor * 100)}%`}
          hint={delayDays > 0 ? `${delayDays} day${delayDays === 1 ? "" : "s"} late at closure` : "On time / early"}
        />
        <StatTile
          label="Final pool"
          value={formatCurrency(finalPool)}
          hint="Pool × quality × speed"
        />
      </div>

      {perAssignee.length === 0 ? (
        <div className="glass-panel mt-4 rounded-2xl p-6 text-sm text-text-secondary">
          No team members are assigned to this project, so no payout can be split.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perAssignee.map(
            (
              {
                assignee,
                teamSharePercent,
                teamShareAmount,
                leadBonusPercent,
                leadBonusAmount,
                testimonialBonus,
                totalPayout,
              },
              i
            ) => (
              <div key={assignee.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={assignee.name} index={i} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{assignee.name}</p>
                    <PayoutRoleBadge role={assignee.payout_role} />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Team share ({Math.round(teamSharePercent * 100)}%)</span>
                    <span className="tabular-nums text-text-primary">{formatCurrency(teamShareAmount)}</span>
                  </div>
                  {leadBonusAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Lead bonus ({Math.round(leadBonusPercent * 100)}%)</span>
                      <span className="tabular-nums text-text-primary">{formatCurrency(leadBonusAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Testimonial bonus</span>
                    <span className="tabular-nums text-text-primary">
                      {testimonialBonus > 0 ? formatCurrency(testimonialBonus) : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-[0.06em]">
                    Total payout
                  </span>
                  <span className="text-lg font-bold tabular-nums text-status-good">
                    {formatCurrency(totalPayout)}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
