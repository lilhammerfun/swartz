import assert from "node:assert/strict";
import test from "node:test";
import {
  blankBook,
  createStoredBook,
  LIBRARY_STORAGE_KEY,
  parseLibrary,
} from "./library-store.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test("created books restore their title as empty books without generated chapters", () => {
  const storage = memoryStorage();
  const { book } = createStoredBook(storage, "  Learning Rust  ");
  assert.equal(book.title, "Learning Rust");
  assert.deepEqual(book.chapters, []);
  assert.deepEqual(parseLibrary(storage.getItem(LIBRARY_STORAGE_KEY)!), [book]);
  assert.throws(() => blankBook("book-empty", "   "));
});

test("creating a book reads the latest snapshot and retains another writer's books", () => {
  const storage = memoryStorage();
  createStoredBook(storage, "First book");
  createStoredBook(storage, "Book from another tab");
  const { books } = createStoredBook(storage, "Third book");
  assert.deepEqual(
    books.map((book) => book.title),
    ["First book", "Book from another tab", "Third book"],
  );
  assert.equal(new Set(books.map((book) => book.id)).size, 3);
});

test("an unreadable library is never overwritten by creating a new book", () => {
  const storage = memoryStorage();
  const previous = '{"not":"a library"}';
  storage.setItem(LIBRARY_STORAGE_KEY, previous);
  assert.throws(() => createStoredBook(storage, "New book"));
  assert.equal(storage.getItem(LIBRARY_STORAGE_KEY), previous);
  assert.throws(() =>
    parseLibrary('[{"id":"book-a","title":"A"},{"id":"book-a","title":"B"}]'),
  );
});

test("failed storage writes do not report a created book or alter the saved snapshot", () => {
  const storage = memoryStorage();
  createStoredBook(storage, "Saved book");
  const previous = storage.getItem(LIBRARY_STORAGE_KEY);
  assert.throws(() =>
    createStoredBook(
      {
        getItem: storage.getItem,
        setItem: () => {
          throw new Error("Storage full");
        },
      },
      "Unsaved book",
    ),
  );
  assert.equal(storage.getItem(LIBRARY_STORAGE_KEY), previous);
});
