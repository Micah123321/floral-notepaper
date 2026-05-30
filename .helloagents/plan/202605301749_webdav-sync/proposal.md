# 变更提案: webdav-sync

## 元信息

```yaml
类型: 新功能
方案类型: implementation
优先级: P1
状态: 已实现
创建: 2026-05-30
```

---

## 1. 需求

### 背景

用户要求“加入webdev 同步所有数据+设置”。结合当前项目代码，按 WebDAV 理解 `webdev`。花笺目前是本地优先桌面应用，应用数据分散在 `config.json`、`metadata.json`、用户配置的 `notesDir`、应用管理的 `backgrounds/` 和 `attachments/` 目录中，没有远端同步能力。

### 目标

- 增加 WebDAV 账号配置，支持保存服务地址、用户名、密码、远端目录和启用状态。
- 支持全量同步应用管理数据和设置，包括可共享配置、`metadata.json`、Markdown 笔记目录、背景图目录和附件目录。
- 在设置面板提供连接测试、上传本机快照、下载远端快照和同步状态反馈。
- 下载远端数据时保留当前设备本地路径和当前设备 WebDAV 凭据，避免远端配置覆盖本机连接信息。
- 上传远端快照时不写出当前设备 WebDAV 凭据、本机 `notesDir` 和背景图绝对路径。
- 同步成功后广播 `config-changed`、`notes-changed`，让主窗口和小窗刷新运行时状态。

### 约束条件

```yaml
时间约束: 无明确时间限制
性能约束: 同步以用户显式点击触发；避免后台自动同步和复杂冲突合并
兼容性约束: 保留旧 config.json 兼容；未配置 WebDAV 时现有行为不变
业务约束: 不提交真实用户数据、账号、密码或远端地址；远端快照不包含 WebDAV 密码和本机绝对路径；下载远端快照前不做不可逆删除
```

### 验收标准

- [ ] 设置面板可编辑 WebDAV 服务地址、用户名、密码、远端目录和启用状态。
- [ ] 前端 API 暴露 `testWebdavSync()`、`uploadWebdavSnapshot()`、`downloadWebdavSnapshot()`，并调用对应 Tauri command。
- [ ] Rust 后端能构建包含可共享配置、元数据、笔记、背景图和附件的同步快照。
- [ ] 上传会把快照写入 WebDAV 远端目录；下载会恢复快照并保留当前本机 `notesDir` 与 WebDAV 凭据。
- [ ] WebDAV 未配置、认证失败、远端快照不存在、快照格式不合法时返回可本地化错误。
- [ ] `npm run test`、`npm run lint`、`npm run build` 至少完成一次；Rust 单元测试覆盖同步快照和配置兼容行为。

---

## 2. 方案

### 技术方案

采用“显式快照同步”方案：

- 在 `AppConfig` 中新增 `webdav` 配置对象，使用 serde default 保证旧配置兼容。
- 新增 `src-tauri/src/services/sync.rs`，负责 WebDAV 客户端、快照构建、快照恢复和错误归一。
- 快照使用单个 JSON 文档，包含 schemaVersion、generatedAt、config、metadata、notes、backgrounds、attachments。文本笔记以 UTF-8 字符串保存，背景图和附件以 base64 保存。
- 远端固定写入 `{remotePath}/floral-notepaper-sync.json`。`remotePath` 由用户配置，后端规范化并确保 WebDAV 集合存在。
- WebDAV 传输用 `reqwest` + HTTP Basic Auth + WebDAV `MKCOL`/`PUT`/`GET`，不引入额外 WebDAV 专用抽象库。
- 前端设置面板新增“同步”区块，延续现有 360px 设置侧栏密度，使用输入框、密码框、启用开关和三个显式按钮。
- 上传快照前会清理 `config.webdav`、`notesDir` 和 `backgroundImagePath` 的本机绝对路径，避免远端快照携带设备私有信息。
- 下载远端快照时先写入临时恢复区，校验通过后再覆盖 `config.json`、`metadata.json` 和受管目录内容；本机 WebDAV 凭据与 `notesDir` 从当前配置合并回恢复后的配置，背景图文件名重映射到当前设备 `backgrounds/` 目录。
- 目录替换前会写入 `.sync-backups/` 临时备份，替换失败或元数据写入失败时尝试回滚。

### 影响范围

```yaml
涉及模块:
  - notes-domain: 增加快照读写所需的存储访问方法和同步恢复行为
  - settings-localization: 新增 WebDAV 配置字段、设置面板、前端 API 和三语文案
  - desktop-shell: 新增 Tauri command 注册、运行时事件广播
  - build-and-tests: 增加 Rust/TypeScript 测试，构建依赖增加 reqwest/base64
预计变更文件: 12-18
```

### 风险评估

| 风险                         | 等级 | 应对                                                                                                           |
| ---------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| 下载远端快照覆盖本地数据     | 高   | 仅用户显式点击下载；恢复前校验快照；保留本机连接配置与本机路径；临时备份并在失败时尝试回滚；测试覆盖恢复行为   |
| 密码明文存入本机 config.json | 中   | 当前项目无系统密钥环能力，本次先保持本地配置方式；远端快照不上传密码；文案不展示密码；后续可替换为系统凭据存储 |
| 大背景图导致 JSON 快照过大   | 中   | 背景图仅同步应用管理目录下文件；保留显式手动同步；后续可拆分资源清单                                           |
| WebDAV 服务兼容差异          | 中   | 使用标准 `MKCOL`、`PUT`、`GET`；对 `201/204/405` 视为可接受集合创建结果                                        |
| 自动冲突合并复杂且易误伤     | 中   | 本次不做双向合并，采用上传/下载两个明确方向                                                                    |

### 方案取舍

```yaml
唯一方案理由: 显式快照同步能最大限度覆盖“所有数据+设置”，实现边界清晰，便于验证和回滚，符合本地优先应用的安全预期。
放弃的替代路径:
  - 文件级双向增量同步: 需要冲突检测、删除墓碑、时间戳可信度和多设备合并策略，当前需求未指定，误伤风险高。
  - 仅同步笔记目录: 无法满足“所有数据+设置”，会遗漏配置、元数据、背景图和附件。
  - 引入完整云同步服务层: 超出当前桌面本地应用边界，部署和账号体系成本过高。
回滚边界: 可移除新增 sync 服务、WebDAV 配置字段、前端设置区块、Tauri command 和新增依赖；旧配置通过 serde default 不受影响。
```

---

## 3. 技术设计

### 架构设计

```text
SettingsPanel
  -> features/settings/api.ts
  -> Tauri commands
  -> services::sync::SyncService
  -> NoteStore(config/metadata/notes/backgrounds/attachments)
  -> WebDAV remote floral-notepaper-sync.json
```

### API 设计

#### Tauri command: `sync_webdav_test`

- 请求: 无显式参数，读取当前 `AppConfig.webdav`
- 响应: `SyncStatus`

#### Tauri command: `sync_webdav_upload`

- 请求: 无显式参数
- 响应: `SyncStatus`

#### Tauri command: `sync_webdav_download`

- 请求: 无显式参数
- 响应: `SyncStatus`

### 数据模型

| 字段                          | 类型               | 说明                                                       |
| ----------------------------- | ------------------ | ---------------------------------------------------------- |
| `AppConfig.webdav.enabled`    | bool               | 是否启用 WebDAV 设置                                       |
| `AppConfig.webdav.endpoint`   | string             | WebDAV 根地址                                              |
| `AppConfig.webdav.username`   | string             | 用户名                                                     |
| `AppConfig.webdav.password`   | string             | 密码，本次保存在本机配置                                   |
| `AppConfig.webdav.remotePath` | string             | 花笺同步文件所在远端目录                                   |
| `SyncStatus.ok`               | bool               | 操作是否成功                                               |
| `SyncStatus.message`          | string             | 后端简要状态                                               |
| `SyncStatus.syncedAt`         | string?            | 同步完成时间                                               |
| `SyncStatus.remotePath`       | string             | 实际远端快照路径                                           |
| `SyncSnapshot.schemaVersion`  | u32                | 快照格式版本，当前为 1                                     |
| `SyncSnapshot.config`         | AppConfig          | 应用配置快照                                               |
| `SyncSnapshot.metadata`       | MetadataFile       | 笔记元数据快照                                             |
| `SyncSnapshot.notes`          | Vec<SnapshotFile>  | Markdown 笔记文件                                          |
| `SyncSnapshot.backgrounds`    | Vec<SnapshotFile>  | 应用背景图文件                                             |
| `SyncSnapshot.attachments`    | Vec<SnapshotFile>? | 内部笔记附件文件和附件索引；旧快照缺失时下载不清空本机附件 |

---

## 4. 核心场景

### 场景: 首次配置 WebDAV

**模块**: settings-localization
**条件**: 用户打开设置面板
**行为**: 填写 WebDAV 地址、用户名、密码、远端目录并保存
**结果**: 配置写入 `config.json`，后续同步命令可读取凭据。

### 场景: 上传本机快照

**模块**: notes-domain / desktop-shell
**条件**: WebDAV 配置完整且远端可访问
**行为**: 用户点击上传
**结果**: 远端生成或覆盖 `floral-notepaper-sync.json`，返回同步时间和远端路径。

### 场景: 下载远端快照

**模块**: notes-domain / settings-localization
**条件**: 远端存在合法快照
**行为**: 用户点击下载
**结果**: 本机数据恢复为远端快照，当前设备 `notesDir` 与 WebDAV 配置保留，前端刷新笔记和设置。

---

## 5. 技术决策

### webdav-sync#D001: 使用单文件快照式 WebDAV 同步

**日期**: 2026-05-30
**状态**: ✅采纳
**背景**: 用户要求同步所有数据和设置，当前应用没有冲突合并或远端状态模型。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 单文件快照 | 覆盖完整、实现清晰、容易测试、回滚简单 | 大文件同步效率较低，不做冲突合并 |
| B: 文件级增量 | 对大数据更高效 | 删除和冲突语义复杂，需要额外索引 |
| C: 仅同步笔记 | 改动小 | 不满足“所有数据+设置” |
**决策**: 选择方案 A
**理由**: 当前目标优先保证数据范围完整和行为可预测；显式上传/下载能把风险留给用户可理解的操作。
**影响**: 新增同步服务、配置字段、设置 UI、测试和文档。

### webdav-sync#D002: 下载恢复时保留本机连接配置和路径

**日期**: 2026-05-30
**状态**: ✅采纳
**背景**: 远端快照可能来自另一台设备，直接覆盖 `notesDir`、WebDAV 凭据会破坏当前设备连接。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 完整覆盖 config | 与远端完全一致 | 容易写入无效本机路径或丢失当前凭据 |
| B: 保留本机设备字段 | 多设备更稳妥 | 与“完全一致”语义略有差异 |
**决策**: 选择方案 B
**理由**: `notesDir` 和 WebDAV 凭据属于设备本地运行条件，保留它们能降低同步后应用不可用风险。
**影响**: 恢复逻辑需要合并配置并测试。

### webdav-sync#D003: 远端快照不保存本机凭据和绝对路径

**日期**: 2026-05-30
**状态**: ✅采纳
**背景**: `config.json` 包含 WebDAV 密码、当前设备 `notesDir` 和背景图绝对路径，直接上传会泄露设备私有信息且跨设备不可用。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 原样上传 config | 实现简单 | 泄露凭据和本机路径，跨设备恢复风险高 |
| B: 上传前清理设备私有字段 | 保护凭据，跨设备更稳定 | 恢复时需要重映射背景路径 |
**决策**: 选择方案 B
**理由**: “同步设置”不应等于把连接凭据和本机绝对路径上传到远端；保留可共享 UI/行为设置即可满足需求。
**影响**: `build_snapshot()` 会清空 WebDAV 配置、把 `notesDir` 写成占位值、把背景路径降级为文件名；下载时根据当前设备重新映射。

---

## 6. 验证策略

```yaml
verifyMode: test-first
reviewerFocus:
  - src-tauri/src/services/sync.rs 的路径安全、恢复覆盖和 WebDAV 错误处理
  - src-tauri/src/services/notes.rs 的 AppConfig 兼容默认值
  - src/components/SettingsPanel.tsx 的状态处理和文案长度
testerFocus:
  - npm run test
  - npm run lint
  - npm run build
  - cargo test --manifest-path src-tauri/Cargo.toml
uiValidation: optional
riskBoundary:
  - 不删除用户 notesDir 外的任何文件
  - 不把真实 WebDAV 凭据写入仓库
  - 不做后台自动下载覆盖
```

---

## 7. 成果设计

### 设计方向

- **美学基调**: 延续花笺既有纸感、竹色和紧凑设置侧栏，不引入独立大卡片或营销化说明。
- **记忆点**: “同步”区块呈现为轻量设备连接面板，状态反馈用小号状态行和明确按钮表达。
- **参考**: 现有 `SettingsPanel.tsx` 的 360px 侧栏、`ToggleRow`、`RangeRow`、`SlidingButtonGroup` 密度。

### 视觉要素

- **配色**: 继续使用 `paper-warm`、`paper-deep`、`bamboo`、`ink-*`，错误状态使用现有 `red-400`。
- **字体**: 沿用项目字体体系；不新增字体资源。
- **布局**: 在背景图设置之后或默认视图之前新增同步区块，保持 `space-y-2` 紧凑表单结构。
- **动效**: 复用按钮 hover/disabled 过渡；同步中按钮禁用并显示短状态。
- **氛围**: 不新增装饰背景；保持设置面板的半透明纸感。

### 技术约束

- **可访问性**: 输入框和按钮必须有明确 label；密码字段使用 `type="password"`。
- **响应式**: 设置侧栏宽度保持 360px，长 URL 文本不撑破容器。
