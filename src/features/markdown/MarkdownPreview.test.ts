import { describe, expect, test } from "vitest";
import { resolveAttachmentReference } from "./MarkdownPreview";
import type { NoteAttachment } from "../notes/types";

const attachments: NoteAttachment[] = [
  {
    id: "attachment-1",
    noteId: "note-1",
    fileName: "photo.png",
    storedFileName: "attachment-1_photo.png",
    path: "D:\\花笺\\attachments\\note-1\\attachment-1_photo.png",
    markdownUrl: "floral-attachment://note-1/attachment-1_photo.png",
    mimeGroup: "image",
    size: 1024,
    updatedAt: "2026-05-30T00:00:00Z",
  },
];

describe("MarkdownPreview attachment references", () => {
  test("resolves known local attachment references", () => {
    expect(
      resolveAttachmentReference("floral-attachment://note-1/attachment-1_photo.png", attachments),
    ).toEqual(attachments[0]);
  });

  test("ignores normal links and unknown attachment references", () => {
    expect(resolveAttachmentReference("https://example.com", attachments)).toBeNull();
    expect(
      resolveAttachmentReference("floral-attachment://note-1/missing.png", attachments),
    ).toBeNull();
    expect(resolveAttachmentReference(undefined, attachments)).toBeNull();
  });
});
