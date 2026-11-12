import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectDetail,
  LibrarySnapshot,
  LibraryChange,
} from "./project-data.ts";

export async function getLibrary(): Promise<LibrarySnapshot> {
  // Browser UI previews start empty. Project persistence belongs to the Rust backend.
  if (!isTauri()) return { sections: [], projects: [] };
  return invoke("get_library");
}

export async function updateLibrary(
  change: LibraryChange,
): Promise<LibrarySnapshot> {
  if (!isTauri())
    throw new Error("Open the desktop app to organize your projects.");
  return invoke("update_library", { change });
}

export async function listProjects(): Promise<Project[]> {
  if (!isTauri()) return [];
  return invoke("list_projects");
}

export async function getProjectDetail(
  projectId: string,
): Promise<ProjectDetail> {
  if (!isTauri())
    throw new Error("Open the desktop app to access your projects.");
  return invoke("get_project_detail", { projectId });
}
