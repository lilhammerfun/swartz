import type { Config } from "@react-router/dev/config";

// Tauri 打包静态客户端；只在构建时生成根页面，不运行 JavaScript 服务端。
export default {
  appDirectory: "src",
  buildDirectory: "dist",
  ssr: false,
} satisfies Config;
