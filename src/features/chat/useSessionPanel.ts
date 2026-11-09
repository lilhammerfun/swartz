import { useRef, useState } from "react";

export function useSessionPanel(projectId?: string) {
  const [panels, setPanels] = useState<
    Record<string, { open: boolean; active?: string }>
  >({});
  const scrollPositions = useRef(new Map<string, number>());
  const state = (projectId ? panels[projectId] : undefined) ?? { open: false };
  return {
    ...state,
    scrollPositions: scrollPositions.current,
    setOpen: (open: boolean) => {
      if (!projectId) return;
      setPanels((current) => ({
        ...current,
        [projectId]: { ...current[projectId], open },
      }));
    },
    openSession: (id: string, targetProjectId = projectId) => {
      if (!targetProjectId) return;
      setPanels((current) => ({
        ...current,
        [targetProjectId]: { open: true, active: id },
      }));
    },
  };
}
