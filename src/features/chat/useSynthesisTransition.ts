import { useEffect, useRef, useState } from "react";

/** A short exit on existing elements; persistence and Undo stay with the caller. */
export function useSynthesisTransition(sessionId?: string) {
  const root = useRef<HTMLElement>(null);
  const animations = useRef<Animation[]>([]);
  const mounted = useRef(false);
  const running = useRef(false);
  const restoreTabStyle = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      animations.current.forEach((animation) => animation.cancel());
      restoreTabStyle.current?.();
    };
  }, []);

  async function run(commit: () => void) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    let committed = false;
    try {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!reduced) {
        const tab = sessionId
          ? document
              .querySelector<HTMLElement>(
                `[role="tab"][data-session-id="${CSS.escape(sessionId)}"]`,
              )
              ?.closest<HTMLElement>(".session-tab-group")
          : null;
        const tabWidth = tab?.getBoundingClientRect().width ?? 0;
        if (tab) {
          const overflow = tab.style.overflow;
          const flex = tab.style.flex;
          tab.style.flex = `0 0 ${tabWidth}px`;
          tab.style.overflow = "hidden";
          restoreTabStyle.current = () => {
            tab.style.overflow = overflow;
            tab.style.flex = flex;
          };
        }
        const options: KeyframeAnimationOptions = {
          duration: 200,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
          fill: "forwards",
        };
        const exits: Animation[] = [];
        if (root.current)
          exits.push(
            root.current.animate([{ opacity: 1 }, { opacity: 0 }], {
              ...options,
              duration: 160,
            }),
          );
        if (tab)
          exits.push(
            tab.animate(
              [
                {
                  flexBasis: `${tabWidth}px`,
                  opacity: 1,
                  marginLeft: "2px",
                  marginRight: "2px",
                },
                {
                  flexBasis: "0px",
                  opacity: 0,
                  marginLeft: "0px",
                  marginRight: "0px",
                },
              ],
              options,
            ),
          );
        animations.current = exits;
        try {
          await Promise.all(exits.map((animation) => animation.finished));
        } catch {
          return;
        }
      }
      if (mounted.current) {
        commit();
        committed = true;
      }
    } finally {
      // Keep the final frame until React removes the session, avoiding a flash back.
      if (!committed) {
        animations.current.forEach((animation) => animation.cancel());
        animations.current = [];
        restoreTabStyle.current?.();
        restoreTabStyle.current = null;
        if (mounted.current) setBusy(false);
      }
      running.current = false;
    }
  }
  return { root, busy, run };
}
