import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";

// Ports prompt.md Section 7, against the columns actually present on the
// live projects table: dev_start_date, dev_end_date, dev_delay_days
// (prompt.md's prose says start_date/planned_end_date/delay_days, but the
// schema was renamed in a prior migration — see the plan file's Context
// section).
//
// Deviation from prompt.md: the projects table now carries two windows —
// dev_start_date/dev_end_date and support_start_date/support_end_date (see
// migration "Split project timeline into Development and Testing/Support
// phases") — and project_stages still ranks stages all the way through
// Testing/UAT/Client Review/Completed. A prior simplification measured every
// stage's completion_fraction against the dev window alone, which meant a
// project sitting in "Development" (0.55) for the entire dev window always
// read as increasingly delayed near dev_end_date, even though "Development"
// is the dev window's actual finish line — Testing onward is meant to land
// in the support window. Fixed by picking whichever window the current
// stage actually belongs to and rescaling completion_fraction to a 0-1
// progress ratio *within that window*, using the Development-stage fraction
// as the boundary between the two:
//   - stage fraction <= boundary  -> dev window; ratio = fraction / boundary
//   - stage fraction >  boundary  -> support window; ratio = (fraction - boundary) / (1 - boundary)
// so reaching "Development" at any point during the dev window is exactly
// on pace (ratio 1), and reaching "Completed" at any point during the
// support window is exactly on pace (ratio 1) too. Only ever runs on
// projects with actual_end_date IS NULL; projects_closure_status_chk would
// reject a status write on a closed project anyway, but this filters them
// out before ever trying.
type ProjectForDelay = {
  id: string;
  dev_start_date: string;
  dev_end_date: string;
  support_start_date: string;
  support_end_date: string;
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
  devBoundaryFraction: number,
  hasStaleClientBlocker: boolean,
  today: Date
): { status: string; delay_days: number } {
  const inDevPhase = completionFraction <= devBoundaryFraction;

  const start = new Date(inDevPhase ? project.dev_start_date : project.support_start_date);
  const plannedEnd = new Date(inDevPhase ? project.dev_end_date : project.support_end_date);

  // Progress ratio within whichever window applies: 0 at the start of the
  // phase, 1 once the phase's finish-line stage is reached.
  const phaseProgress = inDevPhase
    ? devBoundaryFraction > 0
      ? completionFraction / devBoundaryFraction
      : 1
    : devBoundaryFraction < 1
      ? (completionFraction - devBoundaryFraction) / (1 - devBoundaryFraction)
      : 1;
  const progressRatio = Math.min(1, Math.max(0, phaseProgress));

  // Step 1 — overdue check, factual, always applies.
  if (today > plannedEnd) {
    return { status: "Delayed", delay_days: daysBetween(plannedEnd, today) };
  }

  // Step 2 — in-flight projection.
  const totalPlannedDays = daysBetween(start, plannedEnd);
  const elapsedDays = daysBetween(start, today);
  const elapsedFraction = totalPlannedDays > 0 ? elapsedDays / totalPlannedDays : 1;

  let result: { status: string; delay_days: number };

  if (progressRatio >= elapsedFraction) {
    result = { status: "On Track", delay_days: 0 };
  } else {
    const projectedTotalDays = progressRatio > 0 ? elapsedDays / progressRatio : totalPlannedDays;
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
    .select(
      "id, dev_start_date, dev_end_date, support_start_date, support_end_date, stage, status, dev_delay_days"
    )
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

  // The Development-stage fraction is the boundary between the dev window
  // and the support window (see comment above computeForProject). If the
  // stage has been renamed away, fall back to 1 so every stage resolves to
  // the dev window — i.e. the pre-fix, single-window behaviour — rather
  // than guessing at a replacement fraction.
  const devBoundaryFraction = fractionByStage.get("Development") ?? 1;

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
      devBoundaryFraction,
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
