---
project: floral-notepaper
updated_at: 2026-05-30 16:28:01
---

# CHANGELOG

## [1.0.4] - 2026-05-30

### 新增

- **[提醒预设]**: 标题输入自动识别滴答清单式时间片段，并随笔记保存写入 reminder — by yinjianm
  - 类型: 快速修改（无方案包）
  - 文件: src/features/reminders/parser.ts, src/components/MainWindow.tsx, src/features/reminders/parser.test.ts

- **[WebDAV 同步]**: 增加显式 WebDAV 上传/下载快照，同步可共享设置、元数据、笔记、背景图和附件，并保留当前设备路径与 WebDAV 凭据 — by yinjianm
  - 方案: [202605301749_webdav-sync](plan/202605301749_webdav-sync/)
  - 决策: webdav-sync#D001(使用单文件快照式 WebDAV 同步), webdav-sync#D002(下载恢复时保留本机连接配置和路径)

- **[笔记附件]**: 增加内部笔记图片/文件附件，支持复制到应用数据目录、插入 Markdown、预览图片、打开文件链接和删除附件 — by yinjianm
  - 方案: [202605301748_note-attachments](plan/202605301748_note-attachments/)
  - 决策: note-attachments#D001(使用本地附件目录和自定义 Markdown 引用协议)
  - 验证: `npm run lint`、`npm run test`、`npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`npx tauri build --debug`

- **[知识库]**: 初始化 HelloAGENTS 项目知识库，并补充根目录开发文档 `开发文档.md` — by yinjianm
  - 方案: 无（`~init` 初始化流程）
  - 决策: 无

- **[提醒预设]**: 增加本地 reminder 数据模型、中文口语化提醒解析、主窗口提醒纸签和持久化链路 — by yinjianm
  - 方案: [202605301748_reminder-presets](archive/2026-05/202605301748_reminder-presets/)
  - 决策: reminder-presets#D001(使用本地规则解析，不引入第三方 NLP)
