import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProjectNotFound() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <EmptyState
        title="Project not found"
        description="This project may have been removed, or the link might be incorrect."
        action={
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)]"
          >
            <span aria-hidden="true">←</span> Back to projects
          </Link>
        }
      />
    </div>
  );
}
