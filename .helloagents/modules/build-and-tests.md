---
module: build-and-tests
updated_at: 2026-05-30 18:39:00
---

# 构建与测试

## 职责

本模块记录项目的构建、测试、格式化、静态检查和发布打包流程。主要文件：

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `tests/`
- `src/**/*.test.ts`

## npm 脚本

| 命令              | 作用                     |
| ----------------- | ------------------------ |
| `npm run dev`     | 启动 Vite 开发服务器     |
| `npm run build`   | 执行 `tsc && vite build` |
| `npm run test`    | 执行 `vitest run`        |
| `npm run lint`    | 执行 `oxlint`            |
| `npm run fmt`     | 执行 `oxfmt`             |
| `npm run preview` | 预览 Vite 构建产物       |
| `npm run tauri`   | 调用 Tauri CLI           |
| `npm run prepare` | 初始化 husky             |

## Vite 配置

- Vite dev server 固定端口：`1420`
- `strictPort: true`
- Tauri dev host 通过 `TAURI_DEV_HOST` 支持移动或远程调试。
- HMR 端口为 `1421`。
- watch 忽略 `src-tauri/**`。
- Vitest setup file：`./src/locales/test-setup.ts`

## Tauri 构建配置

- `beforeDevCommand`: `npm run dev`
- `devUrl`: `http://localhost:1420`
- `beforeBuildCommand`: Windows 下先尝试结束正在运行的 `floral-notepaper.exe` 和 `花笺.exe`，再执行 `npm run build`
- `frontendDist`: `../dist`
- bundle targets：`app`、`dmg`、`nsis`
- 文件关联：`.md`、`.markdown`、`.txt`
- Windows NSIS 安装语言：简体中文

## 测试覆盖

当前测试覆盖以下方向：

- CSS 和界面样式回归：`tests/AppCss.test.ts`
- 本地化资源与白名单：`src/locales/*.test.ts`
- 笔记工具函数：`src/features/notes/noteUtils.test.ts`
- 笔记附件工具和 API：`src/features/notes/attachments.test.ts`、`src/features/notes/api.test.ts`
- Markdown 附件引用解析：`src/features/markdown/MarkdownPreview.test.ts`
- 导入导出文件名处理：`src/features/importExport/api.test.ts`
- 设置、快捷键、磁贴颜色：`src/features/settings/*.test.ts`
- 窗口路由、窗口事件、surface 模式和操作：`src/features/windows/*.test.ts`
- Rust 存储、配置、导入导出、桌面行为：`src-tauri/src/services/notes.rs` 与 `src-tauri/src/desktop.rs` 内部测试
- WebDAV 快照构建、配置清理、恢复合并和附件恢复：`src-tauri/src/services/sync.rs` 内部测试

## 验证策略

常规代码变更建议按影响范围运行：

```bash
npm run lint
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

文档或知识库变更不需要运行完整构建，但应检查文件存在、非空、结构完整和无敏感信息。

## 当前环境状态

- 2026-05-30 已通过 winget 安装 Rustup 和 Visual Studio 2022 Build Tools C++ 工具链。
- Windows PowerShell 直接调用 Rust 编译时需要先加载 `VsDevCmd.bat` 或使用包含 MSVC `link.exe` 的开发环境。
- 未加载 MSVC 开发环境时，可临时设置 `RUSTFLAGS="-C linker=rust-lld"` 运行 `cargo test --manifest-path src-tauri/Cargo.toml --no-run` 做编译检查。
- 当前附件实现验证通过：`npm run lint`、`npm run test`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`npx tauri build --debug`。
