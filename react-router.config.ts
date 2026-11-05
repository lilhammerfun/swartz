import type { Config } from "@react-router/dev/config";

// Tauri bundles a static client; only the root page is prerendered, with no JavaScript server.
export default {
  appDirectory: "src",
  buildDirectory: "dist",
  ssr: false,
} satisfies Config;
