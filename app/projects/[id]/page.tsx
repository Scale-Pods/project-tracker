import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectDetail } from "@/lib/queries";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectSummarySection } from "@/components/projects/ProjectSummarySection";
import { ShimmerBlock } from "@/components/ui/Skeleton";
import { ProgressOverview } from "@/components/projects/ProgressOverview";
import { TeamSection } from "@/components/projects/TeamSection";
import { BlockersSection } from "@/components/projects/BlockersSection";
import { PendingTasksSection } from "@/components/projects/PendingTasksSection";
import { ActivityLog } from "@/components/projects/ActivityLog";
import { ClosurePanel } from "@/components/projects/ClosurePanel";
import { PayoutBreakdownSection } from "@/components/projects/PayoutBreakdownSection";
import { SectionNav } from "@/components/projects/SectionNav";
import { DetailErrorBanner } from "@/components/projects/DetailErrorBanner";

// Automation writes to this project's child tables outside of any user
// click, so the detail page must reflect the live database on every request.
export const dynamic = "force-dynamic";

// The summary is the one part of this page waiting on a non-Supabase network
// call (Gemini), so it streams in its own Suspense boundary rather than
// blocking the rest of the already-fetched page.
function ProjectSummarySkeleton() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <ShimmerBlock className="h-3.5 w-full" />
      <ShimmerBlock className="mt-2 h-3.5 w-11/12" />
      <ShimmerBlock className="mt-2 h-3.5 w-2/3" />
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail;
  try {
    detail = await getProjectDetail(id);
  } catch (err) {
    const message =
      err instanceof Error ? `Couldn't load this project: ${err.message}` : "Couldn't load this project.";
    return <DetailErrorBanner message={message} />;
  }

  if (!detail) notFound();

  const { project, assignees, blockers, pendingTasks, milestones, remarks } = detail;

  const hasUnverified =
    project.unverified ||
    blockers.some((b) => b.unverified) ||
    pendingTasks.some((t) => t.unverified) ||
    remarks.some((r) => r.unverified);

  const showPayout = Boolean(project.actual_end_date) && project.client_rating !== null;

  // Closure section always shown so any project can be manually closed from the UI.
  // SectionNav "Closure" link also always shown.
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <SectionNav showClosure={true} showPayout={showPayout} />

        <div className="min-w-0 space-y-10">
          <ProjectHeader project={project} assignees={assignees} />
          <Suspense fallback={<ProjectSummarySkeleton />}>
            <ProjectSummarySection
              project={project}
              blockers={blockers}
              pendingTasks={pendingTasks}
              milestones={milestones}
              remarks={remarks}
            />
          </Suspense>
          <ProgressOverview project={project} milestones={milestones} pendingTasks={pendingTasks} />
          <TeamSection assignees={assignees} />
          <BlockersSection blockers={blockers} />
          <PendingTasksSection tasks={pendingTasks} />
          <ActivityLog remarks={remarks} />
          <ClosurePanel project={project} assignees={assignees} />
          {showPayout && <PayoutBreakdownSection project={project} assignees={assignees} />}

          <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle pt-8 text-sm">
            {hasUnverified && (
              <Link
                href={`/review-queue?project=${project.id}`}
                className="text-text-secondary transition-colors hover:text-accent-primary"
              >
                Review unverified updates →
              </Link>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
