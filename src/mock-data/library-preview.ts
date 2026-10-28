import type { LibrarySnapshot } from "../features/projects/project-data.ts";

export type PreviewLibrary = LibrarySnapshot & { fixtureRevision?: number };

/** 只扩充开发演示目录；保留用户已整理的分区、名称和明确指定的归属。 */
export function mergePreviewLibrary(
  saved: PreviewLibrary | null,
  fixture: PreviewLibrary,
): PreviewLibrary {
  if (!saved) return structuredClone(fixture);
  if (saved.fixtureRevision === fixture.fixtureRevision) return saved;
  const sections = new Map(
    saved.sections.map((section) => [section.id, section]),
  );
  for (const section of fixture.sections) {
    if (!sections.has(section.id)) sections.set(section.id, section);
  }
  const defaults = new Map(
    fixture.projects.map((project) => [project.id, project]),
  );
  const projects = saved.projects.map((project) =>
    Object.hasOwn(project, "librarySectionId")
      ? project
      : {
          ...project,
          librarySectionId: defaults.get(project.id)?.librarySectionId ?? null,
        },
  );
  const existing = new Set(projects.map((project) => project.id));
  for (const project of fixture.projects) {
    if (!existing.has(project.id)) projects.push(project);
  }
  return {
    sections: [...sections.values()],
    projects,
    fixtureRevision: fixture.fixtureRevision,
  };
}
