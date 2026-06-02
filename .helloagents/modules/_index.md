---
updated_at: 2026-06-02 16:35:00
---

# 模块索引

| 模块             | 文档                                          | 主要路径                                                                               | 职责                                                            |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 前端应用壳       | `frontend-shell.md`                           | `src/App.tsx`, `src/components/`                                                       | 路由入口、主窗口、便签窗口、磁贴、基础界面                      |
| 笔记领域         | `notes-domain.md`                             | `src/features/notes/`, `src/features/importExport/`, `src-tauri/src/services/notes.rs` | 笔记 CRUD、分类、外部文件、导入导出和错误归一                   |
| 桌面壳           | `desktop-shell.md`                            | `src/features/windows/`, `src-tauri/src/desktop.rs`                                    | Tauri 窗口、托盘、快捷键、窗口池、生命周期                      |
| 设置与本地化     | `settings-localization.md`                    | `src/features/settings/`, `src/locales/`                                               | 设置读写、主题、快捷键检查、多语言资源                          |
| WebDAV 同步      | `notes-domain.md`, `settings-localization.md` | `src-tauri/src/services/sync.rs`, `src/components/WebdavSyncSection.tsx`               | 显式上传/下载全量快照，覆盖可共享设置、笔记、元数据、背景和附件 |
| 对象存储粘贴上传 | `notes-domain.md`, `settings-localization.md` | `src-tauri/src/services/object_storage.rs`, `src/components/ObjectStorageSection.tsx`  | R2/S3 配置、粘贴图片/文件上传和公开 URL Markdown 插入           |
| Markdown 渲染    | `markdown-rendering.md`                       | `src/features/markdown/MarkdownPreview.tsx`                                            | Markdown、GFM、LaTeX、HTML sanitize 和链接打开                  |
| 构建与测试       | `build-and-tests.md`                          | `package.json`, `vite.config.ts`, `tests/`, `*.test.ts`                                | 开发命令、构建配置、测试入口和验证策略                          |

## 依赖关系概览

```text
React components
  -> src/features/* 前端 API 与纯函数
  -> @tauri-apps/api/core invoke
  -> Rust commands in src-tauri/src/lib.rs
  -> services::notes / desktop
  -> 本地文件系统、托盘、窗口、快捷键、插件
```

## 更新规则

- 新增或重命名模块时，同步更新本文件。
- 模块职责、接口、事件或数据模型变化时，同步更新对应模块文档。
- 如果代码与模块文档冲突，以代码为准。
