"use client";

import { useState } from "react";
import { EditProjectModal } from "@/components/projects/EditProjectModal";
import type { Project, ProjectAssignee } from "@/lib/types";

export function EditProjectButton({
  project,
  assignees,
}: {
  project: Project;
  assignees: ProjectAssignee[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-input inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:text-text-primary"
      >
        Edit project
      </button>

      {open && (
        <EditProjectModal open={open} onOpenChange={setOpen} project={project} assignees={assignees} />
      )}
    </>
  );
}
