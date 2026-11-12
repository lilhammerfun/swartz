import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { ChatSession } from "./chat-store";
import { prepareTutorRequest, type TutorResult } from "./tutor-request.ts";

type TutorEvent = { kind: "started"; requestId: string };

export interface TutorRun {
  result: Promise<TutorResult>;
  cancel: () => Promise<void>;
}

/** Starts a native Tutor operation; Rust returns its terminal outcome. */
export function runTutor(session: ChatSession): TutorRun {
  if (!isTauri())
    throw new Error("Open the desktop app to chat with the Tutor.");
  const request = prepareTutorRequest(session);

  // A cancel may be clicked before Rust registers the run. Wait for Started,
  // or for the invoke to finish, rather than losing that early cancellation.
  let resolveStarted!: (started: boolean) => void;
  const started = new Promise<boolean>((resolve) => {
    resolveStarted = resolve;
  });
  const events = new Channel<TutorEvent>();
  events.onmessage = (event) => {
    if (event.kind === "started" && event.requestId === request.requestId)
      resolveStarted(true);
  };
  let finished = false;
  const result = invoke<TutorResult>("run_tutor", {
    request,
    events,
  }).finally(() => {
    finished = true;
    resolveStarted(false);
  });
  return {
    result,
    cancel: async () => {
      if (!(await started) || finished) return;
      await invoke<boolean>("cancel_tutor", {
        requestId: request.requestId,
      });
    },
  };
}
