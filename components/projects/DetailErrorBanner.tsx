"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Mirrors the list page's inline retry banner (Section 9.10): a fetch
// failure gets a retry action, not a blank generic error page.
export function DetailErrorBanner({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-3 rounded-xl border border-status-bad/30 bg-status-bad/10 px-4 py-3 text-sm text-status-bad sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-status-bad/40 px-3 py-1.5 text-xs font-medium hover:bg-status-bad/15"
          >
            Retry
          </button>
          <Link
            href="/projects"
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:border-accent-primary/40"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
