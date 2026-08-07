export function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-surface-card bg-[linear-gradient(100deg,transparent_35%,rgba(20,20,74,0.9)_50%,transparent_65%)] bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-5 w-3/4" />
          <ShimmerBlock className="h-3.5 w-1/2" />
        </div>
        <ShimmerBlock className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-4 flex gap-2">
        <ShimmerBlock className="h-6 w-16 rounded-full" />
        <ShimmerBlock className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-5 space-y-2">
        <ShimmerBlock className="h-3 w-full" />
        <ShimmerBlock className="h-1.5 w-full rounded-full" />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <ShimmerBlock className="h-4 w-24" />
        <div className="flex -space-x-2">
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-7 w-7 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <div className="hidden space-y-4 border-l border-border-subtle pl-4 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-3.5 w-24" />
          ))}
        </div>

        <div className="min-w-0 space-y-10">
          <div className="space-y-5 rounded-3xl border border-border-subtle bg-surface-card/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-8">
            <ShimmerBlock className="h-3.5 w-28" />
            <ShimmerBlock className="h-9 w-2/3" />
            <ShimmerBlock className="h-4 w-1/3" />
            <div className="flex gap-2">
              <ShimmerBlock className="h-6 w-20 rounded-full" />
              <ShimmerBlock className="h-6 w-20 rounded-full" />
              <ShimmerBlock className="h-6 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <ShimmerBlock className="h-3 w-16" />
                  <ShimmerBlock className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>

          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <ShimmerBlock className="h-6 w-40" />
              <ShimmerBlock className="h-28 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
