"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ClosureModal } from "@/components/projects/ClosureModal";
import { formatDate } from "@/lib/format";
import type { Project, ProjectAssignee } from "@/lib/types";

export function ClosurePanel({
  project,
  assignees = [],
}: {
  project: Project;
  assignees?: ProjectAssignee[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (project.actual_end_date) {
    const rating = project.client_rating;
    return (
      <section id="closure" className="scroll-mt-24">
        <SectionHeading eyebrow="Closure" title="Project closed" />

        <div className="rounded-2xl border border-status-good/50 bg-gradient-to-br from-status-good/25 via-status-good/8 to-transparent p-6 shadow-[0_0_70px_-18px_rgba(52,217,164,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">
                Completed on
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {formatDate(project.actual_end_date)}
              </p>
            </div>

            {rating !== null && (
              <div className="flex flex-col items-end">
                <p className="text-[11px] tracking-[0.08em] text-text-secondary uppercase">
                  Client satisfaction
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-3xl font-bold tabular-nums text-status-good">
                    {rating}
                  </span>
                  <span className="text-lg text-text-secondary">/10</span>
                </div>
              </div>
            )}
          </div>

          {rating !== null && (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                  <div
                    key={v}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      v <= rating
                        ? "bg-status-good shadow-[0_0_6px_rgba(52,217,164,0.6)]"
                        : "bg-surface-elevated"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="glass-input inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:text-text-primary"
            >
              Edit closure details
            </button>
          </div>
        </div>

        {modalOpen && (
          <ClosureModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            project={project}
            assignees={assignees}
          />
        )}
      </section>
    );
  }

  if (project.awaiting_closure_data) {
    return (
      <section id="closure" className="scroll-mt-24">
        <SectionHeading eyebrow="Closure" title="Closure details pending" />

        <div className="rounded-2xl border border-status-warn/50 bg-gradient-to-br from-status-warn/25 via-status-warn/8 to-transparent p-6 shadow-[0_0_70px_-18px_rgba(245,180,80,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                This project is ready to close.
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Submit the completion date, client rating and testimonial info to finalise the record.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-status-warn/60 bg-status-warn/20 px-5 py-2.5 text-sm font-semibold text-status-warn shadow-[0_0_20px_-6px_var(--color-status-warn)] transition-all hover:bg-status-warn/30 hover:shadow-[0_0_28px_-4px_var(--color-status-warn)]"
            >
              Submit Closure Details
            </button>
          </div>
        </div>

        {modalOpen && (
          <ClosureModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            project={project}
            assignees={assignees}
          />
        )}
      </section>
    );
  }

  // Active project — show a subtle "Close project" trigger for manual closure
  return (
    <section id="closure" className="scroll-mt-24">
      <SectionHeading eyebrow="Closure" title="Close this project" />

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">Mark this project as complete</p>
            <p className="mt-1 text-xs text-text-secondary">
              Record the actual end date, client satisfaction score, and any closure notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)]"
          >
            Close Project
          </button>
        </div>
      </div>

      {modalOpen && (
        <ClosureModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          project={project}
          assignees={assignees}
        />
      )}
    </section>
  );
}
