import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  clearScreen: false,
  optimizeDeps: {
    // Route modules are framework entries rather than imports from an index.html.
    entries: [
      "src/app/entry.client.tsx",
      "src/app/root.tsx",
      "src/app/routes/**/route.tsx",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
