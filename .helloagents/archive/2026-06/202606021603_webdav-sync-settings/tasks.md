# 任务清单: webdav-sync-settings

> **@status:** completed | 2026-06-02 16:42

```yaml
@feature: webdav-sync-settings
@created: 2026-06-02
@status: completed
@mode: R2
```

## LIVE_STATUS

```json
{
  "status": "completed",
  "completed": 8,
  "failed": 0,
  "pending": 0,
  "total": 8,
  "percent": 100,
  "current": "已归档到 archive/2026-06",
  "updated_at": "2026-06-02 16:42:29",
  "skipped": 0,
  "uncertain": 0,
  "done": 8
}
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
| ---- | ---- | ---- | ---- |
| 8    | 0    | 0    | 8    |

---

## 任务列表

### 1. 后端同步模型

- [√] 1.1 修改 `src-tauri/src/services/notes.rs`
  - 预期变更: 扩展 `WebdavConfig`，新增启动同步、冲突策略和本机同步签名默认值；更新 Rust 配置测试和桌面壳测试夹具。
  - 完成标准: 旧配置可加载，新默认值为 `syncOnStartup=false`、`conflictStrategy=ask`。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml reads_and_writes_config_json loads_legacy_config_with_note_surface_auto_save_enabled`
  - depends_on: []

- [√] 1.2 修改 `src-tauri/src/services/sync.rs` 与 `src-tauri/src/lib.rs`
  - 预期变更: 新增快照签名、同步状态检查、推荐动作、上传/下载后同步基线更新和 `sync_webdav_status` command。
  - 完成标准: 后端能区分已同步、远端缺失、仅本地变化、仅远端变化和冲突场景。
  - 验证方式: 新增 Rust 单元测试；`cargo test --manifest-path src-tauri/Cargo.toml sync`
  - depends_on: [1.1]

### 2. 前端配置与启动流程

- [√] 2.1 修改 `src/features/settings/types.ts`、`api.ts` 和新增策略工具
  - 预期变更: 增加 WebDAV 策略类型、状态 API、策略解析函数和对应测试。
  - 完成标准: TypeScript API 与 Rust command 名称一致，策略解析覆盖 `ask`、本机优先、远端优先。
  - 验证方式: `npm run test -- src/features/settings/api.test.ts src/features/settings/webdavSync.test.ts`
  - depends_on: [1.2]

- [√] 2.2 修改 `src/components/WebdavSyncSection.tsx`
  - 预期变更: 设置区始终显示；新增启动自动同步、冲突策略、检查状态和同步按钮。
  - 完成标准: 开关切换不会让配置和操作入口消失；按钮禁用/运行/错误状态清晰。
  - 验证方式: `npm run build`，代码级 UI 审查。
  - depends_on: [2.1]

- [√] 2.3 修改 `src/components/MainWindow.tsx`
  - 预期变更: 主窗口启动时按 `syncOnStartup` 和策略执行 WebDAV 同步，然后加载笔记和分类。
  - 完成标准: 默认不触发网络请求；启用后错误可见且不阻断本地启动。
  - 验证方式: `npm run build`，策略函数测试间接覆盖。
  - depends_on: [2.1]

### 3. 文案、文档与知识库

- [√] 3.1 修改三语 translation JSON 与错误本地化
  - 预期变更: 补充同步策略、检查状态、启动自动同步、冲突提示和状态文案。
  - 完成标准: 三语 JSON 合法，文案短且适合 360px 设置面板。
  - 验证方式: `npm run test -- src/locales/resources.test.ts`
  - depends_on: [2.2]

- [√] 3.2 修改 `开发文档.md` 和 `.helloagents/modules/*`
  - 预期变更: 记录 WebDAV 自动同步配置、冲突策略、状态 command 和同步基线。
  - 完成标准: 文档与代码事实一致。
  - 验证方式: 人工核对相关章节。
  - depends_on: [1.2, 2.3, 3.1]

### 4. 验证与交付

- [√] 4.1 运行验证、审查并提交
  - 预期变更: 运行前端测试、lint、build、Rust 测试；自动执行 review；创建 git commit。
  - 完成标准: 验证结论明确；commit 包含本次改动。
  - 验证方式: `npm run test`、`npm run lint`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`git log -1 --stat`
  - depends_on: [3.2]

---

## 执行日志

| 时间                | 任务    | 状态        | 备注                                                                 |
| ------------------- | ------- | ----------- | -------------------------------------------------------------------- |
| 2026-06-02 16:03:00 | DESIGN  | completed   | 已确定采用快照签名和默认询问策略                                     |
| 2026-06-02 16:03:00 | DEVELOP | in_progress | 开始实现 WebDAV 同步配置和启动同步                                   |
| 2026-06-02 16:23:00 | DEVELOP | completed   | 已完成后端状态检查、前端设置区、启动同步、测试和文档同步             |
| 2026-06-02 16:23:00 | VERIFY  | in_progress | 开始全量验证和自动审查                                               |
| 2026-06-02 16:28:00 | VERIFY  | completed   | `npm run test`、`npm run lint`、`npm run build`、`cargo test` 均通过 |

---

## 执行备注

- 默认不启用启动自动同步。
- 默认冲突策略为询问，避免静默覆盖。
- `lastSyncSignature` 是本机同步基线，不上传到远端快照。
