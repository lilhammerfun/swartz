import {
  getLibrary,
  getProjectDetail,
} from "../features/projects/project-service.ts";
import { projectBook } from "../features/projects/project-data.ts";

// Workspace routes use project IDs; a standalone book is not a project.
export async function loadWorkspaceBook(projectId: string) {
  const library = await getLibrary();
  const project = library.projects.find((item) => item.id === projectId);
  if (!project) throw new Response("Project not found", { status: 404 });
  return { book: projectBook(project, await getProjectDetail(projectId)) };
}
