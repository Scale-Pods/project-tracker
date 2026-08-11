// Hand-written types matching Supabase_Schema_Design.md. Only the tables this
// dashboard touches are modeled here (projects, project_assignees, remarks_log).

export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type Priority = "High" | "Medium" | "Low";
export type PayoutRole = "Owner" | "Support";

// A project onboards with two separate timelines: build the thing
// ("development"), then keep it running / verify it with the client
// ("testing_support"). Blockers and pending tasks are tagged with whichever
// phase they were raised in, so delay/progress can be computed against the
// timeline that's actually relevant to them.
export type ProjectPhase = "development" | "testing_support";

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  development: "Development",
  testing_support: "Testing/Support",
};

export const CANONICAL_STAGES = [
  "Onboarding",
  "In Progress",
  "Client Review",
  "On Hold",
  "Completed",
] as const;

export type Project = {
  id: string;
  client_name: string;
  project_name: string;
  scope: string;
  priority: string;
  status: string;
  stage: string;
  dev_start_date: string;
  dev_end_date: string;
  support_start_date: string;
  support_end_date: string;
  actual_end_date: string | null;
  notes: string | null;
  project_value: number;
  client_rating: number | null;
  dev_delay_days: number;
  support_delay_days: number;
  awaiting_closure_data: boolean;
  unverified: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectAssignee = {
  id: string;
  project_id: string;
  name: string;
  role: string;
  payout_role: string;
  testimonial_received: boolean;
  added_at: string;
};

export type RemarksLogEntry = {
  id: string;
  project_id: string;
  source: "manual_onboarding" | "fireflies";
  summary: string;
  unverified: boolean;
  source_meeting_id: string | null;
  created_at: string;
};

export type Blocker = {
  id: string;
  project_id: string;
  description: string;
  side: string;
  status: string;
  unverified: boolean;
  phase: string;
  first_seen_date: string;
  last_mentioned_date: string;
  resolved_date: string | null;
  source_meeting_id: string | null;
};

export type PendingTask = {
  id: string;
  project_id: string;
  assignee_name: string;
  description: string;
  status: string;
  unverified: boolean;
  phase: string;
  first_mentioned_date: string;
  last_mentioned_date: string;
  completed_date: string | null;
  due_date: string | null;
  source_meeting_id: string | null;
};

export type Milestone = {
  id: string;
  project_id: string;
  name: string;
  status: string;
  updated_at: string;
};

// A project row plus the lightweight assignee-name join used on the list page.
export type ProjectWithAssignees = Project & {
  assignees: Pick<ProjectAssignee, "id" | "name">[];
};

// Team bandwidth model: each person is meant to be payout_role "Owner" (lead)
// on exactly 1 active project and "Support" (member) on exactly 2. Deviating
// either direction is a workload signal, computed in lib/format.ts.
export type BandwidthStatus = "overloaded" | "balanced" | "light";

export type WorkloadProjectRef = Pick<Project, "id" | "project_name" | "client_name" | "status">;

export type TeamMemberWorkload = {
  name: string;
  leadProjects: WorkloadProjectRef[];
  memberProjects: WorkloadProjectRef[];
  bandwidth: BandwidthStatus;
};

// Saturday-off eligibility, aggregated across every project a person is on
// (not scoped to a single project) — someone is only eligible once nothing
// they own is left open anywhere as of this week's Friday close.
export type MemberSaturdayOff = {
  name: string;
  eligible: boolean;
  openCount: number;
  saturdayDate: string;
  openProjects: Pick<Project, "id" | "project_name">[];
  // What they actually cleared this week, across every project — the "why"
  // behind an eligible verdict.
  completedThisWeek: { id: string; description: string; projectName: string }[];
};

// Everything the detail page needs for one project, fetched in parallel.
export type ProjectDetail = {
  project: Project;
  assignees: ProjectAssignee[];
  blockers: Blocker[];
  pendingTasks: PendingTask[];
  milestones: Milestone[];
  remarks: RemarksLogEntry[];
};

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Partial<Project> &
          Pick<
            Project,
            | "client_name"
            | "project_name"
            | "scope"
            | "priority"
            | "dev_start_date"
            | "dev_end_date"
            | "support_start_date"
            | "support_end_date"
            | "project_value"
          >;
        Update: Partial<Project>;
        Relationships: [];
      };
      project_assignees: {
        Row: ProjectAssignee;
        Insert: Partial<ProjectAssignee> &
          Pick<ProjectAssignee, "project_id" | "name" | "role" | "payout_role">;
        Update: Partial<ProjectAssignee>;
        Relationships: [];
      };
      remarks_log: {
        Row: RemarksLogEntry;
        Insert: Partial<RemarksLogEntry> &
          Pick<RemarksLogEntry, "project_id" | "source" | "summary">;
        Update: Partial<RemarksLogEntry>;
        Relationships: [];
      };
      blockers: {
        Row: Blocker;
        Insert: Partial<Blocker> & Pick<Blocker, "project_id" | "description" | "side" | "status">;
        Update: Partial<Blocker>;
        Relationships: [];
      };
      pending_tasks: {
        Row: PendingTask;
        Insert: Partial<PendingTask> &
          Pick<PendingTask, "project_id" | "assignee_name" | "description" | "status">;
        Update: Partial<PendingTask>;
        Relationships: [];
      };
      milestones: {
        Row: Milestone;
        Insert: Partial<Milestone> & Pick<Milestone, "project_id" | "name" | "status">;
        Update: Partial<Milestone>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
