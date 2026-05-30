---
module: desktop-shell
updated_at: 2026-05-30 16:28:01
---

# 桌面壳

## 职责

桌面壳负责 Tauri 应用窗口、托盘菜单、全局快捷键、开机自启、单实例、启动文件、窗口池和窗口生命周期。主要文件：

- `src-tauri/src/desktop.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/services/sync.rs`
- `src/features/windows/api.ts`
- `src/features/windows/controls.ts`
- `src/features/windows/windowRoutes.ts`
- `src/features/windows/surfaceMode.ts`
- `src/features/windows/surfaceActions.ts`
- `src/features/windows/tileWindowEvents.ts`
- `src-tauri/capabilities/default.json`

## 窗口模型

- 主窗口 label：`main`
- 快捷便签窗口 label：`notepad-{uuid}` 或 `notepad-{noteId}`
- 磁贴窗口 label：`tile-{noteId}`
- 便签窗口池容量：`2`
- 便签默认尺寸：`260 x 260`
- 主窗口默认尺寸：`1180 x 760`

## 关键行为

- `show_main_window()` 打开或聚焦主窗口。
- `open_notepad_window_now()` 打开便签窗口；无 note id 时优先复用预热窗口池。
- `open_tile_window_now()` 打开常驻置顶磁贴窗口。
- `toggle_tile_window_now()` 对指定 note id 打开或关闭磁贴。
- `recycle_notepad_window()` 隐藏并回收便签窗口，池满时关闭窗口。
- `save_surface_size()` 在关闭便签或磁贴前保存窗口尺寸。
- 单实例插件在第二实例启动时把文件路径转为 `open-external-file` 事件，并显示主窗口。
- 冷启动文件路径存入 `STARTUP_FILE`，前端通过 `take_startup_file()` 消费，避免初始化竞态。
- `sync_webdav_download` 恢复远端快照后会广播 `config-changed` 和 `notes-changed`，让主窗口和其他窗口刷新运行时状态。

## 托盘与快捷键

托盘菜单项：

- 显示主窗口
- 快捷便签
- 关闭到托盘
- 开机自启
- 退出

全局快捷键：

- `globalShortcut` 默认 Windows 为 `Ctrl+Space`，macOS 为 `Command+Option+N`。
- `toggleVisibilityShortcut` 可选，用于显示/隐藏当前可见窗口。
- 快捷键配置支持 Ctrl、Alt、Shift、Meta 和字母、数字、F1-F12、常用控制键。
- macOS 会检测部分系统快捷键冲突。

## Tauri 权限

`src-tauri/capabilities/default.json` 允许窗口：

- `main`
- `notepad-*`
- `tile-*`

权限包含窗口关闭、最小化、最大化、位置尺寸、置顶、拖拽、缩放、显示隐藏、聚焦、dialog open/save 和 opener。

opener 的 `allow-open-path` 仅覆盖应用管理目录下的附件路径，用于 Markdown 预览打开本地附件链接。

## 维护注意

- 新增窗口 label 前缀时必须同步 capability、路由解析、窗口事件处理和可见性切换逻辑。
- 修改窗口尺寸行为时同步 `saved_surface_specs()`、前端 surface mode 动画和相关测试。
- 新增 tray menu 项时同步 `TrayMenuAction`、`tray_menu_action()`、`tray_menu_specs()`、菜单构建、事件处理和本地化。
- 新增全局快捷键字段时必须同步冲突检测、运行时替换逻辑和重复快捷键校验。
