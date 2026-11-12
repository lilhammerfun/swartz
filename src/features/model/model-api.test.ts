import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBaseUrl, modelIsConfigured } from "./model-api.ts";
import { readPromptAttachments } from "../annotations/prompt-attachments.ts";
import { promptChoices } from "../annotations/prompt-options.ts";
test("model settings distinguish local endpoints and reject unsafe URLs", () => {
  for (const invalid of [
    "http://remote.example/v1",
    "https://user:key@example.com/v1",
    "https://example.com/v1?api_key=key",
  ])
    assert.throws(() => normalizeBaseUrl(invalid));
  assert.equal(
    normalizeBaseUrl("http://localhost:1234/v1/"),
    "http://localhost:1234/v1",
  );
  assert.equal(
    modelIsConfigured({
      apiFormat: "openai_responses",
      baseUrl: "http://localhost:1234/v1",
      model: "local-model",
      hasApiKey: false,
    }),
    true,
  );
  assert.equal(
    modelIsConfigured({
      apiFormat: "openai_responses",
      baseUrl: "https://provider.example/v1",
      model: "remote-model",
      hasApiKey: false,
    }),
    false,
  );
});

test("attachments reject unsupported, binary, oversized, and excessive files before submission", async () => {
  await assert.rejects(
    readPromptAttachments([new File(["PDF"], "notes.pdf")], []),
    /text/,
  );
  await assert.rejects(
    readPromptAttachments(
      [new File([new Uint8Array([255])], "invalid.txt")],
      [],
    ),
    /UTF-8/,
  );
  await assert.rejects(
    readPromptAttachments([new File(["\u0000"], "binary.txt")], []),
    /readable/,
  );
  await assert.rejects(
    readPromptAttachments([new File(["a".repeat(80001)], "large.txt")], []),
    /large/,
  );
  await assert.rejects(
    readPromptAttachments(
      Array.from({ length: 5 }, () => new File(["text"], "notes.md")),
      [],
    ),
    /4/,
  );
});

test("prompt options use real provider capabilities without suggesting unrelated models", () => {
  const settings = {
    apiFormat: "openai_responses" as const,
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    hasApiKey: true,
  };
  const deepseek = promptChoices(settings);
  assert.deepEqual(
    deepseek.models.map((m) => m.id),
    ["deepseek-flash", "deepseek-v4-pro"],
  );
  assert.deepEqual(
    deepseek.efforts.map((e) => e.id),
    ["none", "low", "high", "max"],
  );
  const custom = promptChoices({
    ...settings,
    baseUrl: "https://api.deepseek.com.example/v1",
    model: "my-model",
  });
  assert.deepEqual(
    custom.models.map((m) => m.id),
    ["my-model"],
  );
  assert.equal(custom.defaultEffort, "default");
});
