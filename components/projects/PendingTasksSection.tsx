import { UnverifiedFlag } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { daysBetween, formatDate } from "@/lib/format";
import type { PendingTask } from "@/lib/types";

export function PendingTasksSection({ tasks }: { tasks: PendingTask[] }) {
  const groups = new Map<string, PendingTask[]>();
  for (const t of tasks) {
    const list = groups.get(t.assignee_name) ?? [];
    list.push(t);
    groups.set(t.assignee_name, list);
  }

  return (
    <section id="tasks" className="scroll-mt-24">
      <SectionHeading eyebrow={`${tasks.length} total`} title="Pending Tasks" />

      {tasks.length === 0 ? (
        <EmptyState
          title="No pending tasks"
          description="Open to-do items surfaced from meetings will appear here, grouped by who owns them."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([assignee, items]) => {
            const openCount = items.filter((t) => t.status.toLowerCase() !== "done").length;
            return (
              <div key={assignee}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-primary">
                  {assignee}
                  <span className="text-xs font-normal text-text-secondary">
                    {openCount} open · {items.length} total
                  </span>
                </h3>
                <div className="space-y-2">
                  {items.map((t) => {
                    const done = t.status.toLowerCase() === "done";
                    return (
                      <div
                        key={t.id}
                        className="glass-card flex items-start gap-3 rounded-xl px-4 py-3"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            done
                              ? "border-status-good bg-status-good/20 text-status-good"
                              : "border-border-subtle"
                          }`}
                        >
                          {done && "✓"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${done ? "text-text-secondary line-through" : "text-text-primary"}`}
                          >
                            {t.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
                            {done && t.completed_date ? (
                              <span>Completed {formatDate(t.completed_date)}</span>
                            ) : (
                              <span>
                                Pending {daysBetween(t.first_mentioned_date, t.last_mentioned_date)}d
                              </span>
                            )}
                            <span>Started on {formatDate(t.first_mentioned_date)}</span>
                            {t.due_date && <span>Due on {formatDate(t.due_date)}</span>}
                            {t.source_meeting_id && <span>from meeting {t.source_meeting_id}</span>}
                          </div>
                        </div>
                        {t.unverified && <UnverifiedFlag />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
