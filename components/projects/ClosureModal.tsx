"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitClosure } from "@/app/projects/submit-closure-action";
import { initialClosureState } from "@/lib/validation";
import type { Project, ProjectAssignee } from "@/lib/types";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  const colorForVal = (v: number) => {
    if (v <= 4) return "text-status-bad";
    if (v <= 6) return "text-status-warn";
    return "text-status-good";
  };

  const labelFor = (v: number) => {
    if (v <= 2) return "Very poor";
    if (v <= 4) return "Below average";
    if (v <= 6) return "Average";
    if (v <= 8) return "Good";
    if (v <= 9) return "Great";
    return "Excellent";
  };

  const displayVal = hovered || value;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            type="button"
            onMouseEnter={() => setHovered(v)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(v)}
            aria-label={`Rate ${v} out of 10`}
            className={`flex h-9 w-9 flex-1 items-center justify-center rounded-xl text-sm font-bold transition-all duration-150 ${
              v <= displayVal
                ? `${colorForVal(v)} bg-current/20 scale-105 shadow-[0_0_12px_-3px_currentColor]`
                : "glass-input text-text-secondary/50 hover:text-text-secondary"
            }`}
          >
            <span className={v <= displayVal ? colorForVal(v) : "text-inherit"}>{v}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">1 = Very poor</span>
        <span className={`font-semibold ${colorForVal(displayVal)}`}>
          {displayVal > 0 ? `${displayVal}/10 — ${labelFor(displayVal)}` : "Select a rating"}
        </span>
        <span className="text-text-secondary">10 = Excellent</span>
      </div>
    </div>
  );
}

export function ClosureModal({
  open,
  onOpenChange,
  project,
  assignees = [],
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  assignees?: ProjectAssignee[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitClosure, initialClosureState);

  const todayStr = new Date().toISOString().split("T")[0];

  const [actualEndDate, setActualEndDate] = useState(
    project.actual_end_date ?? todayStr
  );
  const [clientRating, setClientRating] = useState<number>(
    project.client_rating ?? 0
  );
  const [notes, setNotes] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    assignees.filter((a) => a.testimonial_received).map((a) => a.id)
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
      router.refresh();
      if (onSuccess) onSuccess();
    }
  }, [state, onOpenChange, router, onSuccess]);

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

  function toggleAssignee(id: string) {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const errors = state.fieldErrors ?? {};
  const isEdit = Boolean(project.actual_end_date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="closure-modal-title"
        className="glass-dropdown relative flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-[28px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[28px]"
      >
        {/* Decorative glow orb behind header */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 h-40 w-60 -translate-x-1/2 rounded-full bg-accent-primary/15 blur-3xl"
        />

        {/* Header */}
        <div className="relative flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2
              id="closure-modal-title"
              className="text-xl font-bold text-text-primary"
            >
              {isEdit ? "Edit Closure Details" : "Close Project"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{project.project_name}</span>
              {" "}for{" "}
              <span className="text-text-primary">{project.client_name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-all hover:bg-white/10 hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form action={formAction} className="flex-1 overflow-y-auto">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="clientRating" value={clientRating} />
          {selectedAssignees.map((id) => (
            <input key={id} type="hidden" name="testimonialAssigneeId" value={id} />
          ))}

          <div className="space-y-6 px-6 py-6">
            {/* Server error banner */}
            {state.status === "error" && state.message && !Object.keys(errors).length && (
              <div className="flex items-start gap-3 rounded-xl border border-status-bad/40 bg-status-bad/10 px-4 py-3 text-sm text-status-bad">
                <span>{state.message}</span>
              </div>
            )}

            {/* Section: Completion Date */}
            <div>
              <label
                htmlFor="actualEndDate"
                className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase"
              >
                Actual Completion Date
                <span className="text-status-bad">*</span>
              </label>
              <div className="mt-2.5">
                <input
                  id="actualEndDate"
                  name="actualEndDate"
                  type="date"
                  value={actualEndDate}
                  max={todayStr}
                  onChange={(e) => setActualEndDate(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none sm:max-w-xs"
                />
                {errors.actualEndDate && (
                  <p className="mt-1.5 text-xs text-status-bad">{errors.actualEndDate}</p>
                )}
              </div>
            </div>

            {/* Section: Client Rating */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase">
                Client Satisfaction Score
                <span className="text-status-bad">*</span>
              </label>
              <div className="mt-3">
                <StarRating value={clientRating} onChange={setClientRating} />
                {errors.clientRating && (
                  <p className="mt-1.5 text-xs text-status-bad">{errors.clientRating}</p>
                )}
              </div>
            </div>

            {/* Section: Testimonials */}
            {assignees.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase">
                  Testimonials Received
                </label>
                <p className="mt-1 text-xs text-text-secondary">
                  Check the team members from whom a client testimonial was collected.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {assignees.map((a) => {
                    const checked = selectedAssignees.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAssignee(a.id)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                          checked
                            ? "border-status-good/60 bg-status-good/15 shadow-[0_0_16px_-4px_rgba(52,217,164,0.4)]"
                            : "glass-input border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            checked
                              ? "border-status-good bg-status-good text-[#04140f]"
                              : "border-border-subtle"
                          }`}
                        >
                          {checked && (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">{a.name}</p>
                          <p className="truncate text-[11px] text-text-secondary">{a.role}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section: Closure Notes */}
            <div>
              <label
                htmlFor="closureNotes"
                className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase"
              >
                Closure Notes
                <span className="text-text-secondary/50 ml-1 font-normal normal-case tracking-normal">
                  — optional
                </span>
              </label>
              <textarea
                id="closureNotes"
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Summary of outcomes, final client feedback, key takeaways, or anything worth logging…"
                className="glass-input mt-2.5 w-full resize-none rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[rgba(10,10,40,0.85)] px-6 py-4 backdrop-blur-md">
            <p className="text-xs text-text-secondary">
              {isEdit ? "Updates will be reflected immediately." : "This will mark the project as officially closed."}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-white/5 hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || clientRating === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-status-good px-6 py-2 text-sm font-bold text-[#04140f] shadow-[0_0_20px_-4px_rgba(52,217,164,0.6)] transition-all hover:shadow-[0_0_30px_-2px_rgba(52,217,164,0.8)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {pending ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>{isEdit ? "Update Closure" : "Save & Close Project"}</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
