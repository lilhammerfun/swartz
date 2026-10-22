# Tukdam

[English](README.md) · 简体中文

通过与 AI 交流，逐渐构建一本属于自己的学习之书。

Tukdam 关注解释、例子背后的知识组织：概念如何分类，知识如何分层，以及它们之间有什么联系。阅读与提问相互推动，让学习成果逐渐形成可以回读、持续完善的体系。

目前处于早期开发阶段，已支持阅读、原文提问和书内讨论，自动组织与修订书稿仍在探索中。

## 本地运行

需要 Node.js 24+、Rust stable 和 [Tauri 平台依赖](https://tauri.app/start/prerequisites/)。

```sh
git clone https://github.com/lilhammerfun/tukdam.git
cd tukdam
npm ci
npm run desktop
```

浏览器预览使用 `npm run dev`。AI 交流需在 Settings 中连接自己的模型服务。

## 许可证

[PolyForm Noncommercial 1.0.0](LICENSE)。第三方组件与字体的许可证见 [third-party](third-party/)。
