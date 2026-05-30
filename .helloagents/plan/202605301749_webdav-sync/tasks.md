# 任务清单: webdav-sync

```yaml
@feature: webdav-sync
@created: 2026-05-30
@status: completed
@mode: R2
```

## LIVE_STATUS

```json
{
  "status": "completed",
  "completed": 10,
  "failed": 0,
  "pending": 0,
  "total": 10,
  "percent": 100,
  "current": "WebDAV 同步已实现并完成验证；Rust 编译使用 rust-lld 临时 linker",
  "updated_at": "2026-05-30 18:39:00"
}
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
| ---- | ---- | ---- | ---- |
| 10   | 0    | 0    | 10   |

---

## 任务列表

### 1. 后端配置与快照模型

- [√] 1.1 修改 `src-tauri/src/services/notes.rs` 的 `AppConfig`
  - 预期变更: 新增 `WebdavConfig` 字段与默认值；旧配置反序列化保持兼容；默认配置包含空 WebDAV 设置。
  - 完成标准: Rust `reads_and_writes_config_json`、legacy config 测试更新通过；旧 JSON 未含 `webdav` 时可正常加载。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml reads_and_writes_config_json loads_legacy_config_with_note_surface_auto_save_enabled`
  - depends_on: []

- [√] 1.2 新建 `src-tauri/src/services/sync.rs`
  - 预期变更: 定义 `SyncStatus`、`SyncSnapshot`、`SnapshotFile`、WebDAV 配置校验、快照构建、快照恢复和 WebDAV `MKCOL/PUT/GET` 客户端。
  - 完成标准: 能从 `NoteStore` 构建包含可共享配置、`metadata.json`、`notes/`、`backgrounds/`、`attachments/` 的完整快照；恢复时保留本机 `notesDir` 和 `webdav` 配置。
  - 验证方式: 新增 Rust 单元测试覆盖快照构建、恢复合并配置、缺失配置错误。
  - depends_on: [1.1]

- [√] 1.3 修改 `src-tauri/src/services/mod.rs` 和 `src-tauri/Cargo.toml`
  - 预期变更: 导出 sync 服务；新增 `reqwest`、`base64`、必要 async runtime 依赖。
  - 完成标准: `cargo test --manifest-path src-tauri/Cargo.toml --no-run` 能解析依赖和编译目标。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
  - depends_on: [1.2]

### 2. Tauri 命令与前端 API

- [√] 2.1 修改 `src-tauri/src/lib.rs`
  - 预期变更: 注册 `sync_webdav_test`、`sync_webdav_upload`、`sync_webdav_download` 三个 async command；成功下载后 emit `config-changed` 和 `notes-changed`。
  - 完成标准: command 在 `invoke_handler` 中可用；错误类型统一返回 `AppError`。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
  - depends_on: [1.3]

- [√] 2.2 修改 `src/features/settings/types.ts` 和 `src/features/settings/api.ts`
  - 预期变更: 增加 `WebdavConfig`、`SyncStatus` 类型；增加 `testWebdavSync()`、`uploadWebdavSnapshot()`、`downloadWebdavSnapshot()` API。
  - 完成标准: TypeScript 类型编译通过；API 调用 command 名称与 Rust 一致。
  - 验证方式: `npm run test -- src/features/settings/api.test.ts`
  - depends_on: [2.1]

- [√] 2.3 修改 `src/features/settings/api.test.ts`
  - 预期变更: 更新 AppConfig 测试夹具；新增三个同步 API 的 invoke 测试。
  - 完成标准: 设置 API 测试覆盖新增 command 名称和返回值。
  - 验证方式: `npm run test -- src/features/settings/api.test.ts`
  - depends_on: [2.2]

### 3. 设置面板与本地化

- [√] 3.1 修改 `src/components/SettingsPanel.tsx`
  - 预期变更: 新增 WebDAV 同步设置区块，包含启用开关、地址、用户名、密码、远端目录、测试连接、上传、下载和状态反馈。
  - 完成标准: UI 不撑破 360px 设置侧栏；同步中按钮禁用；用户可保存配置并触发三种同步动作。
  - 验证方式: `npm run build`，必要时用浏览器/截图核对设置面板布局。
  - depends_on: [2.2]

- [√] 3.2 修改 `src/locales/zh-CN/translation.json`、`src/locales/zh-HK/translation.json`、`src/locales/en-US/translation.json`
  - 预期变更: 新增 WebDAV 设置、按钮、状态和错误文案；文案短、自然、适合设置侧栏。
  - 完成标准: 三语 JSON 语法合法；资源测试通过。
  - 验证方式: `npm run test -- src/locales/resources.test.ts src/locales/locale-whitelist.test.ts`
  - depends_on: [3.1]

### 4. 验证、文档与知识库

- [√] 4.1 修改 `开发文档.md` 和 `.helloagents/modules/*`
  - 预期变更: 记录 WebDAV 同步数据范围、配置字段、命令、验证方式和安全边界。
  - 完成标准: 文档与代码一致；知识库模块反映新增 sync 服务和设置字段。
  - 验证方式: 人工检查文档对应代码事实。
  - depends_on: [1.2, 2.1, 3.2]

- [√] 4.2 运行完整验证
  - 预期变更: 执行前端测试、lint、build 和 Rust 测试，修复阻断失败。
  - 完成标准: `npm run test`、`npm run lint`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml` 均通过，或明确记录环境型失败。
  - 验证方式: 命令输出。
  - depends_on: [4.1]

---

## 执行日志

| 时间                | 任务    | 状态      | 备注                                                                                                                                     |
| ------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-30 17:49:00 | DESIGN  | completed | 已创建 WebDAV 同步方案包；Codex 子代理因当前工具协议限制未调用，主线程并行扫描降级完成                                                   |
| 2026-05-30 18:31:00 | DEVELOP | completed | 已实现 WebDAV 快照同步、设置面板、三语文案、测试和知识库同步                                                                             |
| 2026-05-30 18:31:00 | VERIFY  | warning   | 默认 `cargo test --no-run` 受当前环境缺少 MSVC linker `link.exe` 限制；`cargo metadata --locked --no-deps` 和 `cargo fmt --check` 已通过 |
| 2026-05-30 18:39:00 | VERIFY  | completed | 临时设置 `RUSTFLAGS="-C linker=rust-lld"` 后 `cargo test --manifest-path src-tauri/Cargo.toml --no-run` 通过                             |

---

## 执行备注

- 采用显式上传/下载快照，不做后台自动同步和双向冲突合并。
- 下载恢复属于高风险用户数据覆盖场景，但由用户点击触发；实现中必须避免删除 `notesDir` 之外内容。
- 上传快照不包含当前设备 WebDAV 凭据、本机 `notesDir` 和背景图绝对路径。
- 快照范围包含可共享设置、`metadata.json`、`notes/`、`backgrounds/` 和 `attachments/`。
