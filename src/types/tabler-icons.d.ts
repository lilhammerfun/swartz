/** Official per-icon modules avoid prebundling the entire icon catalogue. */
declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { TablerIcon } from "@tabler/icons-react";
  export const __iconNode: Array<[string, Record<string, string>]>;
  const icon: TablerIcon;
  export default icon;
}
