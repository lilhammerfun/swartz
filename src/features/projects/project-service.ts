import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectDetail,
  LibrarySnapshot,
  LibraryChange,
} from "./project-data";

const PREVIEW_KEY = "swartz.library-preview.v1";

export async function getLibrary(): Promise<LibrarySnapshot> {
  if (isTauri()) return invoke("get_library");
  const details = await previewProjects();
  const fixture = await previewFixture();
  const { mergePreviewLibrary } =
    await import("../../mock-data/library-preview");
  const saved = localStorage.getItem(PREVIEW_KEY);
  const library = mergePreviewLibrary(saved ? JSON.parse(saved) : null, {
    fixtureRevision: fixture.revision,
    sections: fixture.sections,
    projects: details.map((detail) => detail.project),
  });
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(library));
  return library;
}

export async function updateLibrary(
  change: LibraryChange,
): Promise<LibrarySnapshot> {
  if (isTauri()) return invoke("update_library", { change });
  const library = await getLibrary();
  // Browser previews also persist organization changes; Rust handles actual desktop writes.
  switch (change.kind) {
    case "create_section":
      library.sections.push({ id: change.id, name: change.name.trim() });
      break;
    case "rename_section": {
      const section = library.sections.find((s) => s.id === change.id);
      if (!section) throw new Error("This section could not be found.");
      section.name = change.name.trim();
      break;
    }
    case "delete_section":
      library.sections = library.sections.filter((s) => s.id !== change.id);
      library.projects.forEach((p) => {
        if (p.librarySectionId === change.id) p.librarySectionId = null;
      });
      break;
    case "move_projects": {
      if (
        !change.projectIds.length ||
        new Set(change.projectIds).size !== change.projectIds.length
      )
        throw new Error("Select one or more distinct projects.");
      if (
        change.sectionId !== null &&
        !library.sections.some((s) => s.id === change.sectionId)
      )
        throw new Error("This section could not be found.");
      const selected = change.projectIds.map((id) => {
        const project = library.projects.find((p) => p.id === id);
        if (!project) throw new Error("This project could not be found.");
        return project;
      });
      selected.forEach((project) => {
        project.librarySectionId = change.sectionId;
      });
      break;
    }
    case "move_project": {
      const project = library.projects.find((p) => p.id === change.projectId);
      if (!project) throw new Error("This project could not be found.");
      project.librarySectionId = change.sectionId;
    }
  }
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(library));
  return library;
}

async function previewProjects(): Promise<ProjectDetail[]> {
  // Load fixtures only in the development browser; desktop builds always read projects through Rust.
  if (import.meta.env.DEV) {
    const base = (await import("../../mock-data/projects.json"))
      .default as ProjectDetail[];
    const fixture = await previewFixture();
    const assignments = fixture.assignments as Record<string, string>;
    return [
      ...base.map((detail) => ({
        ...detail,
        project: {
          ...detail.project,
          librarySectionId: assignments[detail.project.id],
        },
      })),
      ...(fixture.projects as ProjectDetail[]),
    ];
  }
  throw new Error("Open the desktop app to access your projects.");
}

async function previewFixture() {
  if (import.meta.env.DEV) {
    return (await import("../../mock-data/library.json")).default;
  }
  throw new Error("Open the desktop app to access your projects.");
}

export async function listProjects(): Promise<Project[]> {
  if (isTauri()) return invoke("list_projects");
  return (await previewProjects()).map((detail) => detail.project);
}

export async function getProjectDetail(
  projectId: string,
): Promise<ProjectDetail> {
  if (isTauri()) return invoke("get_project_detail", { projectId });
  const detail = (await previewProjects()).find(
    (item) => item.project.id === projectId,
  );
  if (!detail) throw new Error("This project could not be found.");
  const project = (await getLibrary()).projects.find((p) => p.id === projectId);
  return structuredClone({ ...detail, project: project ?? detail.project });
}
