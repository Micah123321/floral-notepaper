---
module: markdown-rendering
updated_at: 2026-06-02 16:35:00
---

# Markdown 渲染

## 职责

Markdown 渲染模块负责把笔记内容渲染为预览视图，并提供代码块复制、表格、任务列表、数学公式、链接打开和可选 HTML 渲染能力。主要文件：

- `src/features/markdown/MarkdownPreview.tsx`
- `src/components/MainWindow.tsx`
- `src/components/Tile.tsx`
- `src/components/NotePad.tsx`

## 渲染链路

默认插件：

- `remark-gfm`
- `remark-math`
- `rehype-katex`

启用 HTML 渲染时：

- `rehype-raw`
- `rehype-sanitize`
- `rehype-katex`

自定义 sanitize schema 允许：

- 标签：`mark`、`center`、`font`、`u`、`abbr`
- 通用属性：`style`
- `font` 属性：`color`、`size`、`face`
- `abbr` 属性：`title`

## 行为规范

- 空内容显示本地化空状态。
- 代码块右上角提供复制按钮，复制成功后短暂显示“已复制”。
- 链接点击会阻止默认行为，仅允许 `http` 和 `https` URL 调用 Tauri opener 打开。
- 对象存储粘贴上传插入标准 HTTP/HTTPS Markdown 图片或链接；图片由浏览器按普通远程图片渲染，文件链接沿用外链 opener 行为。
- 本地附件引用使用 `floral-attachment://{noteId}/{storedFileName}`，预览时按当前笔记 `attachments` 列表解析。
- 图片附件通过 `convertFileSrc(attachment.path)` 转为 Tauri asset URL 并渲染为 `<img>`；普通附件链接点击后调用 `openPath(attachment.path)`。
- 行内 code 和块级 code 使用不同样式。
- 数学公式依赖 KaTeX 样式 `katex/dist/katex.min.css`。

## 安全边界

- 默认不解析原始 HTML。
- 用户开启 `renderHtmlMarkdown` 后才使用 `rehypeRaw`。
- 原始 HTML 必须经过 `rehypeSanitize`。
- sanitize schema 允许 `href` 和 `src` 使用 `floral-attachment` 协议，但只有能匹配当前笔记附件列表的引用才会转换为本地文件访问。
- 后续若扩大 HTML 白名单，应先评估 XSS、外链、样式污染和 Tauri webview 能力边界。

## 维护注意

- 新增 Markdown 能力时优先通过 remark/rehype 插件实现。
- 不要在 Markdown 渲染组件中直接执行任意脚本或信任用户输入 HTML。
- 改动样式时同步主窗口预览和磁贴 Markdown 渲染场景。
