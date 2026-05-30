# 任务清单: note-attachments

```yaml
@feature: note-attachments
@created: 2026-05-30
@status: completed
@mode: R2
```

## LIVE_STATUS

```json
{
  "status": "completed",
  "completed": 9,
  "failed": 0,
  "pending": 0,
  "total": 9,
  "percent": 100,
  "current": "附件功能已实现并完成前端、Rust 和 Tauri debug 构建验证",
  "updated_at": "2026-05-30 18:39:00"
}
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
| ---- | ---- | ---- | ---- |
| 9    | 0    | 0    | 9    |

---

## 任务列表

### 1. Rust 附件存储与命令

- [√] 1.1 在 `src-tauri/src/services/notes.rs` 中实现附件模型和本地存储
  - 预期变更: 新增 `NoteAttachment`、附件目录计算、添加/列表/删除附件、删除笔记时回收附件目录。
  - 完成标准: 附件复制到 `base_dir/attachments/{noteId}/`，文件名安全，图片和普通文件能生成不同 Markdown 引用。
  - 验证方式: `cargo test --manifest-path src-tauri/Cargo.toml`
  - depends_on: []

- [√] 1.2 在 `src-tauri/src/lib.rs` 与 `src-tauri/capabilities/default.json` 中注册附件命令
  - 预期变更: 新增 `notes_add_attachment`、`notes_list_attachments`、`notes_delete_attachment` Tauri command 和 capability 权限。
  - 完成标准: 前端可通过 invoke 调用命令，命令错误仍返回结构化 `AppError`。
  - 验证方式: `npm run build` 与 Rust 编译链路验证。
  - depends_on: [1.1]

- [√] 1.3 更新 `src-tauri/tauri.conf.json` 的 assetProtocol scope
  - 预期变更: 允许应用管理的附件目录通过 Tauri asset protocol 读取。
  - 完成标准: 默认 Windows/macOS 数据目录下 `attachments/**` 被授权；不授权任意本地路径。
  - 验证方式: 检查配置 JSON 与 `npm run build`。
  - depends_on: [1.1]

### 2. 前端 API、预览和 UI

- [√] 2.1 在 `src/features/notes/types.ts` 与 `src/features/notes/api.ts` 中封装附件 API
  - 预期变更: 增加 `NoteAttachment` 类型、add/list/delete 方法和附件相关错误本地化。
  - 完成标准: TypeScript 调用层不直接拼装 command 名称以外逻辑，错误信息可本地化。
  - 验证方式: `npm run test`
  - depends_on: [1.2]

- [√] 2.2 在 `src/features/markdown/MarkdownPreview.tsx` 中渲染附件图片和文件链接
  - 预期变更: 将 `floral-attachment://noteId/fileName` 转换为 asset URL；图片显示，文件链接点击打开。
  - 完成标准: HTTP/HTTPS 链接仍按原逻辑打开；非附件链接不扩大权限。
  - 验证方式: 新增或更新 Vitest 单测，运行 `npm run test`。
  - depends_on: [2.1, 1.3]

- [√] 2.3 在 `src/components/MainWindow.tsx` 中加入附件选择、列表、插入和删除交互
  - 预期变更: 内部笔记工具栏支持添加附件，标题区/编辑区附近显示附件条，可插入或删除。
  - 完成标准: 外部文件模式禁用附件；添加附件后 Markdown 插入光标处并标记 dirty；附件列表与当前笔记切换同步。
  - 验证方式: `npm run build`，必要时人工检查 UI。
  - depends_on: [2.1, 2.2]

- [√] 2.4 更新 `src/locales/*/translation.json`
  - 预期变更: 补齐三种语言的附件按钮、状态、错误和操作文案。
  - 完成标准: 资源白名单和资源合并测试通过，无缺失翻译导致的运行时 fallback。
  - 验证方式: `npm run test`
  - depends_on: [2.3]

### 3. 验证与知识库同步

- [√] 3.1 补充 TS/Rust 测试并运行项目验证
  - 预期变更: 覆盖附件复制、列表、删除、Markdown 引用生成和预览转换。
  - 完成标准: `npm run test`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml` 完成并记录结果。
  - 验证方式: 命令输出。
  - depends_on: [1.1, 2.2, 2.3, 2.4]

- [√] 3.2 同步 `.helloagents` 知识库和方案包状态
  - 预期变更: 更新相关模块文档、CHANGELOG 和任务状态。
  - 完成标准: 知识库描述与代码事实一致，方案包进度为已完成或记录未完成风险。
  - 验证方式: 文件检查。
  - depends_on: [3.1]

---

## 执行日志

| 时间             | 任务    | 状态      | 备注                                                                                                                                                                           |
| ---------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-30 17:48 | DESIGN  | completed | 已确定本地笔记附件方案，不引入云后端                                                                                                                                           |
| 2026-05-30 18:14 | 1.1-2.4 | completed | 已实现 Rust 附件存储、Tauri 命令、前端附件 API、附件条、Markdown 预览和本地化                                                                                                  |
| 2026-05-30 18:15 | 3.1     | warning   | `npm run test`、`npm run lint`、`npm run build`、JSON 解析通过；`cargo test --manifest-path src-tauri/Cargo.toml` 和 `npx tauri build --debug` 因当前环境找不到 `cargo` 未执行 |
| 2026-05-30 18:20 | 3.2     | completed | 已同步 context、notes-domain、frontend-shell、markdown-rendering、build-and-tests 和 CHANGELOG                                                                                 |
| 2026-05-30 18:39 | 3.1     | completed | 已安装 Rust/MSVC 构建链路，修正 WebDAV 同步测试的 notesDir 断言，`cargo test --manifest-path src-tauri/Cargo.toml` 与 `npx tauri build --debug` 通过                           |

---

## 执行备注

- 用户确认范围为选项 1：当前应用内的笔记附件。
- “可视化加入到笔记 Markdown 内容中”解释为：插入标准 Markdown 图片/链接语法，并在预览组件内可视化渲染本地附件。
