---
kb_version: 2.4.1
project: floral-notepaper
created_at: 2026-05-30 16:28:01
updated_at: 2026-05-30 16:28:01
---

# 花笺 Floral Notepaper 知识库

本知识库记录当前项目的运行事实、模块边界、开发约定和变更历史。代码是唯一事实来源；当文档与代码不一致时，以代码为准并更新文档。

## 项目摘要

- 项目名称：花笺 Floral Notepaper
- 包名：`floral-notepaper`
- 当前版本：`1.0.4`
- 产品定位：轻量、现代化的本地 Markdown 便签桌面应用
- 主要技术栈：Tauri 2、React 19、TypeScript、Vite 7、Tailwind CSS 4、Rust 2021
- 前端入口：`src/main.tsx`、`src/App.tsx`
- 后端入口：`src-tauri/src/main.rs`、`src-tauri/src/lib.rs`
- 应用配置：`src-tauri/tauri.conf.json`

## 快速索引

| 文件 | 内容 |
| --- | --- |
| `context.md` | 项目背景、技术上下文、开发约定和约束 |
| `CHANGELOG.md` | 知识库与项目变更记录 |
| `modules/_index.md` | 模块索引和职责总览 |
| `modules/frontend-shell.md` | React 应用入口、主窗口和便签界面 |
| `modules/notes-domain.md` | 笔记、分类、外部文件与导入导出领域 |
| `modules/desktop-shell.md` | Tauri 桌面窗口、托盘、快捷键和生命周期 |
| `modules/settings-localization.md` | 设置、主题、本地化和运行时配置同步 |
| `modules/markdown-rendering.md` | Markdown、GFM、数学公式、HTML 渲染和安全处理 |
| `modules/build-and-tests.md` | 构建、测试、格式化和项目验证 |
| `archive/_index.md` | 历史方案归档索引 |

## 常用命令

```bash
npm install
npm run dev
npm run tauri dev
npm run build
npm run test
npm run lint
npm run fmt
npm run tauri build
```

## 目录速览

```text
src/
  components/              React 界面组件
  features/                前端功能封装
  locales/                 i18next 本地化资源
src-tauri/
  src/                     Tauri/Rust 后端
  capabilities/            Tauri 权限声明
  icons/                   应用图标
tests/                     前端补充测试
Docs/images/               README 展示素材
.helloagents/              HelloAGENTS 项目知识库
```

## 当前初始化状态

- 知识库结构：已创建
- 核心文件：已创建
- 模块覆盖：已覆盖前端、后端、存储、窗口、设置、本地化、渲染、构建测试
- 根目录开发文档：`开发文档.md`

