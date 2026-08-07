import { SourceBadge, UnverifiedFlag } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatDate } from "@/lib/format";
import type { RemarksLogEntry } from "@/lib/types";

export function ActivityLog({ remarks }: { remarks: RemarksLogEntry[] }) {
  return (
    <section id="activity" className="scroll-mt-24">
      <SectionHeading eyebrow={`${remarks.length} entries`} title="Activity Log" />

      {remarks.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Notes from onboarding and meeting updates will show up here as they come in."
        />
      ) : (
        <ol className="relative space-y-6 border-l border-border-subtle pl-6">
          {remarks.map((r) => (
            <li key={r.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full border-2 border-bg-deep bg-accent-primary"
              />
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={r.source} />
                <span className="text-[11px] text-text-secondary">{formatDate(r.created_at)}</span>
                {r.unverified && <UnverifiedFlag />}
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-primary">{r.summary}</p>
              {r.source_meeting_id && (
                <p className="mt-1 text-[11px] text-text-secondary/70">
                  from meeting {r.source_meeting_id}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
