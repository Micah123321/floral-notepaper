---
module: frontend-shell
updated_at: 2026-05-30 16:28:01
---

# 前端应用壳

## 职责

前端应用壳负责 React 应用启动、窗口路由、主窗口编辑体验、快捷便签窗口、磁贴展示和全局上下文菜单。主要文件：

- `src/main.tsx`
- `src/App.tsx`
- `src/components/MainWindow.tsx`
- `src/components/NotePad.tsx`
- `src/components/Tile.tsx`
- `src/components/TileShowcase.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/ContextMenu.tsx`
- `src/components/BackgroundLayer.tsx`
- `src/components/SlidingButtonGroup.tsx`

## 行为规范

- `src/main.tsx` 先读取配置中的 locale，初始化 i18next，再挂载 React。
- `src/App.tsx` 根据 `getInitialRoute()` 在 `main`、`notepad`、`tile` 三类视图之间切换。
- 应用启动后读取 `getConfig()`，应用主题、系统主题监听、Tab 缩进尺寸和语言同步。
- 配置变化通过 `config-changed` 事件同步主题、语言和编辑器缩进。
- Windows 平台拦截 `Alt+Space`，避免系统菜单影响无边框窗口体验。
- 主窗口承担笔记列表、分类、搜索、编辑、预览、外部文件、设置面板和磁贴钉屏入口。
- 快捷便签窗口支持新建/打开笔记、自动保存、转换为磁贴、窗口拖拽和边角缩放。

## 依赖关系

- 依赖 `src/features/notes/api.ts` 读写笔记和分类。
- 依赖 `src/features/settings/api.ts` 读写配置。
- 依赖 `src/features/windows/api.ts` 打开便签、磁贴和编辑器窗口。
- 依赖 `src/features/windows/controls.ts` 控制当前窗口。
- 依赖 `src/features/markdown/MarkdownPreview.tsx` 渲染预览。
- 依赖 `src/locales/` 获取用户可见文案。

## 维护注意

- `MainWindow.tsx` 当前体积较大，新增功能时优先抽出 hook、子组件或 feature service，避免继续扩大单文件职责。
- 用户可见长文案应进入本地化 JSON；组件内只保留简短标签或默认值。
- 主窗口和便签窗口的保存行为依赖 `saveState`、`status` 和自动保存定时器，改动时需要覆盖脏数据、外部文件和切换笔记场景。
- 磁贴状态依赖 `tile-window-closed` 与 `tile-window-unpinned` 事件同步，窗口标签规则不要随意改变。

