import { getProjectsWithAssignees, getTeamSaturdayOff, getTeamWorkload } from "@/lib/queries";
import { ProjectsExplorer } from "@/components/projects/ProjectsExplorer";
import type { MemberSaturdayOff, ProjectWithAssignees, TeamMemberWorkload } from "@/lib/types";

// Automation writes to these tables continuously outside of any user click,
// so the list must reflect the live database on every request, not a cached copy.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects: ProjectWithAssignees[] = [];
  let error: string | undefined;
  let teamWorkload: TeamMemberWorkload[] = [];
  let saturdayOff: MemberSaturdayOff[] = [];

  try {
    projects = await getProjectsWithAssignees();
  } catch (err) {
    error =
      err instanceof Error
        ? `Couldn't load projects: ${err.message}`
        : "Couldn't load projects. Please try again.";
  }

  // Bandwidth and Saturday-off are secondary, best-effort surfaces: a
  // failure in either shouldn't block the primary project list from rendering.
  try {
    teamWorkload = await getTeamWorkload();
  } catch {
    teamWorkload = [];
  }

  try {
    saturdayOff = await getTeamSaturdayOff();
  } catch {
    saturdayOff = [];
  }

  return (
    <ProjectsExplorer
      initialProjects={projects}
      initialError={error}
      teamWorkload={teamWorkload}
      saturdayOff={saturdayOff}
    />
  );
}
