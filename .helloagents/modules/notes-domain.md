---
module: notes-domain
updated_at: 2026-05-30 16:28:01
---

# 笔记领域

## 职责

笔记领域负责本地 Markdown 笔记的创建、读取、更新、删除、分类、导入导出、外部文件读写和错误消息归一。主要文件：

- `src/features/notes/api.ts`
- `src/features/notes/types.ts`
- `src/features/notes/noteUtils.ts`
- `src/features/notes/noteContextMenu.ts`
- `src/features/importExport/api.ts`
- `src-tauri/src/services/notes.rs`
- `src-tauri/src/lib.rs`

## 核心数据结构

Rust 与 TypeScript 使用 camelCase 序列化约定。

- `AppConfig`：用户配置，包含语言、笔记目录、快捷键、主题、字体、磁贴、背景和窗口行为。
- `SaveNoteRequest`：保存笔记请求，字段为 `title`、`content`、`category`。
- `NoteMetadata`：列表元数据，包含 `id`、`title`、`fileName`、`category`、时间、字数和 preview。
- `Note`：完整笔记，包含 `content`。
- `AppError`：后端错误，包含 `code`、`message` 和 `details`。

## 行为规范

- 新建笔记使用 `Uuid::new_v4()` 生成 ID。
- 文件名由 `id` 和安全化标题组成；标题为空时使用 `{id}.md`。
- 字数统计按非空白字符计算。
- preview 取压缩空白后的前 80 个字符。
- `metadata.json` 损坏时会重命名为 `metadata.corrupt-{timestamp}.json`，然后从笔记文件重建元数据。
- 删除笔记和删除分类目录使用 `trash::delete()` 移入回收站。
- 分类名不能为空，且不能包含 `/`、`\`、`:` 或 `..`。
- 删除分类会先把分类内笔记移动到未分类根目录，再把分类目录移入回收站。
- 导入只支持 `.md` 文件；导出不重写 Markdown 内容。
- 外部文件读写通过 `read_external_file`、`save_external_file` 和 `get_file_modified_time` 命令完成。

## 前后端接口

前端 API 到 Rust command 的映射：

| 前端函数 | Rust command |
| --- | --- |
| `listNotes()` | `notes_list` |
| `getNote(id)` | `notes_get` |
| `createNote(request)` | `notes_create` |
| `updateNote(id, request)` | `notes_update` |
| `deleteNote(id)` | `notes_delete` |
| `moveNoteCategory(id, category)` | `notes_move_category` |
| `listCategories()` | `categories_list` |
| `createCategory(name)` | `categories_create` |
| `renameCategory(oldName, newName)` | `categories_rename` |
| `deleteCategory(name)` | `categories_delete` |
| `readExternalFile(path)` | `read_external_file` |
| `saveExternalFile(path, content)` | `save_external_file` |
| `getFileModifiedTime(path)` | `get_file_modified_time` |
| `importMarkdownNote()` | `notes_import_markdown` |
| `exportMarkdownNote()` | `notes_export_markdown` |

## 维护注意

- 新增错误码时同步 `LOCALIZED_ERROR_CODES`、`getLocalizedAppErrorMessage()` 和各语言 translation。
- 修改 `AppConfig` 时必须同步 Rust struct、TypeScript interface、默认值、旧配置兼容和测试夹具。
- 文件系统写入需要保持父目录创建和路径安全检查。
- 涉及删除或移动目录时必须保留 `starts_with(notes_dir)` 等安全边界。

