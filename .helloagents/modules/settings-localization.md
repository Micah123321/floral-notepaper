---
module: settings-localization
updated_at: 2026-06-02 16:35:00
---

# 设置与本地化

## 职责

设置与本地化模块负责应用配置读写、主题应用、字体和缩进、背景图、快捷键检测、语言初始化与多语言资源合并。主要文件：

- `src/features/settings/api.ts`
- `src/features/settings/types.ts`
- `src/features/settings/theme.ts`
- `src/features/settings/tileColor.ts`
- `src/features/settings/shortcutRecorder.ts`
- `src/features/settings/webdavSync.ts`
- `src/components/ObjectStorageSection.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/WebdavSyncSection.tsx`
- `src/locales/index.ts`
- `src/locales/resources.ts`
- `src/locales/locale-whitelist.ts`
- `src/locales/*/translation.json`
- `src-tauri/src/locales.rs`
- `src-tauri/src/services/notes.rs`

## 配置字段

当前前端 `AppConfig` 字段包括：

- `locale`
- `notesDir`
- `globalShortcut`
- `closeToTray`
- `autostart`
- `defaultViewMode`
- `noteAutoSave`
- `noteSurfaceAutoSave`
- `tileColor`
- `tileColorMode`
- `theme`
- `fontSize`
- `surfaceFontSize`
- `tabIndentSize`
- `externalFileAutoSave`
- `rememberSurfaceSize`
- `tileCtrlClose`
- `tileRenderMarkdown`
- `renderHtmlMarkdown`
- `surfaceWidth`
- `surfaceHeight`
- `toggleVisibilityShortcut`
- `openAtCursor`
- `backgroundImagePath`
- `backgroundFit`
- `backgroundDim`
- `backgroundBlur`
- `backgroundScale`
- `backgroundPositionX`
- `backgroundPositionY`
- `webdav.enabled`
- `webdav.endpoint`
- `webdav.username`
- `webdav.password`
- `webdav.remotePath`
- `webdav.syncOnStartup`
- `webdav.conflictStrategy`
- `webdav.lastSyncSignature`
- `objectStorage.enabled`
- `objectStorage.endpoint`
- `objectStorage.region`
- `objectStorage.bucket`
- `objectStorage.accessKeyId`
- `objectStorage.secretAccessKey`
- `objectStorage.publicBaseUrl`
- `objectStorage.objectPrefix`

## 行为规范

- 前端通过 `getConfig()` 和 `saveConfig()` 调用 Rust `config_get`、`config_save`。
- 保存配置时 Rust 会先应用运行时桌面配置，再写入配置文件。
- 快捷键或开机自启变化需要立即作用于系统插件。
- `config-changed` 事件用于同步多个窗口的主题、语言、字体、磁贴设置和编辑缩进。
- `resources.ts` 以 `zh-CN` 为基准，`en-US` 与 `zh-HK` 通过深度合并补齐缺失项。
- 主题支持 `light`、`dark`、`system`。
- 视图模式支持 `edit`、`split`、`preview`，非法值归一为 `split`。
- WebDAV 设置区在设置面板中提供启用开关、地址、用户名、密码、远端目录、启动自动同步、冲突策略、测试、检查、同步、上传和下载。
- 对象存储设置区在设置面板中提供启用开关、endpoint、region、bucket、access key、secret key、公开地址和对象目录。
- 对象存储默认关闭；前端通过 `objectStorage.enabled` 和必填字段判断粘贴上传是否可用。
- WebDAV 详情面板始终保留在设置中；禁用时操作按钮不可用，但配置入口不消失。
- 同步按钮触发前会立即保存当前设置，避免防抖保存导致后端读取旧 WebDAV 配置。
- 同步策略由 `resolveWebdavSyncAction()` 统一解析；冲突默认 `ask`，用户可改为本机优先或远端优先。
- 主窗口启动时仅在 `webdav.enabled && webdav.syncOnStartup` 时自动检查同步状态。
- WebDAV 下载成功后 Rust 会广播 `config-changed` 和 `notes-changed`，主窗口同步刷新设置、笔记和背景配置。
- WebDAV 错误码通过 `getErrorMessage()` 本地化，包括配置不完整、地址无效、远端目录失败、网络失败、快照缺失/无效、状态检查失败、上传/下载失败。
- 对象存储错误码通过 `getErrorMessage()` 本地化，包括配置不完整、配置无效、网络失败、空文件和上传失败。

## 维护注意

- 新增 locale 时同步资源导入、白名单、初始化逻辑和 README 语言入口。
- 新增配置字段时同步 Rust 默认值与旧配置反序列化默认函数，避免升级后配置读取失败。
- 运行时可立即生效的配置要通过 `config-changed` 广播到所有窗口。
- 设置面板内的用户可见文案应进入 translation JSON。
