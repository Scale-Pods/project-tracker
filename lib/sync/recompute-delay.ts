import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";

// Ports prompt.md Section 7 exactly, against the columns actually present on
// the live projects table: dev_start_date, dev_end_date, dev_delay_days
// (prompt.md's prose says start_date/planned_end_date/delay_days, but the
// schema was renamed in a prior migration — see the plan file's Context
// section). Only ever runs on projects with actual_end_date IS NULL;
// projects_closure_status_chk would reject a status write on a closed
// project anyway, but this filters them out before ever trying.
type ProjectForDelay = {
  id: string;
  dev_start_date: string;
  dev_end_date: string;
  stage: string;
  status: string;
  dev_delay_days: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function computeForProject(
  project: ProjectForDelay,
  completionFraction: number,
  hasStaleClientBlocker: boolean,
  today: Date
): { status: string; delay_days: number } {
  const start = new Date(project.dev_start_date);
  const plannedEnd = new Date(project.dev_end_date);

  // Step 1 — overdue check, factual, always applies.
  if (today > plannedEnd) {
    return { status: "Delayed", delay_days: daysBetween(plannedEnd, today) };
  }

  // Step 2 — in-flight projection.
  const totalPlannedDays = daysBetween(start, plannedEnd);
  const elapsedDays = daysBetween(start, today);
  const elapsedFraction = totalPlannedDays > 0 ? elapsedDays / totalPlannedDays : 1;

  let result: { status: string; delay_days: number };

  if (completionFraction >= elapsedFraction) {
    result = { status: "On Track", delay_days: 0 };
  } else {
    const projectedTotalDays = completionFraction > 0 ? elapsedDays / completionFraction : totalPlannedDays;
    const projectedEnd = new Date(start.getTime() + projectedTotalDays * MS_PER_DAY);
    const delayDays = Math.max(0, daysBetween(plannedEnd, projectedEnd));
    const threshold = Math.max(3, 0.1 * totalPlannedDays);
    result = {
      status: delayDays <= threshold ? "At Risk" : "Delayed",
      delay_days: delayDays,
    };
  }

  // Step 3 — blocker override: a stale open client-side blocker floors
  // status at "At Risk" regardless of the arithmetic above.
  if (hasStaleClientBlocker && result.status === "On Track") {
    result = { ...result, status: "At Risk" };
  }

  return result;
}

async function recompute(projectIds: string[] | null): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();

  let projectsQuery = supabase
    .from("projects")
    .select("id, dev_start_date, dev_end_date, stage, status, dev_delay_days")
    .is("actual_end_date", null);

  if (projectIds) {
    projectsQuery = projectsQuery.in("id", projectIds);
  }

  const [projectsRes, stagesRes, blockersRes] = await Promise.all([
    projectsQuery,
    supabase.from("project_stages").select("name, completion_fraction"),
    supabase
      .from("blockers")
      .select("project_id, first_seen_date")
      .eq("side", "client")
      .neq("status", "resolved"),
  ]);

  if (projectsRes.error) throw new Error(projectsRes.error.message);
  if (stagesRes.error) throw new Error(stagesRes.error.message);
  if (blockersRes.error) throw new Error(blockersRes.error.message);

  const fractionByStage = new Map((stagesRes.data ?? []).map((s) => [s.name, Number(s.completion_fraction)]));

  const staleClientBlockerProjects = new Set(
    (blockersRes.data ?? [])
      .filter((b) => daysBetween(new Date(b.first_seen_date), today) > 5)
      .map((b) => b.project_id)
  );

  for (const project of projectsRes.data ?? []) {
    const fraction = fractionByStage.get(project.stage);
    if (fraction === undefined) {
      // No matching project_stages row — report rather than guess (prompt.md
      // Section 7, "never hard-code a completion fraction").
      console.error(`recompute-delay: project ${project.id} has stage "${project.stage}" with no project_stages row; skipped.`);
      continue;
    }

    const computed = computeForProject(
      project,
      fraction,
      staleClientBlockerProjects.has(project.id),
      today
    );

    if (computed.status === project.status && computed.delay_days === project.dev_delay_days) {
      continue; // no audit noise for an unchanged recomputation
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: computed.status, dev_delay_days: computed.delay_days })
      .eq("id", project.id)
      .is("actual_end_date", null);

    if (updateError) throw new Error(`recompute-delay update failed for ${project.id}: ${updateError.message}`);

    const { error: auditError } = await supabase.from("audit_log").insert([
      {
        project_id: project.id,
        field_changed: "status",
        old_value: project.status,
        new_value: computed.status,
        source: "delay_computation" as const,
      },
      {
        project_id: project.id,
        field_changed: "dev_delay_days",
        old_value: String(project.dev_delay_days),
        new_value: String(computed.delay_days),
        source: "delay_computation" as const,
      },
    ]);

    if (auditError) throw new Error(`recompute-delay audit_log insert failed for ${project.id}: ${auditError.message}`);
  }
}

export async function recomputeDelayForProjects(projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) return;
  await recompute(projectIds);
}

export async function recomputeDelayPortfolioWide(): Promise<void> {
  await recompute(null);
}
