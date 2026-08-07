import { SideBadge, UnverifiedFlag } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { daysBetween, formatDate } from "@/lib/format";
import type { Blocker } from "@/lib/types";

type ColumnKey = "new" | "persisting" | "resolved";

const COLUMNS: { key: ColumnKey; label: string; dot: string; empty: string }[] = [
  { key: "new", label: "New", dot: "bg-status-warn", empty: "No open blockers" },
  { key: "persisting", label: "Persisting", dot: "bg-status-bad", empty: "Nothing persisting" },
  { key: "resolved", label: "Resolved", dot: "bg-status-good", empty: "Nothing resolved yet" },
];

export function BlockersSection({ blockers }: { blockers: Blocker[] }) {
  const byColumn = (key: ColumnKey) => blockers.filter((b) => b.status.toLowerCase() === key);

  return (
    <section id="blockers" className="scroll-mt-24">
      <SectionHeading eyebrow={`${blockers.length} total`} title="Blockers" />

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = byColumn(col.key);
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden="true" />
                <h3 className="text-sm font-medium text-text-primary">{col.label}</h3>
                <span className="text-xs text-text-secondary">{items.length}</span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-secondary">
                  {col.empty}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((b) => (
                    <div
                      key={b.id}
                      className="glass-card glass-card-interactive rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-text-primary">{b.description}</p>
                        {b.unverified && <UnverifiedFlag />}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <SideBadge side={b.side} />
                        <span className="text-[11px] text-text-secondary">
                          Open {daysBetween(b.first_seen_date, b.last_mentioned_date)}d
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
                        {col.key === "resolved" && b.resolved_date ? (
                          <span>Resolved on {formatDate(b.resolved_date)}</span>
                        ) : (
                          <span>Started on {formatDate(b.first_seen_date)}</span>
                        )}
                        <span>Last mentioned {formatDate(b.last_mentioned_date)}</span>
                      </div>

                      {b.source_meeting_id && (
                        <p className="mt-2 truncate text-[11px] text-text-secondary/70">
                          from meeting {b.source_meeting_id}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
