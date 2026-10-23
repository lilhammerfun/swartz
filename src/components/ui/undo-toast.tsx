import { useEffect, useRef, useState } from "react";
import { Toast } from "radix-ui";
import { Button } from "./button";

export interface UndoNotice {
  id: string;
  title: string;
  onUndo: () => boolean;
}

const UNDO_DURATION = 10000;

function UndoToast({
  notice,
  onDismiss,
}: {
  notice: UndoNotice;
  onDismiss: (id: string) => void;
}) {
  const clock = useRef({
    remaining: UNDO_DURATION,
    started: performance.now(),
    paused: false,
  });
  const [seconds, setSeconds] = useState(UNDO_DURATION / 1000);
  const remaining = () =>
    clock.current.paused
      ? clock.current.remaining
      : Math.max(
          0,
          clock.current.remaining - (performance.now() - clock.current.started),
        );
  useEffect(() => {
    const tick = window.setInterval(
      () => setSeconds(Math.ceil(remaining() / 1000)),
      100,
    );
    return () => clearInterval(tick);
  }, []);
  return (
    <Toast.Root
      open
      duration={UNDO_DURATION}
      onOpenChange={(open) => {
        if (!open) onDismiss(notice.id);
      }}
      onPause={() => {
        if (clock.current.paused) return;
        clock.current.remaining = remaining();
        clock.current.paused = true;
        setSeconds(Math.ceil(clock.current.remaining / 1000));
      }}
      onResume={() => {
        if (!clock.current.paused) return;
        clock.current.started = performance.now();
        clock.current.paused = false;
      }}
      className="undo-toast pointer-events-auto flex min-h-11 items-center gap-4 rounded-xl border border-border/60 bg-popover px-4 py-2 text-popover-foreground shadow-[0_4px_24px_-8px_rgb(0_0_0/0.18)]"
    >
      <Toast.Title className="min-w-0 flex-1 text-[13px] font-normal">
        {notice.title}
      </Toast.Title>
      <span
        aria-hidden="true"
        className="min-w-5 text-right text-xs text-muted-foreground tabular-nums"
      >
        {seconds}s
      </span>
      <Toast.Action
        asChild
        altText="Undo synthesis and restore the conversation"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-[13px] font-medium"
          onClick={(event) => {
            if (!notice.onUndo()) event.preventDefault();
          }}
        >
          Undo
        </Button>
      </Toast.Action>
    </Toast.Root>
  );
}

export function UndoToasts({
  notices,
  onDismiss,
}: {
  notices: UndoNotice[];
  onDismiss: (id: string) => void;
}) {
  return (
    <Toast.Provider duration={UNDO_DURATION} swipeDirection="up">
      {notices.map((notice) => (
        <UndoToast key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
      <Toast.Viewport
        hotkey={["altKey", "KeyT"]}
        label="Notifications (Alt+T)"
        className="pointer-events-none fixed top-6 left-1/2 z-[1000] flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 outline-none"
      />
    </Toast.Provider>
  );
}
