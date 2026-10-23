import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_STORAGE_KEY,
  queueQuestion,
  readChat,
  startBookSession,
  updateChat,
} from "../features/chat/chat-store.ts";
import { learningBook } from "./book.ts";
import { seedOrganizeConversation } from "./organize-conversation.ts";
import { cleanupEmptyPreviewSessions } from "./preview-sessions.ts";

const BACKUP_KEY = "tukdam.preview-empty-cleanup.backup.v1";
const MARKER_KEY = "tukdam.preview-empty-cleanup.v1";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test("preview cleanup preserves every draft and removes only entirely empty preview sessions", () => {
  const storage = memoryStorage();
  const create = () => startBookSession(storage, learningBook, true).session.id;
  const empty = create();
  const legacyEmpty = create();
  const drafts = [
    { id: create(), title: "New session", draft: "尚未发送的重要问题" },
    { id: create(), title: "Ownership & Borrowing", draft: "?" },
    { id: create(), title: "New session", draft: " \n " },
  ];
  const attached = create();
  const quoted = create();
  const named = create();
  updateChat(storage, (snapshot) => {
    snapshot.homeDraft = "Keep the Home draft.";
    snapshot.homeAttachments = [{ id: "home", name: "home.txt", text: "Home" }];
    snapshot.sessions.find((s) => s.id === legacyEmpty)!.title =
      "Ownership & Borrowing";
    for (const draft of drafts) {
      const session = snapshot.sessions.find((s) => s.id === draft.id)!;
      session.title = draft.title;
      session.draft = draft.draft;
    }
    snapshot.sessions.find((s) => s.id === attached)!.draftAttachments = [
      { id: "file", name: "notes.txt", text: "Keep this attachment." },
    ];
    snapshot.sessions.find((s) => s.id === quoted)!.draftPassage = {
      bookId: learningBook.id,
      chapterId: learningBook.chapters[0].id,
      sectionId: learningBook.chapters[0].sections[0].id,
      paragraphId: learningBook.chapters[0].sections[0].paragraphs[0].id,
      version: learningBook.version,
      quote: "Keep this quoted context.",
    };
    snapshot.sessions.find((s) => s.id === named)!.title = "A named session";
  });
  queueQuestion(storage, {
    text: "A real conversation",
    attachments: [],
    options: {},
  });
  const original = storage.getItem(CHAT_STORAGE_KEY)!;
  const before = readChat(storage);
  const cleaned = cleanupEmptyPreviewSessions(storage);
  assert.deepEqual(
    cleaned.sessions,
    before.sessions.filter((s) => s.id !== empty && s.id !== legacyEmpty),
  );
  assert.equal(cleaned.homeDraft, before.homeDraft);
  assert.deepEqual(cleaned.homeAttachments, before.homeAttachments);
  assert.equal(storage.getItem(BACKUP_KEY), original);
  assert.equal(storage.getItem(MARKER_KEY), "done");
});

test("preview cleanup never overwrites an existing backup", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  const originalBackup = "Keep these exact earlier backup bytes.\n";
  storage.setItem(BACKUP_KEY, originalBackup);
  assert.equal(cleanupEmptyPreviewSessions(storage).sessions.length, 0);
  assert.equal(storage.getItem(BACKUP_KEY), originalBackup);
});

test("a failed cleanup backup cannot change the chat snapshot or completion marker", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  const original = storage.getItem(CHAT_STORAGE_KEY);
  assert.throws(
    () =>
      cleanupEmptyPreviewSessions({
        getItem: storage.getItem,
        setItem: () => {
          throw new Error("Backup failed");
        },
      }),
    /Backup failed/,
  );
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  assert.equal(storage.getItem(BACKUP_KEY), null);
  assert.equal(storage.getItem(MARKER_KEY), null);
});

test("a failed cleanup write retains both the live snapshot and its exact backup", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  const original = storage.getItem(CHAT_STORAGE_KEY);
  assert.throws(
    () =>
      cleanupEmptyPreviewSessions({
        getItem: storage.getItem,
        setItem: (key, value) => {
          if (key === CHAT_STORAGE_KEY) throw new Error("Storage full");
          storage.setItem(key, value);
        },
      }),
    /Storage full/,
  );
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  assert.equal(storage.getItem(BACKUP_KEY), original);
  assert.equal(storage.getItem(MARKER_KEY), null);
});

test("completed preview cleanup leaves later sessions, drafts and backups untouched", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  cleanupEmptyPreviewSessions(storage);
  const backup = storage.getItem(BACKUP_KEY);
  const draft = startBookSession(storage, learningBook, true).session;
  startBookSession(storage, learningBook, true);
  updateChat(storage, (snapshot) => {
    snapshot.sessions.find((s) => s.id === draft.id)!.draft = "A later draft";
  });
  const original = storage.getItem(CHAT_STORAGE_KEY);
  assert.deepEqual(cleanupEmptyPreviewSessions(storage), readChat(storage));
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  assert.equal(storage.getItem(BACKUP_KEY), backup);
});

test("development fixtures preserve existing conversations and drafts without reseeding", () => {
  const storage = memoryStorage();
  queueQuestion(storage, {
    text: "My own question",
    attachments: [{ id: "mine", name: "mine.md", text: "My own notes" }],
    options: {},
  });
  const draft = startBookSession(storage, learningBook, true).session;
  updateChat(storage, (snapshot) => {
    snapshot.sessions.find((s) => s.id === draft.id)!.draft = "My own draft";
    snapshot.homeDraft = "My Home question";
  });
  const before = readChat(storage);
  seedOrganizeConversation(storage);
  const seeded = readChat(storage);
  for (const original of before.sessions)
    assert.deepEqual(
      seeded.sessions.find((s) => s.id === original.id),
      original,
    );
  assert.equal(seeded.sessions.length, before.sessions.length + 1);
  assert.equal(seeded.homeDraft, before.homeDraft);
  const original = storage.getItem(CHAT_STORAGE_KEY);
  seedOrganizeConversation(storage);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
});
