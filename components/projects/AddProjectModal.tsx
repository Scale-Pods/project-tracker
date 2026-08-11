"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addProject } from "@/app/projects/add-project-action";
import {
  initialAddProjectState,
  PAYOUT_ROLE_LABEL,
  PAYOUT_ROLE_OPTIONS,
  PRIORITY_OPTIONS,
  type AddProjectState,
} from "@/lib/validation";
import type { ProjectWithAssignees } from "@/lib/types";

type AssigneeRow = { key: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? "Adding project…" : "Add project"}
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

export function AddProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (project: ProjectWithAssignees) => void;
}) {
  if (!open) return null;

  return (
    <AddProjectModalContent
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

function AddProjectModalContent({
  onOpenChange,
  onSuccess,
}: {
  onOpenChange: (open: boolean) => void;
  onSuccess: (project: ProjectWithAssignees) => void;
}) {
  const [state, formAction] = useActionState<AddProjectState, FormData>(
    addProject,
    initialAddProjectState
  );
  const [rows, setRows] = useState<AssigneeRow[]>([{ key: "row-0" }]);
  const [devStartDate, setDevStartDate] = useState("");
  const [devEndDate, setDevEndDate] = useState("");
  const [supportStartDate, setSupportStartDate] = useState("");
  const [projectValueDisplay, setProjectValueDisplay] = useState("");
  const rowCounter = useRef(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success" && state.project) {
      onSuccess(state.project);
      onOpenChange(false);
    }
  }, [state, onSuccess, onOpenChange]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  function addRow() {
    setRows((prev) => [...prev, { key: `row-${rowCounter.current++}` }]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
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
        aria-labelledby="add-project-title"
        className="glass-dropdown relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] shadow-[0_30px_90px_-15px_rgba(0,0,0,0.85)] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-[24px]"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 id="add-project-title" className="text-xl font-medium text-text-primary">
            Add project
          </h2>
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
          {state.status === "error" && state.message && (
            <div className="rounded-lg border border-status-bad/30 bg-status-bad/10 px-4 py-3 text-sm text-status-bad">
              {state.message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClasses} htmlFor="clientName">
                Client name
              </label>
              <input
                id="clientName"
                name="clientName"
                type="text"
                required
                defaultValue={state.submitted?.clientName}
                className={inputClasses}
                placeholder="Acme Corp"
              />
              <FieldError message={errors.clientName} />
            </div>
            <div>
              <label className={labelClasses} htmlFor="projectName">
                Project name
              </label>
              <input
                id="projectName"
                name="projectName"
                type="text"
                required
                defaultValue={state.submitted?.projectName}
                className={inputClasses}
                placeholder="Website revamp"
              />
              <FieldError message={errors.projectName} />
            </div>
          </div>

          <div>
            <label className={labelClasses} htmlFor="scope">
              Scope
            </label>
            <textarea
              id="scope"
              name="scope"
              required
              rows={3}
              defaultValue={state.submitted?.scope}
              className={inputClasses}
              placeholder="What are we delivering?"
            />
            <FieldError message={errors.scope} />
          </div>

          <div>
            <label className={labelClasses} htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              required
              defaultValue={state.submitted?.priority ?? ""}
              className={`${inputClasses} sm:max-w-[220px]`}
            >
              <option value="" disabled>
                Select
              </option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <FieldError message={errors.priority} />
          </div>

          <div>
            <p className="mb-2 text-sm text-text-primary">Development timeline</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses} htmlFor="devStartDate">
                  Start date
                </label>
                <input
                  id="devStartDate"
                  name="devStartDate"
                  type="date"
                  required
                  value={devStartDate}
                  onChange={(e) => setDevStartDate(e.target.value)}
                  className={inputClasses}
                />
                <FieldError message={errors.devStartDate} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="devEndDate">
                  End date
                </label>
                <input
                  id="devEndDate"
                  name="devEndDate"
                  type="date"
                  required
                  min={devStartDate || undefined}
                  value={devEndDate}
                  onChange={(e) => setDevEndDate(e.target.value)}
                  className={inputClasses}
                />
                <FieldError message={errors.devEndDate} />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-text-primary">Testing/Support timeline</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses} htmlFor="supportStartDate">
                  Start date
                </label>
                <input
                  id="supportStartDate"
                  name="supportStartDate"
                  type="date"
                  required
                  min={devEndDate || undefined}
                  value={supportStartDate}
                  onChange={(e) => setSupportStartDate(e.target.value)}
                  className={inputClasses}
                />
                <FieldError message={errors.supportStartDate} />
              </div>
              <div>
                <label className={labelClasses} htmlFor="supportEndDate">
                  End date
                </label>
                <input
                  id="supportEndDate"
                  name="supportEndDate"
                  type="date"
                  required
                  min={supportStartDate || undefined}
                  defaultValue={state.submitted?.supportEndDate}
                  className={inputClasses}
                />
                <FieldError message={errors.supportEndDate} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div>
              <label className={labelClasses} htmlFor="notes">
                Notes <span className="text-text-secondary">(optional)</span>
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                defaultValue={state.submitted?.notes}
                className={inputClasses}
                placeholder="Onboarding context…"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-text-primary">Assignees</span>
              <FieldError message={errors.assignees} />
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_120px_36px]">
                  <input
                    name="assigneeName"
                    type="text"
                    placeholder="Name"
                    defaultValue={state.submitted?.assignees[i]?.name}
                    className={inputClasses}
                    aria-label="Assignee name"
                  />
                  <input
                    name="assigneeRole"
                    type="text"
                    placeholder="Role (e.g. Developer)"
                    defaultValue={state.submitted?.assignees[i]?.role}
                    className={inputClasses}
                    aria-label="Assignee role"
                  />
                  <select
                    name="assigneePayoutRole"
                    defaultValue={state.submitted?.assignees[i]?.payoutRole ?? "Support"}
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
                    onClick={() => removeRow(row.key)}
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
