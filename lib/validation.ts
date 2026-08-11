import type { Project, ProjectWithAssignees } from "@/lib/types";

export type AssigneeInput = {
  name: string;
  role: string;
  payoutRole: string;
};

export type AddProjectInput = {
  clientName: string;
  projectName: string;
  scope: string;
  priority: string;
  devStartDate: string;
  devEndDate: string;
  supportStartDate: string;
  supportEndDate: string;
  projectValue: string;
  notes: string;
  assignees: AssigneeInput[];
};

export const PRIORITY_OPTIONS = ["High", "Medium", "Low"] as const;
export const PAYOUT_ROLE_OPTIONS = ["Owner", "Support"] as const;

// Display labels only — project_assignees.payout_role keeps storing
// "Owner"/"Support" so the payout-split automation's string match doesn't break.
export const PAYOUT_ROLE_LABEL: Record<string, string> = {
  Owner: "Project Lead",
  Support: "Member",
};

// Lives here rather than in add-project-action.ts because a "use server" file
// may only export async functions in this Next.js version — no plain object
// or type exports alongside the action.
export type AddProjectState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  submitted?: AddProjectInput;
  project?: ProjectWithAssignees;
};

export const initialAddProjectState: AddProjectState = { status: "idle" };

/** Shared client+server validation so the two never drift out of sync. */
export function validateAddProjectInput(input: AddProjectInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.clientName.trim()) errors.clientName = "Client name is required.";
  if (!input.projectName.trim()) errors.projectName = "Project name is required.";
  if (!input.scope.trim()) errors.scope = "Scope is required.";
  if (!PRIORITY_OPTIONS.includes(input.priority as (typeof PRIORITY_OPTIONS)[number])) {
    errors.priority = "Select a priority.";
  }
  if (!input.devStartDate) errors.devStartDate = "Development start date is required.";
  if (!input.devEndDate) errors.devEndDate = "Development end date is required.";
  if (
    input.devStartDate &&
    input.devEndDate &&
    new Date(input.devEndDate) <= new Date(input.devStartDate)
  ) {
    errors.devEndDate = "Development end date must be after the development start date.";
  }

  if (!input.supportStartDate) errors.supportStartDate = "Testing/Support start date is required.";
  if (!input.supportEndDate) errors.supportEndDate = "Testing/Support end date is required.";
  if (
    input.devEndDate &&
    input.supportStartDate &&
    new Date(input.supportStartDate) < new Date(input.devEndDate)
  ) {
    errors.supportStartDate = "Testing/Support can't start before development ends.";
  }
  if (
    input.supportStartDate &&
    input.supportEndDate &&
    new Date(input.supportEndDate) <= new Date(input.supportStartDate)
  ) {
    errors.supportEndDate = "Testing/Support end date must be after its start date.";
  }

  const dealSize = Number(input.projectValue.replace(/,/g, ""));
  if (!input.projectValue || Number.isNaN(dealSize) || dealSize <= 0) {
    errors.projectValue = "Enter a valid deal size.";
  }

  const namedAssignees = input.assignees.filter((a) => a.name.trim());
  if (namedAssignees.length === 0) {
    errors.assignees = "At least one assignee with a name is required.";
  } else {
    for (const assignee of namedAssignees) {
      if (!PAYOUT_ROLE_OPTIONS.includes(assignee.payoutRole as (typeof PAYOUT_ROLE_OPTIONS)[number])) {
        errors.assignees = "Each assignee needs a valid payout role.";
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export type EditAssigneeInput = AssigneeInput & { id?: string };

export type EditProjectInput = {
  projectId: string;
  scope: string;
  priority: string;
  projectValue: string;
  assignees: EditAssigneeInput[];
};

export type EditProjectState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  submitted?: EditProjectInput;
  project?: Project;
};

export const initialEditProjectState: EditProjectState = { status: "idle" };

/** Mirrors validateAddProjectInput, scoped to the fields an edit is allowed to touch. */
export function validateEditProjectInput(input: EditProjectInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.projectId) errors.projectId = "Project ID is required.";
  if (!input.scope.trim()) errors.scope = "Scope is required.";
  if (!PRIORITY_OPTIONS.includes(input.priority as (typeof PRIORITY_OPTIONS)[number])) {
    errors.priority = "Select a priority.";
  }

  const dealSize = Number(input.projectValue.replace(/,/g, ""));
  if (!input.projectValue || Number.isNaN(dealSize) || dealSize <= 0) {
    errors.projectValue = "Enter a valid deal size.";
  }

  const namedAssignees = input.assignees.filter((a) => a.name.trim());
  if (namedAssignees.length === 0) {
    errors.assignees = "At least one assignee with a name is required.";
  } else {
    for (const assignee of namedAssignees) {
      if (!PAYOUT_ROLE_OPTIONS.includes(assignee.payoutRole as (typeof PAYOUT_ROLE_OPTIONS)[number])) {
        errors.assignees = "Each assignee needs a valid payout role.";
        break;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export type ClosureInput = {
  projectId: string;
  actualEndDate: string;
  clientRating: number;
  notes?: string;
  testimonialReceivedAssigneeIds?: string[];
};

export type ClosureState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  project?: {
    actual_end_date: string;
    client_rating: number;
    awaiting_closure_data: boolean;
  };
};

export const initialClosureState: ClosureState = { status: "idle" };

export function validateClosureInput(input: ClosureInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.projectId) errors.projectId = "Project ID is required.";
  if (!input.actualEndDate) errors.actualEndDate = "Completion date is required.";
  if (
    typeof input.clientRating !== "number" ||
    Number.isNaN(input.clientRating) ||
    input.clientRating < 1 ||
    input.clientRating > 10
  ) {
    errors.clientRating = "Select a valid client rating (1–10).";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
