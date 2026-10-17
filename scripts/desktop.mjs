import { spawn } from "node:child_process";
// Work around this Linux Wayland/WebKit DMA-BUF renderer incompatibility
// for this child process only. An explicit user setting always wins.
const env = { ...process.env };
if (process.platform === "linux" && env.WAYLAND_DISPLAY) {
  env.WEBKIT_DISABLE_DMABUF_RENDERER ??= "1";
}
const executable = "node_modules/@tauri-apps/cli/tauri.js";
const args = [executable, "dev"];
// Reuse this project's browser preview instead of competing for its port.
try {
  const page = await fetch("http://127.0.0.1:1420", {
    signal: AbortSignal.timeout(1000),
  });
  if (page.ok && (await page.text()).includes("<title>Tukdam</title>")) {
    args.push(
      "--config",
      JSON.stringify({ build: { beforeDevCommand: null } }),
    );
  }
} catch {
  /* Tauri will start the normal development server. */
}
const child = spawn(process.execPath, args, {
  env,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
