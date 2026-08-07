import "server-only";
import { unstable_cache } from "next/cache";
import { generateText } from "@/lib/ai/gemini-client";
import { daysBetween, toDateKey } from "@/lib/format";
import type { Blocker, Milestone, PendingTask, Project, RemarksLogEntry } from "@/lib/types";

type SummaryInput = {
  project: Project;
  blockers: Blocker[];
  pendingTasks: PendingTask[];
  milestones: Milestone[];
  remarks: RemarksLogEntry[];
};

export type SummaryResult = { ok: true; summary: string } | { ok: false; message: string };

function buildSummaryPrompt({ project, blockers, pendingTasks, milestones, remarks }: SummaryInput): string {
  const today = toDateKey(new Date());
  const openBlockers = blockers.filter((b) => b.status.toLowerCase() !== "resolved");
  const openTasks = pendingTasks.filter((t) => t.status.toLowerCase() !== "done");
  const doneMilestones = milestones.filter((m) => m.status.toLowerCase() === "done").length;

  const blockerLines = openBlockers.length
    ? openBlockers
        .map(
          (b) =>
            `- (${b.side}, open ${daysBetween(b.first_seen_date, today)}d) ${b.description}`
        )
        .join("\n")
    : "None.";

  const taskLines = openTasks.length
    ? openTasks.map((t) => `- ${t.assignee_name}: ${t.description}`).join("\n")
    : "None.";

  const recentActivity = remarks.length
    ? remarks
        .slice(0, 5)
        .map((r) => `- ${r.summary}`)
        .join("\n")
    : "None recorded.";

  return `You are writing a status summary for an internal project-tracking dashboard. Using ONLY the facts listed below, write a highly professional, well-structured, accurate, task-level summary of this project in 100 words or fewer. Cover ongoing activity, open blockers, and open pending tasks. Do not invent any detail not present below. Do not use markdown formatting. Return only the summary paragraph, nothing else.

Project: ${project.project_name} (client: ${project.client_name})
Status: ${project.status} | Stage: ${project.stage} | Delay: ${project.delay_days} day(s)
Milestones: ${doneMilestones}/${milestones.length} done

Open blockers:
${blockerLines}

Open pending tasks:
${taskLines}

Recent activity (most recent first):
${recentActivity}`;
}

const cachedGenerateSummary = unstable_cache(
  (prompt: string) => generateText(prompt),
  ["project-summary"],
  { revalidate: 3600 }
);

// Cache key is the prompt itself, which is a deterministic function of every
// input below — so a completed task, a new blocker, etc. changes the prompt
// text and busts the cache immediately, without a separate fingerprint to
// keep in sync. The 1-hour revalidate is just a safety-net ceiling.
export async function getProjectSummary(input: SummaryInput): Promise<SummaryResult> {
  const prompt = buildSummaryPrompt(input);

  try {
    const summary = await cachedGenerateSummary(prompt);
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating summary.";
    return { ok: false, message };
  }
}
