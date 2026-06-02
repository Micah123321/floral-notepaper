import { open } from "@tauri-apps/plugin-dialog";
import type { ObjectStorageConfig } from "../settings/types";
import type { NoteAttachment, ObjectUpload } from "./types";

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

export function objectUploadMarkdown(upload: ObjectUpload): string {
  const label = escapeMarkdownLabel(upload.fileName);
  if (upload.mimeGroup === "image") {
    return `![${label}](${upload.url})`;
  }

  return `[${label}](${upload.url})`;
}

export function isObjectStorageConfigured(config: ObjectStorageConfig | null | undefined): boolean {
  if (!config?.enabled) {
    return false;
  }

  return [
    config.endpoint,
    config.region,
    config.bucket,
    config.accessKeyId,
    config.secretAccessKey,
    config.publicBaseUrl,
  ].every((value) => value.trim().length > 0);
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
