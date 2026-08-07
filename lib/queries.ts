import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";
import {
  computeBandwidthStatus,
  computeSaturdayOff,
  filterCompletedThisWeek,
  filterOpenAsOfFriday,
  toDateKey,
} from "@/lib/format";
import type {
  BandwidthStatus,
  MemberSaturdayOff,
  ProjectDetail,
  ProjectWithAssignees,
  TeamMemberWorkload,
  WorkloadProjectRef,
} from "@/lib/types";

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

  const { data: assignees, error: assigneesError } = await supabase
    .from("project_assignees")
    .select("id, project_id, name")
    .in(
      "project_id",
      projects.map((p) => p.id)
    );

  if (assigneesError) {
    throw new Error(assigneesError.message);
  }

  const assigneesByProject = new Map<string, { id: string; name: string }[]>();
  for (const a of assignees ?? []) {
    const list = assigneesByProject.get(a.project_id) ?? [];
    list.push({ id: a.id, name: a.name });
    assigneesByProject.set(a.project_id, list);
  }

  return projects.map((p) => ({
    ...p,
    assignees: assigneesByProject.get(p.id) ?? [],
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

  const [assigneesRes, blockersRes, tasksRes, milestonesRes, remarksRes] = await Promise.all([
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
  ]);

  for (const res of [assigneesRes, blockersRes, tasksRes, milestonesRes, remarksRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    project,
    assignees: assigneesRes.data ?? [],
    blockers: blockersRes.data ?? [],
    pendingTasks: tasksRes.data ?? [],
    milestones: milestonesRes.data ?? [],
    remarks: remarksRes.data ?? [],
  };
}
