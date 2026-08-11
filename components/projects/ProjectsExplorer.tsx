"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { AddProjectModal } from "@/components/projects/AddProjectModal";
import { TeamBandwidthModal } from "@/components/projects/TeamBandwidthModal";
import { SaturdayOffModal } from "@/components/projects/SaturdayOffModal";
import { FilterDropdown } from "@/components/projects/FilterDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { PRIORITY_OPTIONS } from "@/lib/validation";
import {
  CANONICAL_STAGES,
  type MemberSaturdayOff,
  type ProjectWithAssignees,
  type TeamMemberWorkload,
} from "@/lib/types";

const STATUS_OPTIONS = ["On Track", "At Risk", "Delayed"];

type SortOption = "updated_at" | "support_end_date" | "project_value";

const SORT_LABELS: Record<SortOption, string> = {
  updated_at: "Last updated",
  support_end_date: "Soonest deadline",
  project_value: "Highest value",
};

export function ProjectsExplorer({
  initialProjects,
  initialError,
  teamWorkload,
  saturdayOff,
}: {
  initialProjects: ProjectWithAssignees[];
  initialError?: string;
  teamWorkload: TeamMemberWorkload[];
  saturdayOff: MemberSaturdayOff[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("updated_at");
  const [modalOpen, setModalOpen] = useState(false);
  const [bandwidthModalOpen, setBandwidthModalOpen] = useState(false);
  const [saturdayOffModalOpen, setSaturdayOffModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const stageOptions = useMemo(() => {
    const set = new Set<string>(CANONICAL_STAGES);
    projects.forEach((p) => set.add(p.stage));
    return Array.from(set);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (
        q &&
        !p.project_name.toLowerCase().includes(q) &&
        !p.client_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter.length && !statusFilter.includes(p.status)) return false;
      if (priorityFilter.length && !priorityFilter.includes(p.priority)) return false;
      if (stageFilter.length && !stageFilter.includes(p.stage)) return false;
      return true;
    });
  }, [projects, search, statusFilter, priorityFilter, stageFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === "support_end_date") {
      copy.sort(
        (a, b) => new Date(a.support_end_date).getTime() - new Date(b.support_end_date).getTime()
      );
    } else if (sort === "project_value") {
      copy.sort((a, b) => b.project_value - a.project_value);
    } else {
      copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return copy;
  }, [filtered, sort]);

  function pushToast(tone: ToastMessage["tone"], message: string) {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function handleAddSuccess(project: ProjectWithAssignees) {
    setProjects((prev) => [project, ...prev]);
    pushToast("success", "Project added");
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter([]);
    setPriorityFilter([]);
    setStageFilter([]);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 sm:px-10">
      <ToastStack toasts={toasts} />

      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">Projects</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {projects.length} project{projects.length === 1 ? "" : "s"} tracked automatically
              from meetings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSaturdayOffModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/40"
            >
              Saturday eligibility
            </button>
            <button
              type="button"
              onClick={() => setBandwidthModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/40"
            >
              Team bandwidth
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)]"
            >
              <span aria-hidden="true">+</span> Add project
            </button>
          </div>
        </div>

        {initialError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-status-bad/30 bg-status-bad/10 px-4 py-3 text-sm text-status-bad">
            <span>{initialError}</span>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="shrink-0 rounded-lg border border-status-bad/40 px-3 py-1.5 text-xs font-medium hover:bg-status-bad/15"
            >
              Retry
            </button>
          </div>
        )}

        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or project…"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
              />
            </div>

            <FilterDropdown
              label="Status"
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterDropdown
              label="Priority"
              options={[...PRIORITY_OPTIONS]}
              selected={priorityFilter}
              onChange={setPriorityFilter}
            />
            <FilterDropdown
              label="Stage"
              options={stageOptions}
              selected={stageFilter}
              onChange={setStageFilter}
            />

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="glass-input rounded-xl px-3.5 py-2.5 text-sm text-text-primary cursor-pointer focus:outline-none"
              aria-label="Sort projects"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <option key={key} value={key} className="bg-[#0c0c3a] text-text-primary">
                  Sort: {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Add your first project"
          description="Every project the team tracks — status, blockers, tasks, and history — starts here. Add one to see it come alive on the dashboard."
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(22,22,172,0.6)]"
            >
              <span aria-hidden="true">+</span> Add project
            </button>
          }
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No projects match these filters"
          description="Try adjusting or clearing your search and filters."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary/40"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
            />
          ))}
        </div>
      )}

      <AddProjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleAddSuccess}
      />

      <TeamBandwidthModal
        open={bandwidthModalOpen}
        onOpenChange={setBandwidthModalOpen}
        workload={teamWorkload}
      />

      <SaturdayOffModal
        open={saturdayOffModalOpen}
        onOpenChange={setSaturdayOffModalOpen}
        members={saturdayOff}
      />
    </div>
  );
}
