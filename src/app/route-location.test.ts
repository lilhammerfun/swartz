import assert from "node:assert/strict";
import test from "node:test";
import { locationPath } from "./route-location.ts";

test("saved reader locations become URL paths without treating opaque IDs as path syntax", () => {
  assert.equal(
    locationPath({ scale: "project", projectId: "a/b?#中文" }),
    "/projects/a%2Fb%3F%23%E4%B8%AD%E6%96%87",
  );
  assert.equal(
    locationPath({
      scale: "section",
      bookId: "project-1",
      chapterId: "chapter/1",
      sectionId: "space & section",
    }),
    "/workspace/project-1/chapters/chapter%2F1/sections/space%20%26%20section",
  );
});

test("existing Home, conversation and book locations retain distinct destinations", () => {
  assert.equal(locationPath({ scale: "home" }), "/");
  assert.equal(locationPath({ scale: "library" }), "/library");
  assert.equal(locationPath({ scale: "settings" }), "/settings");
  assert.equal(
    locationPath({ scale: "chat", conversationId: "session-1" }),
    "/conversations/session-1",
  );
  assert.equal(
    locationPath({ scale: "book", bookId: "project-1" }),
    "/workspace/project-1",
  );
});
