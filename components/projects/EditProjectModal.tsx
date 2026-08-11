"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { editProject } from "@/app/projects/edit-project-action";
import {
  initialEditProjectState,
  PAYOUT_ROLE_LABEL,
  PAYOUT_ROLE_OPTIONS,
  PRIORITY_OPTIONS,
  type EditProjectState,
} from "@/lib/validation";
import type { Project, ProjectAssignee } from "@/lib/types";

type AssigneeRow = { key: string; id?: string; name: string; role: string; payoutRole: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-status-bad">{message}</p>;
}

const inputClasses =
  "w-full rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent-primary focus:outline-none";
const labelClasses = "mb-1.5 block text-sm text-text-primary";

export function EditProjectModal({
  open,
  onOpenChange,
  project,
  assignees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  assignees: ProjectAssignee[];
}) {
  if (!open) return null;

  return (
    <EditProjectModalContent onOpenChange={onOpenChange} project={project} assignees={assignees} />
  );
}

function EditProjectModalContent({
  onOpenChange,
  project,
  assignees,
}: {
  onOpenChange: (open: boolean) => void;
  project: Project;
  assignees: ProjectAssignee[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<EditProjectState, FormData>(
    editProject,
    initialEditProjectState
  );

  const rowCounter = useRef(assignees.length);
  const [rows, setRows] = useState<AssigneeRow[]>(() =>
    assignees.length > 0
      ? assignees.map((a, i) => ({
          key: `row-${i}`,
          id: a.id,
          name: a.name,
          role: a.role,
          payoutRole: a.payout_role,
        }))
      : [{ key: "row-0", name: "", role: "", payoutRole: "Support" }]
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [projectValueDisplay, setProjectValueDisplay] = useState(
    project.project_value ? project.project_value.toLocaleString("en-IN") : ""
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  function addRow() {
    rowCounter.current += 1;
    setRows((prev) => [
      ...prev,
      { key: `row-${rowCounter.current}`, name: "", role: "", payoutRole: "Support" },
    ]);
  }

  function removeRow(row: AssigneeRow) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev));
    if (row.id) setRemovedIds((prev) => [...prev, row.id!]);
  }

  function handleProjectValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setProjectValueDisplay(raw ? Number(raw).toLocaleString("en-IN") : "");
  }

  const errors = state.fieldErrors ?? {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-project-title"
        className="glass-dropdown relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.85)] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[24px]"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <h2 id="edit-project-title" className="text-xl font-medium text-text-primary">
              Edit project
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {project.project_name} for {project.client_name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-card hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <input type="hidden" name="projectId" value={project.id} />
          {removedIds.map((id) => (
            <input key={id} type="hidden" name="removedAssigneeId" value={id} />
          ))}

          {state.status === "error" && state.message && (
            <div className="rounded-lg border border-status-bad/30 bg-status-bad/10 px-4 py-3 text-sm text-status-bad">
              {state.message}
            </div>
          )}

          <div>
            <label className={labelClasses} htmlFor="scope">
              Scope
            </label>
            <textarea
              id="scope"
              name="scope"
              required
              rows={3}
              defaultValue={state.submitted?.scope ?? project.scope}
              className={inputClasses}
              placeholder="What are we delivering?"
            />
            <FieldError message={errors.scope} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClasses} htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                required
                defaultValue={state.submitted?.priority ?? project.priority}
                className={inputClasses}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError message={errors.priority} />
            </div>
            <div>
              <label className={labelClasses} htmlFor="projectValue">
                Deal size (₹)
              </label>
              <input
                id="projectValue"
                name="projectValue"
                type="text"
                inputMode="numeric"
                required
                value={projectValueDisplay}
                onChange={handleProjectValueChange}
                className={inputClasses}
                placeholder="5,00,000"
              />
              <FieldError message={errors.projectValue} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-text-primary">Assignees</span>
              <FieldError message={errors.assignees} />
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_120px_36px]"
                >
                  <input type="hidden" name="assigneeId" value={row.id ?? ""} />
                  <input
                    name="assigneeName"
                    type="text"
                    placeholder="Name"
                    defaultValue={row.name}
                    className={inputClasses}
                    aria-label="Assignee name"
                  />
                  <input
                    name="assigneeRole"
                    type="text"
                    placeholder="Role (e.g. Developer)"
                    defaultValue={row.role}
                    className={inputClasses}
                    aria-label="Assignee role"
                  />
                  <select
                    name="assigneePayoutRole"
                    defaultValue={row.payoutRole || "Support"}
                    className={inputClasses}
                    aria-label="Payout role"
                  >
                    {PAYOUT_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {PAYOUT_ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(row)}
                    disabled={rows.length === 1}
                    aria-label="Remove assignee"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle text-text-secondary transition-colors hover:border-status-bad/40 hover:text-status-bad disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-3 text-sm font-medium text-accent-primary hover:underline"
            >
              + Add another person
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/40"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
