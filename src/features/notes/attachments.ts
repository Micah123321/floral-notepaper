import { open } from "@tauri-apps/plugin-dialog";
import type { NoteAttachment } from "./types";

export async function chooseAttachmentFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
  });

  return typeof path === "string" ? path : null;
}

export function attachmentMarkdown(attachment: NoteAttachment): string {
  const label = escapeMarkdownLabel(attachment.fileName);
  if (attachment.mimeGroup === "image") {
    return `![${label}](${attachment.markdownUrl})`;
  }

  return `[${label}](${attachment.markdownUrl})`;
}

export function formatAttachmentSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}
