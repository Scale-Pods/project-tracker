// Hand-written types matching Supabase_Schema_Design.md, covering both the
// tables the dashboard reads and the ones the Fireflies sync pipeline
// (lib/sync/**) writes to.

export type ProjectStatus = "On Track" | "At Risk" | "Delayed";
export type Priority = "High" | "Medium" | "Low";
export type PayoutRole = "Owner" | "Support";

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

export type ProjectStage = {
  name: string;
  sort_order: number;
  completion_fraction: number;
  is_terminal: boolean;
};

export type PendingReviewQueueEntry = {
  id: string;
  project_id: string;
  field_name: string;
  proposed_value: string | null;
  confidence: number | null;
  source_meeting_id: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type NeedsRegistrationQueueEntry = {
  id: string;
  fireflies_transcript_id: string;
  meeting_title: string | null;
  attendees: string[] | null;
  raw_snippet: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolved_project_id: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ProcessedTranscript = {
  id: string;
  fireflies_transcript_id: string;
  processed_at: string;
  meeting_date: string | null;
  meeting_title: string | null;
};

export type AuditLogEntry = {
  id: string;
  project_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  source: "onboarding" | "fireflies" | "delay_computation" | "payout_engine" | "human_review";
  source_meeting_id: string | null;
  confidence: number | null;
  changed_at: string;
};

export type SyncRunStatus = "success" | "failed" | "skipped_duplicate" | "no_confident_match";
export type SyncRunTrigger = "webhook" | "cron";

export type SyncRun = {
  id: string;
  fireflies_transcript_id: string;
  trigger: SyncRunTrigger;
  status: SyncRunStatus;
  error_message: string | null;
  llm_raw_response: string | null;
  started_at: string;
  finished_at: string | null;
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
      project_stages: {
        Row: ProjectStage;
        Insert: ProjectStage;
        Update: Partial<ProjectStage>;
        Relationships: [];
      };
      pending_review_queue: {
        Row: PendingReviewQueueEntry;
        Insert: Partial<PendingReviewQueueEntry> &
          Pick<PendingReviewQueueEntry, "project_id" | "field_name">;
        Update: Partial<PendingReviewQueueEntry>;
        Relationships: [];
      };
      needs_registration_queue: {
        Row: NeedsRegistrationQueueEntry;
        Insert: Partial<NeedsRegistrationQueueEntry> & Pick<NeedsRegistrationQueueEntry, "fireflies_transcript_id">;
        Update: Partial<NeedsRegistrationQueueEntry>;
        Relationships: [];
      };
      processed_transcripts: {
        Row: ProcessedTranscript;
        Insert: Partial<ProcessedTranscript> & Pick<ProcessedTranscript, "fireflies_transcript_id">;
        Update: Partial<ProcessedTranscript>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: Partial<AuditLogEntry> &
          Pick<AuditLogEntry, "project_id" | "field_changed" | "source">;
        Update: Partial<AuditLogEntry>;
        Relationships: [];
      };
      sync_runs: {
        Row: SyncRun;
        Insert: Partial<SyncRun> & Pick<SyncRun, "fireflies_transcript_id" | "trigger" | "status">;
        Update: Partial<SyncRun>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_transcript_segment: {
        Args: {
          p_project_id: string;
          p_writes: Record<string, unknown>;
          p_transcript_id: string;
          p_meeting_date: string;
          p_meeting_title: string;
          p_is_last_segment: boolean;
        };
        Returns: Record<string, unknown>;
      };
      log_unmatched_meeting: {
        Args: {
          p_transcript_id: string;
          p_meeting_date: string;
          p_meeting_title: string;
          p_attendees: string[];
          p_raw_snippet: string;
        };
        Returns: undefined;
      };
    };
  };
};
