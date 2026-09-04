"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { recomputeDelayForProjects } from "@/lib/sync/recompute-delay";
import {
  validateEditProjectInput,
  type EditProjectInput,
  type EditProjectState,
} from "@/lib/validation";

export async function editProject(
  _prevState: EditProjectState,
  formData: FormData
): Promise<EditProjectState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const assigneeIds = formData.getAll("assigneeId").map(String);
  const assigneeNames = formData.getAll("assigneeName").map(String);
  const assigneeRoles = formData.getAll("assigneeRole").map(String);
  const assigneePayoutRoles = formData.getAll("assigneePayoutRole").map(String);
  const removedAssigneeIds = formData.getAll("removedAssigneeId").map(String).filter(Boolean);

  const input: EditProjectInput = {
    projectId,
    scope: String(formData.get("scope") ?? "").trim(),
    priority: String(formData.get("priority") ?? ""),
    projectValue: String(formData.get("projectValue") ?? ""),
    devStartDate: String(formData.get("devStartDate") ?? ""),
    devEndDate: String(formData.get("devEndDate") ?? ""),
    supportStartDate: String(formData.get("supportStartDate") ?? ""),
    supportEndDate: String(formData.get("supportEndDate") ?? ""),
    assignees: assigneeNames.map((name, i) => ({
      id: assigneeIds[i] || undefined,
      name: name.trim(),
      role: (assigneeRoles[i] ?? "").trim(),
      payoutRole: assigneePayoutRoles[i] ?? "",
    })),
  };

  const { valid, errors } = validateEditProjectInput(input);
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
    .update({
      scope: input.scope,
      priority: input.priority,
      project_value: dealSize,
      dev_start_date: input.devStartDate,
      dev_end_date: input.devEndDate,
      support_start_date: input.supportStartDate,
      support_end_date: input.supportEndDate,
    })
    .eq("id", input.projectId)
    .select()
    .single();

  if (projectError || !project) {
    return {
      status: "error",
      message: `Couldn't update the project: ${projectError?.message ?? "unknown error"}`,
      submitted: input,
    };
  }

  if (removedAssigneeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("project_assignees")
      .delete()
      .in("id", removedAssigneeIds);

    if (deleteError) {
      return {
        status: "error",
        message: `Couldn't remove team members: ${deleteError.message}`,
        submitted: input,
      };
    }
  }

  const namedAssignees = input.assignees.filter((a) => a.name);
  const existingAssignees = namedAssignees.filter((a) => a.id);
  const newAssignees = namedAssignees.filter((a) => !a.id);

  for (const a of existingAssignees) {
    const { error } = await supabase
      .from("project_assignees")
      .update({ name: a.name, role: a.role, payout_role: a.payoutRole })
      .eq("id", a.id!);

    if (error) {
      return {
        status: "error",
        message: `Couldn't update team member ${a.name}: ${error.message}`,
        submitted: input,
      };
    }
  }

  if (newAssignees.length > 0) {
    const { error } = await supabase.from("project_assignees").insert(
      newAssignees.map((a) => ({
        project_id: input.projectId,
        name: a.name,
        role: a.role,
        payout_role: a.payoutRole,
      }))
    );

    if (error) {
      return {
        status: "error",
        message: `Couldn't add new team members: ${error.message}`,
        submitted: input,
      };
    }
  }

  // The timeline may have moved — health status and delay are derived from the
  // dev/support windows (lib/sync/recompute-delay.ts), so recompute them now
  // rather than leaving a stale "Delayed" badge until the next daily cron.
  // Idempotent and self-auditing (writes audit_log source 'delay_computation'
  // only when a value actually changes); it also skips closed projects. A
  // failure here must not fail an edit whose row already persisted.
  let updatedProject = project;
  try {
    await recomputeDelayForProjects([input.projectId]);
    const { data: refreshed } = await supabase
      .from("projects")
      .select()
      .eq("id", input.projectId)
      .single();
    if (refreshed) updatedProject = refreshed;
  } catch (err) {
    console.error(
      `editProject: delay/status recompute failed for ${input.projectId}:`,
      err instanceof Error ? err.message : err
    );
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${input.projectId}`);

  return { status: "success", project: updatedProject };
}
