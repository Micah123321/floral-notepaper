export function clipboardFiles(event: Pick<ClipboardEvent, "clipboardData">): File[] {
  return Array.from(event.clipboardData?.files ?? []).filter((file) => file.size > 0);
}

export async function readFileBytes(file: File): Promise<number[]> {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

export function normalizedPasteFileName(file: File, index: number): string {
  const name = file.name.trim();
  if (name) {
    return name;
  }

  const extension = extensionFromContentType(file.type);
  return `pasted-file-${index + 1}${extension}`;
}

export function normalizedPasteContentType(file: File): string {
  return file.type.trim() || "application/octet-stream";
}

function extensionFromContentType(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/webp") return ".webp";
  return "";
}
