import { ProjectsGridSkeleton } from "@/components/ui/Skeleton";

export default function ProjectsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">Loading your projects…</p>
          </div>
        </div>
      </div>

      <ProjectsGridSkeleton />
    </div>
  );
}
