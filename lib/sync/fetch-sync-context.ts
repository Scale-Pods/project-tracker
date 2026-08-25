import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server-client";

// One batched read of everything Claude needs to do project matching, speaker
// resolution, and semantic dedup for a transcript — mirrors prompt.md
// Section 5 Step 1's single Supabase read. Only active projects
// (actual_end_date IS NULL) are included; closed projects never receive
// transcript-derived writes.
export type SyncContext = {
  projects: {
    id: string;
    client_name: string;
    project_name: string;
    scope: string;
    stage: string;
    status: string;
  }[];
  stages: {
    name: string;
    sort_order: number;
    completion_fraction: number;
    is_terminal: boolean;
  }[];
  roster: { project_id: string; name: string }[];
  openBlockers: {
    id: string;
    project_id: string;
    description: string;
    side: string;
    status: string;
    first_seen_date: string;
  }[];
  openTasks: {
    id: string;
    project_id: string;
    assignee_name: string;
    description: string;
    first_mentioned_date: string;
    due_date: string | null;
  }[];
};

export async function fetchSyncContext(): Promise<SyncContext> {
  const supabase = createServiceRoleClient();

  const [projectsRes, stagesRes, rosterRes, blockersRes, tasksRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, client_name, project_name, scope, stage, status")
      .is("actual_end_date", null),
    supabase
      .from("project_stages")
      .select("name, sort_order, completion_fraction, is_terminal")
      .order("sort_order"),
    supabase.from("project_assignees").select("project_id, name"),
    supabase
      .from("blockers")
      .select("id, project_id, description, side, status, first_seen_date")
      .neq("status", "resolved"),
    supabase
      .from("pending_tasks")
      .select("id, project_id, assignee_name, description, first_mentioned_date, due_date")
      .eq("status", "open"),
  ]);

  for (const res of [projectsRes, stagesRes, rosterRes, blockersRes, tasksRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    projects: projectsRes.data ?? [],
    stages: stagesRes.data ?? [],
    roster: rosterRes.data ?? [],
    openBlockers: blockersRes.data ?? [],
    openTasks: tasksRes.data ?? [],
  };
}
