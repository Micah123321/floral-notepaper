# 任务清单: reminder-presets

> **@status:** completed | 2026-05-30 18:16

```yaml
@feature: reminder-presets
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
  "current": "已完成并归档到 archive/2026-05",
  "updated_at": "2026-05-30 18:18:00",
  "skipped": 0,
  "uncertain": 0,
  "done": 9
}
```

## 进度概览

| 完成 | 失败 | 跳过 | 总数 |
| ---- | ---- | ---- | ---- |
| 9    | 0    | 0    | 9    |

---

## 任务列表

### 1. 数据模型与解析

- [√] 1.1 修改 `src/features/notes/types.ts` 与 `src-tauri/src/services/notes.rs`
  - 预期变更: 为 NoteMetadata、Note、SaveNoteRequest 增加可选 reminder 数据模型，并保持旧数据兼容。
  - 完成标准: TypeScript 与 Rust 类型字段一致，serde 缺省可读取旧 metadata。
  - 验证方式: `npm run test -- src/features/notes/noteUtils.test.ts`；`cargo test --manifest-path src-tauri/Cargo.toml services::notes`
  - depends_on: []

- [√] 1.2 新增 `src/features/reminders/parser.ts` 与测试
  - 预期变更: 实现口语化提醒解析、预设定义、摘要格式化，覆盖一次性、每周、每月、工作日。
  - 完成标准: “明天下午四点”“每周一”“每月五号上午10点”“每个工作日”等表达返回正确 Reminder。
  - 验证方式: `npm run test -- src/features/reminders/parser.test.ts`
  - depends_on: [1.1]

### 2. 前端 UI 与保存链路

- [√] 2.1 新增 `src/components/ReminderInput.tsx`
  - 预期变更: 提供提醒输入框、预设按钮、识别摘要、清除按钮和可访问标签。
  - 完成标准: 组件只负责 UI 和事件，不直接调用 Tauri；文本不溢出；窄宽度可换行。
  - 验证方式: TypeScript 编译；人工检查组件结构。
  - depends_on: [1.2]

- [√] 2.2 修改 `src/components/MainWindow.tsx`
  - 预期变更: 在内部笔记编辑区接入 ReminderInput，将 reminder 随 updateNote 保存、读取、清除，并在列表/标题信息区展示摘要。
  - 完成标准: 内部笔记可设置和保存提醒；外部文件不显示或不保存本地 reminder；切换笔记状态正确。
  - 验证方式: `npm run test`；人工运行 `npm run dev` 时检查主窗口行为。
  - depends_on: [2.1]

- [√] 2.3 视需要修改 `src/features/notes/noteUtils.ts`
  - 预期变更: metadataFromNote 保留 reminder；必要时提供列表摘要辅助函数。
  - 完成标准: reminder 不因前端 metadata 转换丢失。
  - 验证方式: `npm run test -- src/features/notes/noteUtils.test.ts`
  - depends_on: [1.1]

### 3. 本地化与样式

- [√] 3.1 修改 `src/locales/zh-CN/translation.json`、`src/locales/zh-HK/translation.json`、`src/locales/en-US/translation.json`
  - 预期变更: 增加提醒输入、预设、识别摘要、清除、未识别状态文案。
  - 完成标准: 三种语言资源结构一致，资源测试通过。
  - 验证方式: `npm run test -- src/locales/resources.test.ts src/locales/locale-whitelist.test.ts`
  - depends_on: [2.1]

- [√] 3.2 修改 `src/App.css` 或组件 class
  - 预期变更: 补充提醒控件的纸签风格、换行和状态样式。
  - 完成标准: 控件与现有视觉一致，移动/窄窗口不遮挡编辑内容。
  - 验证方式: `npm run test -- tests/AppCss.test.ts`；人工 UI 检查。
  - depends_on: [2.1]

### 4. 知识库与验证

- [√] 4.1 更新 `.helloagents/modules/notes-domain.md`、`.helloagents/modules/frontend-shell.md`、`.helloagents/CHANGELOG.md` 和 `开发文档.md`
  - 预期变更: 记录 reminder 数据模型、解析范围、UI 入口和不做系统通知/外部同步的边界。
  - 完成标准: 知识库与代码行为一致。
  - 验证方式: 文件检查；`rg -n "reminder|提醒" .helloagents 开发文档.md`
  - depends_on: [1.1, 2.2]

- [√] 4.2 运行项目验证
  - 预期变更: 执行相关前端测试、Rust 测试，并按可用时间运行全量 `npm run test`。
  - 完成标准: 必需测试通过；若存在环境型失败，记录失败命令和原因。
  - 验证方式: 命令输出。
  - depends_on: [1.2, 2.2, 3.1, 3.2, 4.1]

---

## 执行日志

| 时间             | 任务    | 状态        | 备注                                                                                                                     |
| ---------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-30 18:18 | DEVELOP | completed   | 已实现 reminder 模型、解析器、主窗口提醒纸签、本地化、文档同步；前端测试/lint/build 通过，Rust 测试因本机无 cargo 未运行 |
| 2026-05-30 17:48 | DESIGN  | in_progress | 已创建方案包并填充计划                                                                                                   |

---

## 执行备注

- 本方案不接入滴答清单账号或 API。
- 本方案只保存提醒预设和提醒时间，不实现系统级通知调度。
