# Tukdam

以自然聊天积累概念图、理解证据和教程的个人学习客户端。

当前技术栈是 **React + TypeScript + Vite + Tauri 2**。界面使用经过产品适配的 Beautiful UI 组件、Iconoir 图标和官方 shadcn/ui Zinc 明暗项目。

## 运行

需要 Node.js 24+；桌面开发还需要 Rust 和对应平台的 Tauri 系统依赖。

```sh
npm ci
npm run dev
```

浏览器打开 http://localhost:1420。

```sh
npm run desktop
npm run check:fixtures
npm run build
npm run tauri build -- --no-bundle
```

`desktop` 在本机 Linux Wayland 上为子进程设置 WebKit DMA-BUF 兼容选项，保留显式环境配置。已有本项目预览时复用开发服务。Windows、macOS 和 Linux 的构建流程保留在 GitHub Actions 中。

## 界面与数据边界

产品要求以 [产品需求文档](docs/product-requirements.md) 为准。

- 聊天为主入口，新对话不要求先建图或确定项目。
- 侧栏展开为 275px；收起后含外层间距的总横向占位为 52px，侧栏按项目及项目内会话组织，独立会话单列。
- 教程、概念图和待处理事项打开在聊天旁的辅助窗格中；窗格支持调整宽度。
- 教程保留目录、章节和源对话。选中文字或章节可创建带引用的新对话，保存原文、章节版本和来源消息 ID。
- 回答后可创建项目或归入已有项目，名称可修改。归属需要明确确认；暂不处理保留独立会话和请求。项目内的新会话可直接绑定项目。
- 新的完整回答在归属确认后增量进入教程，按消息 ID 去重；章节修订不会改写历史引用。
- 默认对话不含主动小测；用户明确请求时才显示练习反馈。阅读不会提高理解状态。
- 教程更新失败时旧版本仍可读，待处理入口支持恢复操作。

这是使用固定教学数据的前端实现。尚未接入真实模型、语义归属推断、概念提取、知识追踪或 Rust 数据库。模型选择不表示已配置对应服务。实验估计是样本数据，不能当作经过校准的用户能力。练习反馈不是理解状态更新。

项目、会话、草稿、引用、决策和教程保存在当前 WebView/浏览器的 `localStorage`，命名空间为 `tukdam.workspace.v2`。浏览器与桌面各自保存数据；v1 工作区读取后复制到 v2，保留聊天、草稿、章节和历史引用；旧命名空间不删除。旧的父主题扩展请求不自动变成项目移动授权，其记录保留在 v1。写入失败会显示未保存并提供重试。该存储方式适用于当前前端阶段，正式持久化、并发和任务恢复仍需后续实现与验证。

## 结构

```text
src/
  app/                   应用入口、窗口栏与整体布局
  features/
    chat/                消息呈现与按需练习
    tutorials/               教程阅读、目录、引用与来源
    decisions/           范围选择与明确确认
    map/                 概念图与证据查看
    workspace/           工作区状态和辅助窗格
  components/
    atoms/               使用中的 Beautiful UI 基础组件
    primitives/          使用中的 Beautiful UI 组合组件
  types/                 学习内容与工作区数据契约
  mock-data/             集中的固定样本与种子状态
  lib/                   公共样式工具
src-tauri/               Rust 入口、权限、构建与桌面图标
scripts/                 桌面启动和样本一致性检查
```

React 没有强制的项目目录规范；这里按应用、业务功能、共享组件、类型和样本数据分层。Vite 和 Tauri 保持其正常配置入口，没有加入 Next.js 的服务端路由结构。

## 验证与来源

`check:fixtures` 检查项目、聊天、教程、证据及源消息引用，验证章节保留原文、默认对话不主动出题、数值状态具有观察来源。TypeScript 开启未使用局部变量及参数检查。跨平台构建配置不是 Windows/macOS 的本机运行证明。

侧栏的行高、缩进、行圆角和密度对照本机 Codex 安装包与用户截图检查；实现仍由当前组件组成。

Beautiful UI 的源版本和改动记录在 `third-party/beautiful-ui`，官方 Zinc 配色及许可在 `third-party/shadcn-ui`。保留所有必要的第三方许可。历史界面、组件展示页、未使用组件与依赖、旧截图和移动平台图标已移除。

## 许可证

Tukdam 的原创代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，著作权归属沿用现有声明：Copyright (c) 2026 Dylan。

该许可允许条款规定的非商用使用、修改和分发，不授予一般商业使用权限。商业使用需要向著作权人另行取得授权。条款对慈善组织、教育机构、公共研究机构、公共安全或健康组织、环保组织及政府机构的使用另有明确许可；具体范围以 LICENSE 原文为准。

这是允许查看源码、限制商业用途的软件许可，不是 [OSI 定义的开源许可](https://opensource.org/osd)。

第三方组件、素材与依赖继续适用各自许可证，不受本项目原创代码的非商用条款替代。Beautiful UI、shadcn/ui 的 MIT 许可及来源说明保留在 `third-party/` 中。
