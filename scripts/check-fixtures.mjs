import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const target = mkdtempSync(join(tmpdir(), "tukdam-fixtures-"));
try {
  for (const file of [
    "mock-data/sidebar",
    "mock-data/learning",
    "mock-data/conversations",
    "mock-data/maps",
    "mock-data/workspace",
    "mock-data/product",
    "mock-data/project-suggestions",
    "features/workspace/migrateWorkspace",
    "types/learning",
    "types/workspace",
  ]) {
    const source = readFileSync(resolve(`src/${file}.ts`), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    mkdirSync(join(target, file.split("/").slice(0, -1).join("/")), {
      recursive: true,
    });
    writeFileSync(join(target, `${file}.js`), output);
  }
  const require = createRequire(import.meta.url);
  const { productSeed, evidenceSeed } = require(
    join(target, "mock-data/product.js"),
  );
  const { learningMaps } = require(join(target, "mock-data/workspace.js"));
  const { threads, tutorials, projects, decisions } = productSeed;
  const ids = new Set(threads.map((thread) => thread.id));
  assert.equal(ids.size, threads.length, "Duplicate thread ID");
  assert(ids.has(productSeed.activeThreadId), "Unknown active conversation");
  const messages = new Map();
  let blocks = 0;
  for (const thread of threads) {
    assert(
      thread.projectId === null ||
        projects.some((project) => project.key === thread.projectId),
      "Unknown thread project",
    );
    for (const message of thread.messages) {
      assert(!messages.has(message.id), "Duplicate message ID");
      messages.set(message.id, { thread, message });
      assert(
        message.role === "user" ? message.text?.trim() : message.blocks?.length,
        "Empty message",
      );
      for (const block of message.blocks ?? []) {
        blocks++;
        assert.notEqual(
          block.kind,
          "question",
          "Default conversations must not initiate quizzes",
        );
      }
    }
  }
  assert.equal(
    new Set(tutorials.map((tutorial) => tutorial.projectId)).size,
    tutorials.length,
    "A project has one tutorial",
  );
  for (const tutorial of tutorials) {
    assert(
      projects.some((topic) => topic.key === tutorial.projectId),
      "Unknown tutorial project",
    );
    for (const chapter of tutorial.chapters) {
      assert(
        chapter.version >= 1 && chapter.paragraphs.length,
        "Invalid chapter",
      );
      assert(ids.has(chapter.sourceThreadId), "Unknown chapter source");
      const source = messages.get(chapter.sourceMessageId);
      assert(
        source?.message.role === "assistant",
        "Chapter must reference teaching content",
      );
      if (chapter.code.length)
        assert(
          source.message.blocks.some(
            (block) =>
              block.kind === "code" &&
              block.filename === chapter.filename &&
              JSON.stringify(block.lines) === JSON.stringify(chapter.code),
          ),
          "Chapter code must retain its source example",
        );
      chapter.paragraphs.forEach((text, index) => {
        const id = chapter.paragraphSources[index];
        const record = messages.get(id);
        assert.equal(record?.thread.id, chapter.sourceThreadId);
        assert(
          record.message.blocks.some(
            (block) => block.kind === "answer" && block.text.includes(text),
          ),
          "Chapter passage must retain its source text",
        );
      });
    }
  }
  for (const request of decisions) {
    assert(ids.has(request.threadId), "Unknown decision source");
    assert.equal(
      request.status,
      "waiting",
      "Seed project must require explicit confirmation",
    );
    assert(request.candidates.length, "Missing project candidates");
  }
  for (const [domain, map] of Object.entries(learningMaps)) {
    const nodes = new Set(map.nodes.map((node) => node.id));
    assert.equal(nodes.size, map.nodes.length, "Duplicate concept ID");
    for (const node of map.nodes) {
      assert(
        node.mastery === null || (node.mastery >= 0 && node.mastery <= 1),
        "Invalid mastery",
      );
      for (const parent of node.prerequisites)
        assert(nodes.has(parent), "Unknown prerequisite");
      if (node.mastery !== null)
        assert(
          evidenceSeed.some(
            (item) => item.domain === domain && item.conceptId === node.id,
          ),
          "Estimate without evidence",
        );
    }
  }
  for (const evidence of evidenceSeed) {
    const source = messages.get(evidence.messageId);
    assert.equal(
      source?.message.role,
      "user",
      "A model answer must not become user evidence",
    );
    assert.equal(source.message.text, evidence.text);
  }
  const { migrateWorkspace } = require(
    join(target, "features/workspace/migrateWorkspace.js"),
  );
  const quoteChapter = tutorials[0].chapters[0];
  const legacy = {
    ...structuredClone(productSeed),
    version: 1,
    topics: projects.map(({ domain, ...project }) => project),
    books: tutorials.map(({ projectId, ...tutorial }) => ({
      ...tutorial,
      topicId: projectId,
    })),
    threads: threads.map(({ projectId, ...thread }) => ({
      ...thread,
      topicId: projectId,
    })),
    panel: "books",
  };
  legacy.threads[0].quote = {
    bookId: tutorials[0].id,
    chapterId: quoteChapter.id,
    version: quoteChapter.version,
    text: quoteChapter.paragraphs[0],
    sourceThreadId: quoteChapter.sourceThreadId,
    sourceMessageId: quoteChapter.sourceMessageId,
  };
  const before = JSON.stringify(legacy);
  const migrated = migrateWorkspace(legacy);
  assert.equal(
    JSON.stringify(legacy),
    before,
    "Migration must leave its input unchanged",
  );
  assert.equal(migrated.version, 2);
  assert.equal(migrated.panel, "tutorial");
  assert.equal(migrated.threads.length, threads.length);
  assert.deepEqual(migrated.threads[0].messages, threads[0].messages);
  assert.equal(migrated.threads[0].quote.text, quoteChapter.paragraphs[0]);
  assert.equal(migrated.threads[0].quote.version, quoteChapter.version);
  assert.equal(migrated.threads[0].quote.tutorialId, tutorials[0].id);
  assert.equal(migrateWorkspace({ version: 1 }), null);
  console.log(
    JSON.stringify({
      threads: threads.length,
      messages: messages.size,
      blocks,
      tutorials: tutorials.length,
      chapters: tutorials.reduce(
        (count, tutorial) => count + tutorial.chapters.length,
        0,
      ),
      valid: true,
    }),
  );
} finally {
  rmSync(target, { recursive: true, force: true });
}
