"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import {
  validateAddProjectInput,
  type AddProjectInput,
  type AddProjectState,
} from "@/lib/validation";

export async function addProject(
  _prevState: AddProjectState,
  formData: FormData
): Promise<AddProjectState> {
  const assigneeNames = formData.getAll("assigneeName").map(String);
  const assigneeRoles = formData.getAll("assigneeRole").map(String);
  const assigneePayoutRoles = formData.getAll("assigneePayoutRole").map(String);

  const input: AddProjectInput = {
    clientName: String(formData.get("clientName") ?? "").trim(),
    projectName: String(formData.get("projectName") ?? "").trim(),
    scope: String(formData.get("scope") ?? "").trim(),
    priority: String(formData.get("priority") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    plannedEndDate: String(formData.get("plannedEndDate") ?? ""),
    projectValue: String(formData.get("projectValue") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
    assignees: assigneeNames.map((name, i) => ({
      name: name.trim(),
      role: (assigneeRoles[i] ?? "").trim(),
      payoutRole: assigneePayoutRoles[i] ?? "",
    })),
  };

  const { valid, errors } = validateAddProjectInput(input);
  if (!valid) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: errors,
      submitted: input,
    };
  }

  const supabase = createServiceRoleClient();
  const dealSize = Number(input.projectValue.replace(/,/g, ""));

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_name: input.clientName,
      project_name: input.projectName,
      scope: input.scope,
      priority: input.priority,
      start_date: input.startDate,
      planned_end_date: input.plannedEndDate,
      project_value: dealSize,
      notes: input.notes || null,
      status: "On Track",
      stage: "Onboarding",
      delay_days: 0,
      unverified: false,
      awaiting_closure_data: false,
    })
    .select()
    .single();

  if (projectError || !project) {
    return {
      status: "error",
      message: `Couldn't create the project: ${projectError?.message ?? "unknown error"}`,
      submitted: input,
    };
  }

  const namedAssignees = input.assignees.filter((a) => a.name);
  const { data: insertedAssignees, error: assigneesError } = await supabase
    .from("project_assignees")
    .insert(
      namedAssignees.map((a) => ({
        project_id: project.id,
        name: a.name,
        role: a.role,
        payout_role: a.payoutRole,
      }))
    )
    .select();

  if (assigneesError || !insertedAssignees) {
    // Don't leave an orphaned project row with no assignees.
    await supabase.from("projects").delete().eq("id", project.id);
    return {
      status: "error",
      message: `Couldn't save the team: ${assigneesError?.message ?? "unknown error"}`,
      submitted: input,
    };
  }

  if (input.notes) {
    await supabase.from("remarks_log").insert({
      project_id: project.id,
      source: "manual_onboarding",
      summary: input.notes,
      source_meeting_id: null,
      unverified: false,
    });
  }

  revalidatePath("/projects");

  return {
    status: "success",
    project: {
      ...project,
      assignees: insertedAssignees.map((a) => ({ id: a.id, name: a.name })),
    },
  };
}
