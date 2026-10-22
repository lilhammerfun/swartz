import type { CSSProperties } from "react";

const palette = [
  "#7964a7",
  "#397f91",
  "#b0793e",
  "#a7657d",
  "#668453",
  "#5271a2",
  "#498579",
  "#a86e4c",
] as const;

export function annotationColor(id: string): string {
  // The ID owns its color; filtering and source ordering cannot change it.
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return palette[(hash >>> 0) % palette.length];
}

export function annotationColorStyle(id: string): CSSProperties {
  return { "--annotation-color": annotationColor(id) } as CSSProperties;
}
