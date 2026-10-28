import assert from "node:assert/strict";
import test from "node:test";
import { mergePreviewLibrary, type PreviewLibrary } from "./library-preview.ts";

const fixture: PreviewLibrary = {
  fixtureRevision: 1,
  sections: [{ id: "systems", name: "计算与系统" }],
  projects: [
    {
      id: "old",
      title: "Existing",
      description: "",
      librarySectionId: "systems",
    },
    { id: "new", title: "New", description: "", librarySectionId: "systems" },
  ],
};

test("preview expansion preserves custom sections, names and explicit moves", () => {
  for (const destination of ["custom", null]) {
    const saved: PreviewLibrary = {
      sections: [{ id: "custom", name: "My reading" }],
      projects: [
        {
          id: "old",
          title: "My title",
          description: "My notes",
          librarySectionId: destination,
        },
      ],
    };
    const next = mergePreviewLibrary(saved, fixture);
    assert.equal(next.projects.length, 2);
    assert.equal(next.projects[0].librarySectionId, destination);
    assert.equal(next.projects[0].title, "My title");
    assert.equal(next.sections[0].name, "My reading");
    assert.equal(saved.projects.length, 1);
  }
});

test("legacy projects without an explicit assignment acquire the demo grouping", () => {
  const next = mergePreviewLibrary(
    {
      sections: [],
      projects: [{ id: "old", title: "Existing", description: "" }],
    },
    fixture,
  );
  assert.equal(next.projects[0].librarySectionId, "systems");
});

test("a completed expansion does not restore deleted sections or repeat projects", () => {
  const next = mergePreviewLibrary(null, fixture);
  next.sections = [];
  next.projects[0].librarySectionId = null;
  const restored = mergePreviewLibrary(next, fixture);
  assert.equal(restored.sections.length, 0);
  assert.equal(restored.projects.length, 2);
  assert.equal(restored.projects[0].librarySectionId, null);
  assert.equal(fixture.sections.length, 1);
});
