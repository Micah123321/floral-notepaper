# 变更提案: note-attachments

## 元信息

```yaml
类型: 新功能
方案类型: implementation
优先级: P1
状态: 已确认
创建: 2026-05-30
```

---

## 1. 需求

### 背景

用户确认在当前 `floral-notepaper` React + Tauri 桌面便签应用中实现“笔记附件”，并要求附件可视化加入到笔记 Markdown 内容中。此前补充的 WebDAV/S3/R2、上传会话、分片上传、Flutter/Express 内容不落入本轮实现边界。

### 目标

- 允许用户为当前内部笔记添加图片或文件附件。
- 附件复制到应用管理的数据目录，避免直接依赖原始外部文件路径。
- 插入 Markdown 内容时使用标准图片语法或链接语法，使预览区可直接显示图片、可点击打开普通文件。
- 展示当前笔记已关联附件，支持插入和删除附件。

### 约束条件

```yaml
时间约束: 无
性能约束: 附件复制和列表读取应保持本地同步文件操作级别，不引入后台服务
兼容性约束: 继续使用 React 19 + Tauri 2 + Rust 2021；不引入 Flutter、Express 或云存储依赖
业务约束: 仅支持内部笔记；外部文件编辑模式不绑定应用附件
安全约束: 删除附件使用回收站；Markdown 预览只通过 Tauri asset protocol 访问应用管理的附件目录
```

### 验收标准

- [x] 当前笔记可通过文件选择添加图片或普通文件附件。
- [x] 图片附件插入 Markdown 后在预览区显示为图片，普通文件插入后显示为可点击链接。
- [x] 附件列表能显示文件名、类型、大小，并可重新插入或删除。
- [x] 删除笔记时关联附件目录被移入回收站。
- [x] 前端 API、本地化、Tauri command、capability 和测试同步更新。
- [x] `npm run test`、`npm run lint`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`npx tauri build --debug` 通过。

---

## 2. 方案

### 技术方案

在 Rust `NoteStore` 中新增附件领域模型和命令：附件存储在 `base_dir/attachments/{note_id}/`，添加附件时复制用户选择的源文件并返回 `NoteAttachment`。前端通过 Tauri dialog 选择文件，调用 `notes_add_attachment`，再把返回的 Markdown 片段插入当前 textarea 光标处。Markdown 预览组件拦截本地附件路径，将 `floral-attachment://{noteId}/{storedFileName}` 转换为 Tauri asset URL 渲染；图片走 `<img>`，普通文件走链接并通过 opener 打开。

### 影响范围

```yaml
涉及模块:
  - Rust 笔记存储: 新增附件复制、列表、删除、Markdown 引用生成
  - Tauri 命令注册: 新增 notes_add_attachment / notes_list_attachments / notes_delete_attachment
  - Tauri capability 与 assetProtocol: 授权命令和应用附件目录 asset 访问
  - 前端 notes API: 新增附件类型、命令封装、错误本地化
  - MainWindow: 新增附件按钮、附件条、插入/删除交互、状态反馈
  - MarkdownPreview: 支持本地附件图片可视化和文件链接打开
  - 本地化与测试: 覆盖三种语言资源、TS/Rust 单测
预计变更文件: 10-14
```

### 风险评估

| 风险                                         | 等级 | 应对                                                                                                                                                                                  |
| -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| assetProtocol scope 不覆盖用户自定义数据目录 | 中   | 使用应用管理默认附件目录，并将配置 scope 增加 `$DOCUMENT/花笺/attachments/**`、`$APPDATA/花笺/attachments/**`；环境变量自定义目录场景在测试中验证存储逻辑，运行时访问依赖 Tauri scope |
| 删除附件导致 Markdown 中残留引用             | 低   | 删除只移除附件文件，Markdown 内容由用户自行编辑；列表刷新后不再显示附件                                                                                                               |
| MainWindow 文件过大                          | 中   | 已抽 `AttachmentStrip` 子组件以降低主组件新增体积                                                                                                                                     |
| 外部文件模式误用附件                         | 低   | UI 在外部文件模式禁用附件添加和删除，只允许内部笔记                                                                                                                                   |

### 方案取舍

```yaml
唯一方案理由: 当前应用是本地优先 Tauri 便签，直接做本地附件能完整满足“可视化加入 Markdown”目标，并与现有笔记/Markdown/导入导出模型一致。
放弃的替代路径:
  - WebDAV/S3/R2 分片上传: 需要后端、认证、远端配置和失败重试机制，超出本轮用户已确认的选项 1。
  - 改造成待办事项附件: 当前仓库没有 todo 模型，改变产品边界风险过高。
  - 直接引用原始本地文件绝对路径: 容易因移动/删除源文件失效，也扩大 asset 访问范围。
回滚边界: 删除新增附件命令、前端附件 API/UI、assetProtocol scope 与测试即可回到原有笔记行为；不迁移既有笔记数据结构。
```

---

## 3. 技术设计

### 架构设计

```text
MainWindow
  -> chooseAttachmentFile()
  -> notes_add_attachment(noteId, sourcePath)
  -> NoteStore::add_attachment()
  -> base_dir/attachments/{note_id}/{uuid.ext}
  -> insert Markdown: ![name](floral-attachment://noteId/file) 或 [name](floral-attachment://noteId/file)
  -> MarkdownPreview converts floral-attachment:// to asset URL
```

### API 设计

#### Tauri command: notes_add_attachment

- 请求: `{ noteId: string, sourcePath: string }`
- 响应: `NoteAttachment`

#### Tauri command: notes_list_attachments

- 请求: `{ noteId: string }`
- 响应: `NoteAttachment[]`

#### Tauri command: notes_delete_attachment

- 请求: `{ noteId: string, attachmentId: string }`
- 响应: `void`

### 数据模型

| 字段           | 类型       | 说明                                        |
| -------------- | ---------- | ------------------------------------------- |
| id             | string     | 附件 ID，使用 UUID                          |
| noteId         | string     | 所属笔记 ID                                 |
| fileName       | string     | 原始显示文件名                              |
| storedFileName | string     | 应用附件目录内的安全文件名                  |
| path           | string     | 附件绝对路径                                |
| markdownUrl    | string     | Markdown 使用的 `floral-attachment://` 引用 |
| mimeGroup      | image/file | 简化类型，用于插入语法和 UI                 |
| size           | number     | 字节数                                      |
| updatedAt      | string     | ISO 时间字符串                              |

---

## 4. 核心场景

### 场景: 添加图片附件并插入 Markdown

**模块**: frontend-shell / notes-domain / markdown-rendering
**条件**: 当前选择内部笔记且源文件为图片
**行为**: 用户点击附件按钮选择图片，应用复制文件并在光标处插入 `![文件名](floral-attachment://...)`
**结果**: 分栏或预览模式中显示图片。

### 场景: 添加普通文件附件并插入 Markdown

**模块**: frontend-shell / notes-domain / markdown-rendering
**条件**: 当前选择内部笔记且源文件不是图片
**行为**: 用户选择文件，应用复制文件并插入 `[文件名](floral-attachment://...)`
**结果**: 预览区显示可点击文件链接，点击后通过 opener 打开。

### 场景: 删除附件

**模块**: notes-domain
**条件**: 当前笔记存在附件
**行为**: 用户在附件条删除附件
**结果**: 附件文件移入回收站，附件列表刷新；笔记 Markdown 内容不自动改写。

---

## 5. 技术决策

### note-attachments#D001: 使用本地附件目录和自定义 Markdown 引用协议

**日期**: 2026-05-30
**状态**: ✅采纳
**背景**: 需要让附件稳定随笔记存在，并在 Markdown 内容中可视化呈现。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 复制到应用附件目录并使用 `floral-attachment://` | 稳定、可控、易限制访问范围、便于后续迁移云同步 | 需要 MarkdownPreview 做 URL 转换 |
| B: 直接使用源文件绝对路径 | 实现简单 | 源文件移动即失效，asset 访问范围难以收敛 |
| C: base64 内联到 Markdown | 导出自包含 | Markdown 体积暴涨，编辑体验差 |
**决策**: 选择方案 A
**理由**: 最符合本地优先桌面应用的数据所有权与安全边界，并为后续同步适配保留清晰入口。
**影响**: Rust 存储、Tauri assetProtocol、MarkdownPreview、MainWindow 附件 UI。

---

## 6. 验证策略

```yaml
verifyMode: test-first
reviewerFocus:
  - src-tauri/src/services/notes.rs 附件路径安全、删除行为和笔记删除联动
  - src/features/markdown/MarkdownPreview.tsx 本地附件 URL 转换和外部链接边界
  - src/components/MainWindow.tsx 外部文件模式禁用附件与 autosave 交互
testerFocus:
  - npm run lint
  - npm run test
  - npm run build
  - cargo test --manifest-path src-tauri/Cargo.toml
  - npx tauri build --debug
uiValidation: required
riskBoundary:
  - 不引入云存储、上传会话、后端服务或待办事项模型
  - 不扩大到任意本地路径 asset 访问
  - 不物理删除用户附件，删除走回收站
```

---

## 7. 成果设计

### 设计方向

- **美学基调**: 纸上夹片式附件条，延续花笺的温润纸感和竹绿色，但用更细密的信息排布表达“笔记里夹着实物素材”的感觉。
- **记忆点**: 编辑区顶部出现一条像纸夹/标签带的附件胶片，图片和文件以小型可视标签附着在正文上方。
- **参考**: 现有 `MainWindow` 的纸张、墨色、竹绿色、柔和边框与轻微动效。

### 视觉要素

- **配色**: 纸色 `#f6f3ec`、暖纸 `#f0ebe0`、竹绿 `#2d5a3d`，附件危险操作沿用柔红背景。
- **字体**: 继续使用项目内 `HarmonyOS Sans SC`，保持现有应用一致性。
- **布局**: 编辑标题下方或工具栏附近放置横向附件条；附件 chip 固定高度，名称截断，图片/文件用不同图标区分。
- **动效**: 添加附件后列表轻微淡入；删除按钮 hover 时显现，避免长期视觉噪音。
- **氛围**: 使用半透明纸面、细边框和轻阴影表达附件浮在纸面上，而不是独立卡片堆叠。

### 技术约束

- **可访问性**: 附件按钮、插入、删除必须有 `title`/`aria-label`；禁用态明确。
- **响应式**: 附件条横向滚动，不挤压编辑器；窄窗口保持单行可扫读。
