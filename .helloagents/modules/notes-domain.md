---
module: notes-domain
updated_at: 2026-06-02 16:35:00
---

# 笔记领域

## 职责

笔记领域负责本地 Markdown 笔记的创建、读取、更新、删除、分类、导入导出、外部文件读写和错误消息归一。主要文件：

- `src/features/notes/api.ts`
- `src/features/notes/types.ts`
- `src/features/notes/attachments.ts`
- `src/features/notes/pasteUpload.ts`
- `src/features/notes/noteUtils.ts`
- `src/features/notes/noteContextMenu.ts`
- `src/features/reminders/parser.ts`
- `src/features/importExport/api.ts`
- `src-tauri/src/services/notes.rs`
- `src-tauri/src/services/object_storage.rs`
- `src-tauri/src/services/sync.rs`
- `src-tauri/src/lib.rs`

## 核心数据结构

Rust 与 TypeScript 使用 camelCase 序列化约定。

- `AppConfig`：用户配置，包含语言、笔记目录、快捷键、主题、字体、磁贴、背景和窗口行为。
- `WebdavConfig`：WebDAV 同步配置，包含 `enabled`、`endpoint`、`username`、`password`、`remotePath`、`syncOnStartup`、`conflictStrategy`、`lastSyncSignature`。
- `ObjectStorageConfig`：R2/S3 兼容对象存储配置，包含 `enabled`、`endpoint`、`region`、`bucket`、`accessKeyId`、`secretAccessKey`、`publicBaseUrl`、`objectPrefix`，默认关闭，`region` 默认为 `auto`，`objectPrefix` 默认为 `floral-notepaper`。
- `SaveNoteRequest`：保存笔记请求，字段为 `title`、`content`、`category`，可选 `reminder`。
- `Reminder` / `NoteReminder`：本地提醒预设，字段为 `kind`、`input`、`nextAt`、`timeOfDay`，以及可选 `weekday`、`dayOfMonth`。
- `NoteMetadata`：列表元数据，包含 `id`、`title`、`fileName`、`category`、时间、字数、preview 和可选 reminder。
- `Note`：完整笔记，包含 `content` 和可选 reminder。
- `NoteAttachment`：笔记附件，字段为 `id`、`noteId`、`fileName`、`storedFileName`、`path`、`markdownUrl`、`mimeGroup`、`size`、`updatedAt`。
- `ObjectUpload`：对象存储上传结果，字段为 `fileName`、`objectKey`、`url`、`mimeGroup`、`size`、`uploadedAt`。
- `AppError`：后端错误，包含 `code`、`message` 和 `details`。

## 行为规范

- 新建笔记使用 `Uuid::new_v4()` 生成 ID。
- 文件名由 `id` 和安全化标题组成；标题为空时使用 `{id}.md`。
- 字数统计按非空白字符计算。
- preview 取压缩空白后的前 80 个字符。
- `reminder` 保存在 `metadata.json` 中；旧元数据缺少该字段时按 `None` / `null` 兼容读取。
- 提醒解析在前端同步完成，首批支持“明天下午四点”“每周一”“每月五号上午10点”“每个工作日”等中文口语表达。
- `extractReminderFromTitle()` 会从笔记标题中提取滴答清单式时间片段，例如“明早九点开会”保存为 `reminder.input = "明早九点"`，标题原文保持不变。
- 当前 reminder 只表示本地提醒预设和下一次时间，不做系统通知调度，也不接入滴答清单账号或外部 API。
- 附件只绑定内部笔记，存储在 `base_dir/attachments/{noteId}/`，每个笔记附件目录内有 `attachments.json` 索引。
- 添加附件时复制源文件到应用数据目录，内部文件名使用 UUID 加安全扩展名，Markdown 引用为 `floral-attachment://{noteId}/{storedFileName}`。
- 图片附件按扩展名识别为 `mimeGroup: "image"`，普通文件为 `mimeGroup: "file"`；前端根据该字段插入图片或链接 Markdown。
- 删除附件和删除笔记关联附件目录均使用 `trash::delete()` 移入回收站，不做不可逆物理删除。
- 内部笔记编辑区支持粘贴剪贴板图片和文件；外部文件模式不触发对象存储上传。
- 粘贴上传依赖 `objectStorage` 配置完整。未配置时打开设置面板并提示用户先设置 R2/S3 存储；配置完整时调用 `notes_upload_object_attachment` 上传文件字节。
- `ObjectStorageService` 使用最小 AWS SigV4 `PUT /{bucket}/{objectKey}` 实现，签名包含真实 payload SHA-256，采用 path-style endpoint。
- 粘贴图片上传后插入 `![name](publicUrl)`，普通文件上传后插入 `[name](publicUrl)`；公开 URL 由 `publicBaseUrl + objectKey` 生成。
- WebDAV 同步采用单 JSON 快照，包含可共享设置、`metadata.json`、`notes/`、`backgrounds/` 和 `attachments/`。
- 上传快照前会移除本机 WebDAV 凭据、本机 `notesDir`，并把背景图绝对路径改为文件名。
- 上传快照也会移除本机 `lastSyncSignature`，该字段只作为当前设备同步基线。
- 上传快照会清空 `objectStorage`，避免对象存储密钥进入 WebDAV 远端快照。
- 下载恢复保留当前设备的 `notesDir`、WebDAV 凭据和对象存储配置，背景图文件名重映射到当前设备 `backgrounds/` 目录。
- 下载恢复先写入 `.sync-restore` 临时目录，替换受管目录前写入 `.sync-backups/` 临时备份，失败时尝试回滚。
- WebDAV 状态检查使用清理后的快照签名判断本地和远端是否一致，推荐动作包括 `none`、`upload`、`download`、`ask`。
- `metadata.json` 损坏时会重命名为 `metadata.corrupt-{timestamp}.json`，然后从笔记文件重建元数据。
- 删除笔记和删除分类目录使用 `trash::delete()` 移入回收站。
- 分类名不能为空，且不能包含 `/`、`\`、`:` 或 `..`。
- 删除分类会先把分类内笔记移动到未分类根目录，再把分类目录移入回收站。
- 导入只支持 `.md` 文件；导出不重写 Markdown 内容。
- 外部文件读写通过 `read_external_file`、`save_external_file` 和 `get_file_modified_time` 命令完成。

## 前后端接口

前端 API 到 Rust command 的映射：

| 前端函数                                     | Rust command                     |
| -------------------------------------------- | -------------------------------- |
| `listNotes()`                                | `notes_list`                     |
| `getNote(id)`                                | `notes_get`                      |
| `createNote(request)`                        | `notes_create`                   |
| `updateNote(id, request)`                    | `notes_update`                   |
| `deleteNote(id)`                             | `notes_delete`                   |
| `listNoteAttachments(noteId)`                | `notes_list_attachments`         |
| `addNoteAttachment(noteId, sourcePath)`      | `notes_add_attachment`           |
| `deleteNoteAttachment(noteId, attachmentId)` | `notes_delete_attachment`        |
| `uploadObjectAttachment(noteId, ...)`        | `notes_upload_object_attachment` |
| `moveNoteCategory(id, category)`             | `notes_move_category`            |
| `listCategories()`                           | `categories_list`                |
| `createCategory(name)`                       | `categories_create`              |
| `renameCategory(oldName, newName)`           | `categories_rename`              |
| `deleteCategory(name)`                       | `categories_delete`              |
| `readExternalFile(path)`                     | `read_external_file`             |
| `saveExternalFile(path, content)`            | `save_external_file`             |
| `getFileModifiedTime(path)`                  | `get_file_modified_time`         |
| `importMarkdownNote()`                       | `notes_import_markdown`          |
| `exportMarkdownNote()`                       | `notes_export_markdown`          |
| `testWebdavSync()`                           | `sync_webdav_test`               |
| `checkWebdavStatus()`                        | `sync_webdav_status`             |
| `uploadWebdavSnapshot()`                     | `sync_webdav_upload`             |
| `downloadWebdavSnapshot()`                   | `sync_webdav_download`           |

## 维护注意

- 新增错误码时同步 `LOCALIZED_ERROR_CODES`、`getLocalizedAppErrorMessage()` 和各语言 translation。
- 修改 `AppConfig` 时必须同步 Rust struct、TypeScript interface、默认值、旧配置兼容和测试夹具。
- 文件系统写入需要保持父目录创建和路径安全检查。
- 附件 Markdown URL 不应直接暴露原始外部路径；预览必须通过 `NoteAttachment.path` 转换为受 scope 限制的 Tauri asset URL。
- 涉及删除或移动目录时必须保留 `starts_with(notes_dir)` 等安全边界。
- 扩展 reminder 解析范围时优先补 `src/features/reminders/parser.test.ts`，避免口语表达回归。
