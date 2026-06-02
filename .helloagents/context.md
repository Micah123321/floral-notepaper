---
project: floral-notepaper
version: 1.0.4
updated_at: 2026-05-30 18:20:00
source: code_scan
---

# 项目上下文

## 基本信息

花笺 Floral Notepaper 是一个本地桌面便签应用，目标是提供轻量、快速、现代化的 Markdown 记录体验。应用支持主窗口编辑、快捷便签窗口、桌面磁贴、Markdown 预览、导入导出、分类管理、多语言和主题设置。

项目当前是私有包配置：

- `package.json`：`private: true`
- 前端包版本：`1.0.4`
- Tauri 包版本：`1.0.4`
- Tauri identifier：`com.floral-notepaper.app`
- 产品名：`花笺`

## 技术上下文

### 前端

- React 19 + ReactDOM 19
- TypeScript 5.8
- Vite 7
- Tailwind CSS 4 Vite 插件
- i18next + react-i18next
- react-markdown + remark-gfm + remark-math
- rehype-katex、rehype-raw、rehype-sanitize
- Tauri JavaScript API、dialog plugin、opener plugin
- Vitest
- oxlint、oxfmt

### 后端和桌面壳

- Rust 2021
- Tauri 2
- Tauri plugins：`opener`、`dialog`、`autostart`、`global-shortcut`、`single-instance`
- 数据序列化：serde、serde_json
- 时间：chrono
- ID：uuid
- 删除移动到回收站：trash
- WebDAV/HTTP 客户端：reqwest
- 二进制快照编码：base64

## 项目概述

应用由 React 前端和 Tauri/Rust 后端组成：

- 前端负责界面、编辑体验、Markdown 预览、设置面板、本地化渲染和窗口内交互。
- Rust 后端负责本地文件读写、笔记元数据、配置持久化、分类管理、导入导出、窗口创建、托盘、快捷键、开机自启和窗口池。
- 前后端通过 `@tauri-apps/api/core` 的 `invoke()` 调用 Rust `#[tauri::command]`。
- 运行时事件通过 Tauri event 系统同步，如 `notes-changed`、`config-changed`、`open-note`、`open-external-file`、`tile-window-closed`。

## 数据模型与存储

默认数据目录由 `src-tauri/src/services/notes.rs` 决定：

- 设置了 `FLORAL_NOTEPAPER_DATA_DIR` 时优先使用该路径。
- macOS 默认：`~/Library/Application Support/花笺`
- Windows 默认：`%USERPROFILE%/Documents/花笺`
- 其他情况下回退到当前目录下的 `data`。

主要数据文件：

- `config.json`：应用设置。
- `metadata.json`：笔记元数据索引。
- `notes/`：Markdown 笔记文件目录。
- `backgrounds/`：复制到应用数据目录内的背景图资源。
- `attachments/`：内部笔记附件目录，按 `{noteId}/` 存放复制后的附件文件和 `attachments.json` 索引。

`notes_dir` 保存时会通过 `ensure_notes_suffix()` 规范化为以 `notes` 结尾的路径。笔记目录存在安全限制，禁止使用磁盘根目录和 Windows 系统目录。

WebDAV 同步采用单文件快照 `{remotePath}/floral-notepaper-sync.json`，覆盖可跨设备共享的设置、`metadata.json`、`notes/`、`backgrounds/` 和 `attachments/`。上传快照会清空 WebDAV 凭据、本机 `notesDir` 和本机同步基线，并把背景图路径降级为文件名；下载恢复会保留当前设备的 `notesDir`、WebDAV 凭据和同步策略。启动自动同步默认关闭，开启后主窗口启动时先检查远端状态，再按冲突策略执行上传、下载或询问。

## 开发约定

- 代码变更以现有模块边界为准，优先扩展 `src/features/*` 与 `src-tauri/src/services/*` 中已有能力。
- 前端功能 API 统一封装在 `src/features/*/api.ts`，组件不直接拼装 Tauri command 名称。
- Rust command 统一注册在 `src-tauri/src/lib.rs` 的 `invoke_handler`。
- 用户可见文案优先进入 `src/locales/*/translation.json`，不要在组件内散落长文案。
- Markdown 渲染默认不解析 HTML；只有 `renderHtmlMarkdown` 开启时才进入 `rehypeRaw + rehypeSanitize` 路径。
- 删除笔记和分类时使用回收站，不做不可逆物理删除。
- 新增设置字段需要同步 TypeScript `AppConfig`、Rust `AppConfig`、默认值、序列化兼容、设置面板和测试。
- 新增 Tauri command 需要同步 Rust command、前端 API、Tauri capability 权限和测试。
- 笔记附件只绑定内部笔记；外部文件编辑模式不创建或保存应用附件。

## 当前约束

- `MainWindow.tsx` 文件体积很大，后续新增主窗口功能时应优先拆分子组件或 hook。
- `src-tauri/src/desktop.rs` 承担窗口、托盘、快捷键、开机自启等多个职责，新增桌面壳能力时应注意局部化修改。
- `.gitignore` 当前未包含 `.helloagents/`。知识库含项目特定状态，建议由维护者确认是否加入忽略列表。
- `tauri.conf.json` 中 `beforeBuildCommand` 包含 Windows `taskkill` 命令，跨平台构建时需要注意 shell 差异。
- Tauri `security.csp` 当前为 `null`，Markdown HTML 渲染依赖前端 sanitize 防护。
