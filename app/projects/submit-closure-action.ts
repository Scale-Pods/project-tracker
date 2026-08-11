"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import { closureDelayDays } from "@/lib/incentive";
import {
  validateClosureInput,
  type ClosureInput,
  type ClosureState,
} from "@/lib/validation";

export async function submitClosure(
  _prevState: ClosureState,
  formData: FormData
): Promise<ClosureState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const actualEndDate = String(formData.get("actualEndDate") ?? "").trim();
  const clientRatingStr = String(formData.get("clientRating") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const testimonialAssigneeIds = formData.getAll("testimonialAssigneeId").map(String);

  const clientRating = Number(clientRatingStr);

  const input: ClosureInput = {
    projectId,
    actualEndDate,
    clientRating,
    notes,
    testimonialReceivedAssigneeIds: testimonialAssigneeIds,
  };

  const { valid, errors } = validateClosureInput(input);
  if (!valid) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: errors,
    };
  }

  const supabase = createServiceRoleClient();

  const { data: existingProject, error: fetchError } = await supabase
    .from("projects")
    .select("support_end_date")
    .eq("id", input.projectId)
    .single();

  if (fetchError || !existingProject) {
    return {
      status: "error",
      message: `Failed to load project for closure: ${fetchError?.message ?? "unknown error"}`,
    };
  }

  // Closing a project fixes its schedule and health for good — "At Risk" and
  // an ongoing "behind schedule" badge only make sense while work is still in
  // flight, so closure recomputes support_delay_days/status from the final
  // dates instead of leaving them frozen at whatever the daily cron last
  // wrote. dev_delay_days is left untouched — the development phase already
  // finished earlier and its recorded delay doesn't change at closure.
  const delayDays = closureDelayDays({
    support_end_date: existingProject.support_end_date,
    actual_end_date: input.actualEndDate,
  });

  // 1. Update project closure fields
  const { data: updatedProject, error: projectError } = await supabase
    .from("projects")
    .update({
      actual_end_date: input.actualEndDate,
      client_rating: input.clientRating,
      awaiting_closure_data: false,
      stage: "Completed",
      status: delayDays > 0 ? "Delayed" : "On Track",
      support_delay_days: delayDays,
    })
    .eq("id", input.projectId)
    .select()
    .single();

  if (projectError || !updatedProject) {
    return {
      status: "error",
      message: `Failed to update project closure: ${projectError?.message ?? "unknown error"}`,
    };
  }

  // 2. Update testimonial statuses for team members if provided
  if (testimonialAssigneeIds.length > 0) {
    await supabase
      .from("project_assignees")
      .update({ testimonial_received: true })
      .in("id", testimonialAssigneeIds);
  }

  // 3. Add closure remarks entry if notes provided
  if (input.notes) {
    await supabase.from("remarks_log").insert({
      project_id: input.projectId,
      source: "manual_onboarding" as const,
      summary: input.notes,
      source_meeting_id: null,
      unverified: false,
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${input.projectId}`);

  return {
    status: "success",
    message: "Project closure details saved successfully.",
    project: {
      actual_end_date: updatedProject.actual_end_date!,
      client_rating: updatedProject.client_rating!,
      awaiting_closure_data: updatedProject.awaiting_closure_data,
    },
  };
}
