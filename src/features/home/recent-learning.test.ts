import assert from "node:assert/strict";
import test from "node:test";
import {
  loadRecentLearning,
  recordRecentLearning,
  latestReadingLocations,
  RECENT_LEARNING_STORAGE_KEY,
} from "./recent-learning.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const firstSection = {
  scale: "section",
  bookId: "book-a",
  chapterId: "chapter-a",
  sectionId: "section-a",
} as const;

test("recent learning starts empty and deduplicates visits by book, preserving the exact section", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadRecentLearning(storage), []);
  recordRecentLearning(storage, firstSection);
  recordRecentLearning(storage, { scale: "book", bookId: "book-b" });
  const updated = recordRecentLearning(storage, {
    ...firstSection,
    sectionId: "section-b",
  });
  assert.deepEqual(
    updated.map((entry) => entry.id),
    ["book:book-a", "book:book-b"],
  );
  assert.equal(updated.length, 2);
  assert.deepEqual(latestReadingLocations(updated)["book-a"], {
    ...firstSection,
    sectionId: "section-b",
  });
  const saved = storage.getItem(RECENT_LEARNING_STORAGE_KEY);
  recordRecentLearning(storage, { ...firstSection, sectionId: "section-b" });
  assert.equal(storage.getItem(RECENT_LEARNING_STORAGE_KEY), saved);
});

test("independent writers merge the latest stored history and retain only 20 entries", () => {
  const storage = memoryStorage();
  recordRecentLearning(storage, firstSection);
  const otherWriter = { ...storage };
  recordRecentLearning(otherWriter, {
    scale: "chat",
    conversationId: "conversation-a",
  });
  const merged = recordRecentLearning(storage, {
    scale: "book",
    bookId: "book-b",
  });
  assert.equal(merged.length, 3);
  assert.ok(merged.some((entry) => entry.id === "chat:conversation-a"));
  for (let index = 0; index < 24; index++)
    recordRecentLearning(storage, { scale: "book", bookId: `book-${index}` });
  assert.equal(loadRecentLearning(storage).length, 20);
  assert.equal(loadRecentLearning(storage)[0].id, "book:book-23");
});

test("malformed history and failed writes preserve the stored snapshot", () => {
  const storage = memoryStorage();
  for (const malformed of ["{broken", "{}", '[{"id":"wrong"}]']) {
    storage.setItem(RECENT_LEARNING_STORAGE_KEY, malformed);
    assert.throws(() => recordRecentLearning(storage, firstSection));
    assert.equal(storage.getItem(RECENT_LEARNING_STORAGE_KEY), malformed);
  }
  storage.setItem(RECENT_LEARNING_STORAGE_KEY, "[]");
  recordRecentLearning(storage, firstSection);
  const saved = storage.getItem(RECENT_LEARNING_STORAGE_KEY);
  assert.throws(() =>
    recordRecentLearning(
      {
        getItem: storage.getItem,
        setItem: () => {
          throw new Error("Storage full");
        },
      },
      { scale: "book", bookId: "book-b" },
    ),
  );
  assert.equal(storage.getItem(RECENT_LEARNING_STORAGE_KEY), saved);
});

test("binding chat to a book removes duplicate rows and retains its last reading section", () => {
  const storage = memoryStorage();
  recordRecentLearning(storage, firstSection);
  recordRecentLearning(storage, {
    scale: "chat",
    conversationId: "conversation-a",
  });
  const entries = recordRecentLearning(
    storage,
    { scale: "chat", conversationId: "conversation-a" },
    "book-a",
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "book:book-a");
  assert.deepEqual(entries[0].location, {
    scale: "chat",
    conversationId: "conversation-a",
  });
  assert.deepEqual(
    latestReadingLocations(loadRecentLearning(storage))["book-a"],
    firstSection,
  );
});

test("history rejects inconsistent identities, invalid timestamps and mismatched reading destinations", () => {
  const storage = memoryStorage();
  const [entry] = recordRecentLearning(storage, firstSection);
  for (const invalid of [
    { ...entry, id: "book:other" },
    { ...entry, updatedAt: "yesterday" },
    { ...entry, readingLocation: { scale: "book", bookId: "other" } },
  ]) {
    storage.setItem(RECENT_LEARNING_STORAGE_KEY, JSON.stringify([invalid]));
    assert.throws(() => loadRecentLearning(storage));
  }
});
