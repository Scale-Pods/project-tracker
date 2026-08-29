import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import {
  computeBandwidthStatus,
  computeSaturdayOff,
  filterCompletedThisWeek,
  filterOpenAsOfFriday,
  resolveTimelineWindow,
  toDateKey,
} from "@/lib/format";
import { computeCurrentProgress, fetchProjectMeetingDates } from "@/lib/progress/current";
import { isQuietlySettled } from "@/lib/staleness";
import type {
  BandwidthStatus,
  MemberSaturdayOff,
  ProjectDetail,
  ProjectWithAssignees,
  TeamMemberWorkload,
  WorkloadProjectRef,
} from "@/lib/types";

// The Development-stage completion_fraction is the boundary between the dev
// window and the support window for resolveTimelineWindow (lib/format.ts) —
// same boundary recompute-delay.ts uses for the delay/status computation.
// Falls back to 1 (every stage resolves to the dev window) if the stage has
// been renamed away, rather than guessing at a replacement fraction.
async function getStageFractions(
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<{ fractionByStage: Map<string, number>; devBoundaryFraction: number }> {
  const { data, error } = await supabase.from("project_stages").select("name, completion_fraction");
  if (error) throw new Error(error.message);

  const fractionByStage = new Map((data ?? []).map((s) => [s.name, Number(s.completion_fraction)]));
  const devBoundaryFraction = fractionByStage.get("Development") ?? 1;
  return { fractionByStage, devBoundaryFraction };
}

export async function getProjectsWithAssignees(): Promise<ProjectWithAssignees[]> {
  const supabase = createServiceRoleClient();

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const [assigneesRes, snapshotsRes, stageFractions] = await Promise.all([
    supabase.from("project_assignees").select("id, project_id, name").in("project_id", projectIds),
    supabase
      .from("progress_snapshots")
      .select("project_id, dpi, low_signal, as_of_date")
      .in("project_id", projectIds)
      .order("as_of_date", { ascending: false }),
    getStageFractions(supabase),
  ]);

  if (assigneesRes.error) {
    throw new Error(assigneesRes.error.message);
  }
  if (snapshotsRes.error) {
    throw new Error(snapshotsRes.error.message);
  }

  const assigneesByProject = new Map<string, { id: string; name: string }[]>();
  for (const a of assigneesRes.data ?? []) {
    const list = assigneesByProject.get(a.project_id) ?? [];
    list.push({ id: a.id, name: a.name });
    assigneesByProject.set(a.project_id, list);
  }

  // Rows come newest-first, so the first seen per project is the latest.
  const latestDpiByProject = new Map<string, number | null>();
  for (const s of snapshotsRes.data ?? []) {
    if (latestDpiByProject.has(s.project_id)) continue;
    latestDpiByProject.set(s.project_id, s.low_signal ? null : Number(s.dpi));
  }

  const { fractionByStage, devBoundaryFraction } = stageFractions;

  return projects.map((p) => ({
    ...p,
    assignees: assigneesByProject.get(p.id) ?? [],
    developmentProgress: latestDpiByProject.get(p.id) ?? null,
    timelineWindow: resolveTimelineWindow(
      p,
      fractionByStage.get(p.stage) ?? devBoundaryFraction,
      devBoundaryFraction
    ),
  }));
}

// Team-level bandwidth: each person is grouped across every ACTIVE project
// they're on (payout_role "Owner" = lead, "Support" = member), against the
// allocation model of 1 lead + 2 member projects per person. A project with
// status "Completed" or a set actual_end_date no longer counts toward
// someone's *current* workload, so those are excluded here.
export async function getTeamWorkload(): Promise<TeamMemberWorkload[]> {
  const supabase = createServiceRoleClient();

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_name, client_name, status, actual_end_date");

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  const { data: assignees, error: assigneesError } = await supabase
    .from("project_assignees")
    .select("name, payout_role, project_id");

  if (assigneesError) {
    throw new Error(assigneesError.message);
  }

  const activeProjects = new Map(
    (projects ?? [])
      .filter((p) => p.status !== "Completed" && !p.actual_end_date)
      .map((p) => [p.id, p] as const)
  );

  const byName = new Map<string, TeamMemberWorkload>();

  for (const a of assignees ?? []) {
    const project = activeProjects.get(a.project_id);
    if (!project) continue;

    const entry: TeamMemberWorkload =
      byName.get(a.name) ?? {
        name: a.name,
        leadProjects: [],
        memberProjects: [],
        bandwidth: "light",
      };

    const ref: WorkloadProjectRef = {
      id: project.id,
      project_name: project.project_name,
      client_name: project.client_name,
      status: project.status,
    };

    if (a.payout_role === "Owner") {
      entry.leadProjects.push(ref);
    } else {
      entry.memberProjects.push(ref);
    }

    byName.set(a.name, entry);
  }

  const rank: Record<BandwidthStatus, number> = { overloaded: 0, balanced: 1, light: 2 };

  return Array.from(byName.values())
    .map((m) => ({
      ...m,
      bandwidth: computeBandwidthStatus(m.leadProjects.length, m.memberProjects.length),
    }))
    .sort((a, b) => rank[a.bandwidth] - rank[b.bandwidth] || a.name.localeCompare(b.name));
}

// Saturday-off eligibility, aggregated across every project each person is
// on (not just one project's card): a person is eligible only once nothing
// they own is left open anywhere, as of this week's Friday close. Roster
// comes from project_assignees (so someone with zero tasks ever still shows
// up, correctly eligible), matched against pending_tasks.assignee_name.
export async function getTeamSaturdayOff(): Promise<MemberSaturdayOff[]> {
  const supabase = createServiceRoleClient();

  const [assigneesRes, tasksRes, projectsRes] = await Promise.all([
    supabase.from("project_assignees").select("name"),
    supabase
      .from("pending_tasks")
      .select("id, assignee_name, description, status, first_mentioned_date, completed_date, project_id"),
    supabase.from("projects").select("id, project_name"),
  ]);

  if (assigneesRes.error) throw new Error(assigneesRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);

  const projectNameById = new Map((projectsRes.data ?? []).map((p) => [p.id, p.project_name] as const));

  const tasksByName = new Map<string, NonNullable<typeof tasksRes.data>>();
  for (const t of tasksRes.data ?? []) {
    const list = tasksByName.get(t.assignee_name) ?? [];
    list.push(t);
    tasksByName.set(t.assignee_name, list);
  }

  const names = new Set((assigneesRes.data ?? []).map((a) => a.name));

  const members: MemberSaturdayOff[] = Array.from(names).map((name) => {
    const memberTasks = tasksByName.get(name) ?? [];
    const openTasks = filterOpenAsOfFriday(memberTasks);
    const completedTasks = filterCompletedThisWeek(memberTasks);
    const { saturday } = computeSaturdayOff(memberTasks);
    const openProjectIds = Array.from(new Set(openTasks.map((t) => t.project_id)));

    return {
      name,
      eligible: openTasks.length === 0,
      openCount: openTasks.length,
      saturdayDate: toDateKey(saturday),
      openProjects: openProjectIds.map((id) => ({
        id,
        project_name: projectNameById.get(id) ?? "Unknown project",
      })),
      completedThisWeek: completedTasks.map((t) => ({
        id: t.id,
        description: t.description,
        projectName: projectNameById.get(t.project_id) ?? "Unknown project",
      })),
    };
  });

  // People still owing work surface first, so the ones who need a nudge are visible immediately.
  members.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return members;
}

// Full read-only state for one project, per Section 11.5's "one project's full
// state in parallel" query set. Returns null when the id doesn't resolve to a
// row (distinct from a thrown error, which means the fetch itself failed).
export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const supabase = createServiceRoleClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project) return null;

  const [assigneesRes, blockersRes, tasksRes, milestonesRes, remarksRes, snapshotsRes, stageFractions] =
    await Promise.all([
      supabase.from("project_assignees").select("*").eq("project_id", id).order("added_at"),
      supabase
        .from("blockers")
        .select("*")
        .eq("project_id", id)
        .order("last_mentioned_date", { ascending: false }),
      supabase
        .from("pending_tasks")
        .select("*")
        .eq("project_id", id)
        .order("last_mentioned_date", { ascending: false }),
      supabase.from("milestones").select("*").eq("project_id", id).order("updated_at"),
      supabase
        .from("remarks_log")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("progress_snapshots")
        .select("*")
        .eq("project_id", id)
        .order("as_of_date", { ascending: true }),
      getStageFractions(supabase),
    ]);

  for (const res of [assigneesRes, blockersRes, tasksRes, milestonesRes, remarksRes, snapshotsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const { fractionByStage, devBoundaryFraction } = stageFractions;
  const allBlockers = blockersRes.data ?? [];
  const allTasks = tasksRes.data ?? [];
  const allRemarks = remarksRes.data ?? [];
  const milestones = milestonesRes.data ?? [];

  const meetingDates = await fetchProjectMeetingDates(id);

  // DPI runs on the FULL history — its own stale logic scores untouched tasks as
  // resolved, so the number and the (filtered) list below stay in agreement.
  const currentProgress = await computeCurrentProgress({
    projectId: id,
    stage: project.stage,
    fractionByStage,
    devBoundaryFraction,
    milestones,
    tasks: allTasks,
    blockers: allBlockers,
    meetingDates,
  });

  // Quietly drop open items and old activity that has gone undiscussed for
  // QUIET_SETTLE_DAYS while the project kept meeting — presumed done/resolved
  // or no longer current. Explicitly done/resolved items, and the onboarding
  // note, are never hidden this way. The page shows no trace of the omission.
  const nowKey = toDateKey(new Date());
  const settled = (lastMentioned: string) =>
    isQuietlySettled(lastMentioned, meetingDates, nowKey);

  const blockers = allBlockers.filter(
    (b) => b.status.toLowerCase() === "resolved" || !settled(b.last_mentioned_date)
  );
  const pendingTasks = allTasks.filter(
    (t) => t.status.toLowerCase() === "done" || !settled(t.last_mentioned_date)
  );
  const remarks = allRemarks.filter(
    (r) => r.source === "manual_onboarding" || !settled(toDateKey(new Date(r.created_at)))
  );

  return {
    project,
    assignees: assigneesRes.data ?? [],
    blockers,
    pendingTasks,
    milestones,
    remarks,
    timelineWindow: resolveTimelineWindow(
      project,
      fractionByStage.get(project.stage) ?? devBoundaryFraction,
      devBoundaryFraction
    ),
    progress: {
      current: currentProgress,
      series: snapshotsRes.data ?? [],
    },
  };
}
