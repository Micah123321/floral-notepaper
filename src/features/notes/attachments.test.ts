import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { attachmentMarkdown, chooseAttachmentFile, formatAttachmentSize } from "./attachments";
import type { NoteAttachment } from "./types";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const mockedOpen = vi.mocked(open);

function attachment(overrides: Partial<NoteAttachment> = {}): NoteAttachment {
  return {
    id: "attachment-1",
    noteId: "note-1",
    fileName: "截图] 1.png",
    storedFileName: "attachment-1.png",
    path: "D:\\花笺\\attachments\\note-1\\attachment-1.png",
    markdownUrl: "floral-attachment://note-1/attachment-1.png",
    mimeGroup: "image",
    size: 1536,
    updatedAt: "2026-05-30T00:00:00Z",
    ...overrides,
  };
}

describe("note attachments helpers", () => {
  beforeEach(() => {
    mockedOpen.mockReset();
  });

  test("chooses one attachment file", async () => {
    mockedOpen.mockResolvedValue("D:\\images\\photo.png");

    await expect(chooseAttachmentFile()).resolves.toBe("D:\\images\\photo.png");
    expect(open).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
    });
  });

  test("returns null when attachment picker is cancelled", async () => {
    mockedOpen.mockResolvedValue(null);

    await expect(chooseAttachmentFile()).resolves.toBeNull();
  });

  test("builds image and file markdown references", () => {
    expect(attachmentMarkdown(attachment())).toBe(
      "![截图\\] 1.png](floral-attachment://note-1/attachment-1.png)",
    );
    expect(
      attachmentMarkdown(
        attachment({
          fileName: "report.pdf",
          markdownUrl: "floral-attachment://note-1/report.pdf",
          mimeGroup: "file",
        }),
      ),
    ).toBe("[report.pdf](floral-attachment://note-1/report.pdf)");
  });

  test("formats attachment sizes", () => {
    expect(formatAttachmentSize(42)).toBe("42 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
