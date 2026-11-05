import assert from "node:assert/strict";
import test from "node:test";
import { Channel } from "@tauri-apps/api/core";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { runTutor } from "./tutor-service.ts";
import { queueQuestion, settleQuestion } from "./chat-store.ts";
import type { TutorResult } from "./tutor-request.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { crypto: globalThis.crypto },
  });
  Object.assign(globalThis, { isTauri: true });
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const { session } = queueQuestion(storage, {
    text: "Why does ownership matter?",
    attachments: [],
    options: {},
  });
  return { session, storage };
}

function result(): TutorResult {
  return {
    outcome: { status: "cancelled" },
  };
}

test("browser preview cannot bypass the Rust Tutor", () => {
  const { session } = setup();
  try {
    Object.assign(globalThis, { isTauri: false });
    mockIPC(() => assert.fail("Browser preview has no Rust connection."));
    assert.throws(() => runTutor(session), /desktop app/);
  } finally {
    clearMocks();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "isTauri");
  }
});

test("early cancellation waits for backend registration and preserves a retryable question", async () => {
  const { session, storage } = setup();
  try {
    const pending = deferred<TutorResult>();
    let events!: Channel<{ kind: "started"; requestId: string }>;
    const calls: string[] = [];
    mockIPC((command, args) => {
      calls.push(command);
      assert.ok(args && !Array.isArray(args));
      const payload = args as Record<string, unknown>;
      if (command === "run_tutor") {
        events = payload.events as typeof events;
        return pending.promise;
      }
      assert.equal(command, "cancel_tutor");
      assert.equal(payload.requestId, session.request!.id);
      pending.resolve(result());
      return true;
    });
    const run = runTutor(session);
    const cancelling = run.cancel();
    assert.deepEqual(calls, ["run_tutor"]);
    events.onmessage({ kind: "started", requestId: "another-run" });
    await Promise.resolve();
    assert.deepEqual(calls, ["run_tutor"]);
    events.onmessage({ kind: "started", requestId: session.request!.id });
    await cancelling;
    const completed = await run.result;
    assert.equal(completed.outcome.status, "cancelled");
    const saved = settleQuestion(
      storage,
      session.id,
      session.request!.userMessageId,
      { cancelled: true },
      session.request!.id,
    );
    assert.equal(saved.sessions[0].request?.status, "interrupted");
    assert.deepEqual(saved.sessions[0].messages, session.messages);
    await run.cancel();
    assert.deepEqual(calls, ["run_tutor", "cancel_tutor"]);
  } finally {
    clearMocks();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "isTauri");
  }
});

test("failure before Started releases an early cancellation without submitting a stale command", async () => {
  const { session } = setup();
  try {
    const pending = deferred<TutorResult>();
    const calls: string[] = [];
    mockIPC((command) => {
      calls.push(command);
      return pending.promise;
    });
    const run = runTutor(session);
    const cancelling = run.cancel();
    pending.reject(new Error("Invalid conversation"));
    await assert.rejects(run.result, /Invalid conversation/);
    await cancelling;
    assert.deepEqual(calls, ["run_tutor"]);
  } finally {
    clearMocks();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "isTauri");
  }
});
