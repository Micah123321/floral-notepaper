# 任务清单: object-storage-paste-upload

> **@status:** completed | 2026-06-02 16:46

```yaml
@feature: object-storage-paste-upload
@created: 2026-06-02
@status: completed
@mode: R2
```

## LIVE_STATUS

```json
{
  "status": "completed",
  "completed": 11,
  "failed": 0,
  "pending": 0,
  "total": 11,
  "percent": 100,
  "current": "已归档到 archive/2026-06",
  "updated_at": "2026-06-02 16:46:22",
  "skipped": 0,
  "uncertain": 0,
  "done": 11
}
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
| ---- | ---- | ---- | ---- |
| 11   | 0    | 0    | 11   |

---

## 任务列表

### 1. Rust 对象存储配置与上传服务

- [√] 1.1 修改 `src-tauri/src/services/notes.rs`
  - 预期变更: 在 `AppConfig` 中新增 `ObjectStorageConfig` 和默认值；旧配置加载保持兼容；默认关闭对象存储。
  - 完成标准: 默认配置含 `objectStorage.enabled=false`、`region=auto`、`objectPrefix=floral-notepaper`；旧 JSON 未含字段时可正常加载。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml reads_and_writes_config_json loads_legacy_config_with_note_surface_auto_save_enabled`
  - depends_on: []

- [√] 1.2 新建 `src-tauri/src/services/object_storage.rs`
  - 预期变更: 实现 `ObjectStorageService`、`ObjectUpload`、配置校验、对象 key 生成、public URL 生成和 SigV4 PUT 上传。
  - 完成标准: 配置不完整返回 `objectStorageConfigIncomplete`；endpoint/public URL 无效返回 `objectStorageConfigInvalid`；签名 header 和对象 key 可单测验证。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml object_storage`
  - depends_on: [1.1]

- [√] 1.3 修改 `src-tauri/src/services/mod.rs`、`src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`
  - 预期变更: 导出对象存储服务；新增 `notes_upload_object_attachment` command；补充 `hmac`、`sha2`、`hex` 依赖。
  - 完成标准: 前端可 invoke 上传 command；Rust 编译可解析新增依赖和类型。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
  - depends_on: [1.2]

- [√] 1.4 修改 `src-tauri/src/services/sync.rs`
  - 预期变更: WebDAV 快照构建时清空对象存储配置，恢复快照时保留本机对象存储配置。
  - 完成标准: 快照测试证明 objectStorage 不包含密钥；恢复测试证明本机配置不被覆盖。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml object_storage`
  - depends_on: [1.1]

### 2. 前端配置、粘贴上传和预览插入

- [√] 2.1 修改 `src/features/settings/types.ts`、`src/features/settings/api.test.ts`
  - 预期变更: 增加 `ObjectStorageConfig` 类型并更新 AppConfig 测试夹具。
  - 完成标准: TypeScript 配置对象与 Rust `AppConfig` camelCase 字段一致。
  - 验证方式: `npm run test -- src/features/settings/api.test.ts`
  - depends_on: [1.1]

- [√] 2.2 修改 `src/features/notes/types.ts`、`src/features/notes/api.ts`、`src/features/notes/attachments.ts`
  - 预期变更: 增加 `ObjectUpload` 类型、上传 API、对象存储错误本地化、Markdown 生成和配置完整性 helper。
  - 完成标准: 图片生成 `![name](url)`，普通文件生成 `[name](url)`；API command 名称与 Rust 一致。
  - 验证方式: `npm run test -- src/features/notes/attachments.test.ts src/features/notes/api.test.ts`
  - depends_on: [1.3, 2.1]

- [√] 2.3 新建 `src/components/ObjectStorageSection.tsx` 并修改 `src/components/SettingsPanel.tsx`
  - 预期变更: 设置面板新增 R2/S3 对象存储区块，包含启用、endpoint、region、bucket、access key、secret key、公开地址和对象目录。
  - 完成标准: 360px 设置侧栏内不溢出；字段文案短；不影响 WebDAV 区块。
  - 验证方式: `npm run build`
  - depends_on: [2.1]

- [√] 2.4 修改 `src/components/MainWindow.tsx`
  - 预期变更: 编辑区支持粘贴图片/文件；未配置对象存储时打开设置面板；配置完整时上传并插入 Markdown。
  - 完成标准: 只在内部笔记中触发；上传中显示状态；失败时使用现有错误条；原有本地附件按钮不受影响。
  - 验证方式: `npm run build`，必要时人工粘贴检查。
  - depends_on: [2.2, 2.3]

### 3. 文案、知识库、验证和交付

- [√] 3.1 修改 `src/locales/zh-CN/translation.json`、`src/locales/zh-HK/translation.json`、`src/locales/en-US/translation.json`
  - 预期变更: 补齐对象存储设置、粘贴上传状态和错误文案。
  - 完成标准: 三语 JSON 语法合法；资源测试通过。
  - 验证方式: `npm run test -- src/locales/resources.test.ts src/locales/locale-whitelist.test.ts`
  - depends_on: [2.2, 2.3, 2.4]

- [√] 3.2 同步 `.helloagents/modules/*`、`.helloagents/CHANGELOG.md` 和 `开发文档.md`
  - 预期变更: 记录对象存储配置字段、上传 command、粘贴行为、验证方式和安全边界。
  - 完成标准: 知识库与代码事实一致；CHANGELOG 包含本方案包链接和决策 ID。
  - 验证方式: 人工检查文档对应代码事实。
  - depends_on: [1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1]

- [√] 3.3 运行验证、自动 review、修复问题并 commit
  - 预期变更: 执行前端测试、lint、build、Rust 测试；审查当前改动；修复阻断问题；创建双语 commit。
  - 完成标准: 验证通过或记录环境型失败；review 无阻断问题；Git 有新 commit。
  - 验证方式: `npm run test`、`npm run lint`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`git log -1 --oneline`
  - depends_on: [3.2]

---

## 执行日志

| 时间             | 任务    | 状态        | 备注                                                                                                    |
| ---------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| 2026-06-02 16:08 | DESIGN  | completed   | 已确认对象存储方案；子代理因当前工具策略限制降级为主代理直接执行                                        |
| 2026-06-02 16:35 | DEVELOP | completed   | 已实现 Rust 对象存储上传、设置区、粘贴上传、测试和知识库同步                                            |
| 2026-06-02 16:35 | VERIFY  | in_progress | 已通过定向测试和构建，准备运行全量验证与自动 review                                                     |
| 2026-06-02 16:46 | VERIFY  | completed   | `npm run test`、`npm run lint`、`npm run build`、`cargo test` 通过；review 修复粘贴竞态和 MIME 图片识别 |

---

## 执行备注

- 用户确认选项 `1 5`: 对象存储方案 + 全自动执行。
- 对象存储公开 URL 由 `publicBaseUrl` 生成；用户需要保证 bucket 或对应前缀可公开访问。
- 本次不执行真实 R2/S3 上传验证，不接触真实凭据。
