import assert from "node:assert/strict";
import test from "node:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { loadModelSettings, saveModelSettings } from "./model-service.ts";

function setup(desktop: boolean) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.assign(globalThis, { isTauri: desktop });
}

function cleanup() {
  clearMocks();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "isTauri");
}

test("browser preview cannot load or save model credentials", async () => {
  setup(false);
  try {
    mockIPC(() => assert.fail("Browser preview has no Rust connection."));
    await assert.rejects(loadModelSettings(), /desktop app/);
    await assert.rejects(
      saveModelSettings({
        apiFormat: "openai_responses",
        baseUrl: "https://provider.example/v1",
        model: "test-model",
        apiKey: "test-key",
      }),
      /desktop app/,
    );
  } finally {
    cleanup();
  }
});

test("model settings are read and saved only through Rust commands", async () => {
  setup(true);
  try {
    const input = {
      apiFormat: "openai_responses" as const,
      baseUrl: "https://provider.example/v1",
      model: "test-model",
      apiKey: "test-key",
    };
    const saved = {
      apiFormat: input.apiFormat,
      baseUrl: input.baseUrl,
      model: input.model,
      hasApiKey: true,
    };
    const calls: string[] = [];
    mockIPC((command, args) => {
      calls.push(command);
      if (command === "save_model_settings") assert.deepEqual(args, { input });
      else assert.equal(command, "load_model_settings");
      return saved;
    });
    assert.deepEqual(await saveModelSettings(input), saved);
    assert.deepEqual(await loadModelSettings(), saved);
    assert.deepEqual(calls, ["save_model_settings", "load_model_settings"]);
  } finally {
    cleanup();
  }
});
