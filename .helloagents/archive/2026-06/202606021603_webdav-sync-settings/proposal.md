# 变更提案: webdav-sync-settings

## 元信息

```yaml
类型: 新功能 + 修复
方案类型: implementation
优先级: P1
状态: 进行中
创建: 2026-06-02
```

---

## 1. 需求

### 背景

项目已经实现 WebDAV 显式测试、上传和下载快照，但设置区只在启用后显示详情，用户反馈“点下开启 WebDAV 控制选项直接不见了”。同时，现有同步模型没有“每次打开是否自动同步”和“本地与远端不一致时如何处理”的配置入口，用户无法理解或控制冲突策略。

### 目标

- 修复 WebDAV 设置区交互，配置、测试、同步选项在设置面板中稳定可见。
- 在 `WebdavConfig` 中新增启动自动同步配置和不一致处理策略。
- 新增远端状态检查能力，比较本地快照与远端快照是否一致。
- 提供“同步”按钮，按策略自动上传、下载或询问。
- 主窗口启动时根据配置自动检查并同步。
- 默认策略为“询问”，避免本地与远端都变化时静默覆盖。

### 约束条件

```yaml
时间约束: 无明确时间限制
性能约束: 启动自动同步仅在用户开启后执行；默认不增加启动网络请求
兼容性约束: 旧 config.json 缺少新增字段时必须正常加载
业务约束: 不上传 WebDAV 密码、本机 notesDir、同步基线等设备私有字段；下载远端仍保留本机 WebDAV 配置
```

### 验收标准

- [ ] 设置面板中 WebDAV 配置、测试、检查、同步、上传、下载选项稳定可见，不因开启开关而消失。
- [ ] 配置支持 `syncOnStartup` 和 `conflictStrategy`，默认分别为 `false` 与 `ask`。
- [ ] 后端提供 `sync_webdav_status`，能返回远端是否存在、本地/远端签名、是否同步、推荐动作。
- [ ] 上传和下载成功后更新本机同步基线，后续状态检查可识别“已同步”。
- [ ] 主窗口启动时在 `syncOnStartup=true` 且 WebDAV 启用时按策略执行同步。
- [ ] 本地与远端都变化或无法判断基线时，默认询问用户选择上传本机、下载远端或取消。
- [ ] 前端测试、Rust 测试、lint/build 验证通过，或明确记录环境型失败。

---

## 2. 方案

### 技术方案

采用“快照签名 + 策略执行”的增量方案：

- 扩展 `WebdavConfig`：新增 `syncOnStartup`、`conflictStrategy`、`lastSyncSignature`。
- 后端对快照内容计算稳定签名；签名忽略 `generatedAt`，避免同内容因生成时间不同而误判。
- 新增 `sync_webdav_status`：读取远端快照并与本地快照签名比较，结合 `lastSyncSignature` 判断本地是否变化、远端是否变化以及推荐动作。
- 上传成功后把本地签名写入 `lastSyncSignature`；下载成功后把远端签名写入 `lastSyncSignature`。
- 前端新增 `resolveWebdavSyncAction()`，把后端推荐动作和用户配置的冲突策略合成实际动作。
- 设置面板 WebDAV 详情面板始终渲染；禁用时按钮不可点但配置区不消失。
- 主窗口启动流程从“并行读取配置和笔记”调整为“读取配置 → 如需启动同步 → 读取笔记/分类”，避免自动下载后先显示旧数据。

### 影响范围

```yaml
涉及模块:
  - settings-localization: 新增 WebDAV 策略字段、设置 UI、前端 API、三语文案
  - desktop-shell: 新增 Tauri command，上传/下载后广播配置变更
  - notes-domain: 扩展 WebDAV 配置模型与同步签名逻辑
  - build-and-tests: 增加前端策略测试与 Rust 签名/决策测试
预计变更文件: 14-18
```

### 风险评估

| 风险                         | 等级 | 应对                                                                   |
| ---------------------------- | ---- | ---------------------------------------------------------------------- |
| 启动自动下载覆盖本机数据     | 高   | 默认关闭启动同步；默认冲突策略为询问；远端优先需用户主动选择           |
| 旧快照缺少新字段导致解析失败 | 中   | 新字段使用 serde default；旧快照反序列化后重新计算签名                 |
| 同步签名误判                 | 中   | 签名基于清理后的完整快照内容并忽略生成时间；测试覆盖内容变化和一致场景 |
| UI 选项在 360px 设置栏内拥挤 | 中   | 使用紧凑 toggle、分段策略和两行按钮，文案短句化                        |

### 方案取舍

```yaml
唯一方案理由: 快照签名能在现有单文件快照模型上补齐“不一致判断”和“策略执行”，无需引入复杂双向合并。
放弃的替代路径:
  - 文件级双向合并: 当前应用没有删除墓碑和冲突 UI，误删/误覆盖风险高。
  - 始终远端覆盖: 可满足“自动更新”，但会静默覆盖本机未上传修改。
  - 始终本机覆盖: 简单安全，但多设备使用时会覆盖远端新数据。
回滚边界: 可独立回退新增配置字段、status command、前端策略 UI 和启动同步调用；基础上传/下载保持不变。
```

---

## 3. 技术设计

### 架构设计

```text
MainWindow bootstrap
  -> getConfig()
  -> runStartupWebdavSync()
  -> sync_webdav_status / upload / download
  -> listNotes() / listCategories()

WebdavSyncSection
  -> onSave(config)
  -> sync_webdav_status
  -> resolveWebdavSyncAction()
  -> upload / download / prompt
```

### API 设计

#### Tauri command: `sync_webdav_status`

- **请求**: 无显式参数，读取当前 `AppConfig.webdav`
- **响应**: `SyncOverview`

#### 前端 API

- `checkWebdavStatus(): Promise<SyncOverview>`
- `resolveWebdavSyncAction(overview, strategy): "none" | "ask" | "upload" | "download"`

### 数据模型

| 字段                             | 类型    | 说明                                  |
| -------------------------------- | ------- | ------------------------------------- | --------------- | -------------------------------------- |
| `WebdavConfig.syncOnStartup`     | bool    | 主窗口启动时是否自动检查并同步        |
| `WebdavConfig.conflictStrategy`  | `"ask"  | "preferLocal"                         | "preferRemote"` | 本地与远端都变化或无法判断基线时的策略 |
| `WebdavConfig.lastSyncSignature` | string? | 本机上次成功上传/下载后的快照签名     |
| `SyncOverview.remoteExists`      | bool    | 远端快照是否存在                      |
| `SyncOverview.inSync`            | bool    | 本地与远端签名是否一致                |
| `SyncOverview.localChanged`      | bool    | 本地相对同步基线是否变化              |
| `SyncOverview.remoteChanged`     | bool    | 远端相对同步基线是否变化              |
| `SyncOverview.recommendedAction` | string  | `none`、`ask`、`upload` 或 `download` |

---

## 4. 核心场景

### 场景: WebDAV 设置项稳定显示

**模块**: settings-localization
**条件**: 用户打开设置面板并切换 WebDAV 同步开关
**行为**: 面板保留配置、策略和操作按钮；禁用状态下按钮不可点
**结果**: 用户不会因为切换开关丢失配置入口。

### 场景: 手动同步

**模块**: settings-localization / notes-domain
**条件**: WebDAV 配置完整
**行为**: 用户点击“同步”，应用检查远端状态并按策略上传、下载、询问或跳过
**结果**: 本地与远端状态一致，或用户明确取消。

### 场景: 启动自动同步

**模块**: desktop-shell / settings-localization
**条件**: `syncOnStartup=true` 且 WebDAV 启用
**行为**: 主窗口启动时先检查同步状态，按策略执行，随后加载笔记列表
**结果**: 用户打开应用后看到的是策略处理后的数据。

---

## 5. 技术决策

### webdav-sync-settings#D001: 默认冲突策略采用询问

**日期**: 2026-06-02
**状态**: ✅采纳
**背景**: 本地和远端都可能有未同步修改，自动选择任一方向都会覆盖另一侧数据。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 默认询问 | 数据安全，用户明确选择方向 | 多一次交互 |
| B: 默认远端优先 | 更像“打开自动更新” | 可能覆盖本地未上传笔记 |
| C: 默认本机优先 | 保护本机数据 | 可能覆盖其他设备远端更新 |
**决策**: 选择方案 A
**理由**: 该应用是本地优先笔记工具，数据安全优先于自动化程度。
**影响**: UI 增加策略选项，启动同步遇到冲突时会弹出选择。

### webdav-sync-settings#D002: 使用稳定快照签名判断差异

**日期**: 2026-06-02
**状态**: ✅采纳
**背景**: 现有远端只有单个快照文件，没有增量日志。
**选项分析**:
| 选项 | 优点 | 缺点 |
|------|------|------|
| A: 快照签名 | 改动小，覆盖所有数据和设置 | 不能定位到具体冲突文件 |
| B: 文件级索引 | 可提示具体冲突 | 需要新增 manifest、删除语义和迁移 |
**决策**: 选择方案 A
**理由**: 当前目标是明确策略而非文件级合并，签名足以判断是否一致和推荐同步方向。
**影响**: 后端新增签名计算和同步基线字段。

---

## 6. 验证策略

```yaml
verifyMode: test-first
reviewerFocus:
  - src-tauri/src/services/sync.rs 的签名稳定性、状态判断和基线更新
  - src/components/WebdavSyncSection.tsx 的配置可见性和危险下载确认
  - src/components/MainWindow.tsx 的启动同步顺序和错误处理
testerFocus:
  - npm run test -- src/features/settings/api.test.ts src/features/settings/webdavSync.test.ts
  - npm run test
  - npm run lint
  - npm run build
  - cargo test --manifest-path src-tauri/Cargo.toml
uiValidation: code-level
riskBoundary:
  - 不在默认配置下启动网络同步
  - 不在冲突默认策略下静默覆盖本地或远端
  - 不把 WebDAV 密码或本机路径写入远端快照
```

---

## 7. 成果设计

### 设计方向

- **美学基调**: 延续花笺设置侧栏的纸感工具面板，保持安静、紧凑、可反复使用的操作密度。
- **记忆点**: WebDAV 区块不再“展开/消失”，而是像一个始终可见的连接面板，启用后按钮从不可用变为可操作。
- **参考**: 现有 `ToggleRow`、`SlidingButtonGroup`、`SyncField` 的小字号表单风格。

### 视觉要素

- **配色**: 沿用 `paper-warm`、`cloud`、`bamboo`、`ink-*`，下载按钮继续使用红色危险态。
- **字体**: 沿用项目 HarmonyOS Sans 体系，不新增字体。
- **布局**: 配置字段纵向排列，冲突策略使用三段式分段控件，操作按钮分两行排布避免挤压。
- **动效**: 复用现有开关和按钮过渡；禁用态以透明度表达。
- **氛围**: 不新增装饰背景，保持轻量设置工具的纸面质感。

### 技术约束

- **可访问性**: 所有输入框保留 label，禁用态按钮不可点击。
- **响应式**: 适配现有 360px 设置侧栏，长 URL 不撑破容器。
