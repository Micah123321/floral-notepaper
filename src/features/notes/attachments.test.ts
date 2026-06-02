import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  attachmentMarkdown,
  chooseAttachmentFile,
  formatAttachmentSize,
  isObjectStorageConfigured,
  objectUploadMarkdown,
} from "./attachments";
import type { ObjectStorageConfig } from "../settings/types";
import type { NoteAttachment, ObjectUpload } from "./types";

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

function objectUpload(overrides: Partial<ObjectUpload> = {}): ObjectUpload {
  return {
    fileName: "截图] 1.png",
    objectKey: "floral/note-1/photo.png",
    url: "https://cdn.example.com/floral/note-1/photo.png",
    mimeGroup: "image",
    size: 1536,
    uploadedAt: "2026-06-02T08:00:00Z",
    ...overrides,
  };
}

function objectStorageConfig(overrides: Partial<ObjectStorageConfig> = {}): ObjectStorageConfig {
  return {
    enabled: true,
    endpoint: "https://example.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "floral",
    accessKeyId: "access",
    secretAccessKey: "secret",
    publicBaseUrl: "https://cdn.example.com",
    objectPrefix: "floral-notepaper",
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

  test("builds object storage image and file markdown references", () => {
    expect(objectUploadMarkdown(objectUpload())).toBe(
      "![截图\\] 1.png](https://cdn.example.com/floral/note-1/photo.png)",
    );
    expect(
      objectUploadMarkdown(
        objectUpload({
          fileName: "report.pdf",
          url: "https://cdn.example.com/floral/note-1/report.pdf",
          mimeGroup: "file",
        }),
      ),
    ).toBe("[report.pdf](https://cdn.example.com/floral/note-1/report.pdf)");
  });

  test("checks object storage configuration completeness", () => {
    expect(isObjectStorageConfigured(objectStorageConfig())).toBe(true);
    expect(isObjectStorageConfigured(objectStorageConfig({ enabled: false }))).toBe(false);
    expect(isObjectStorageConfigured(objectStorageConfig({ publicBaseUrl: "" }))).toBe(false);
    expect(isObjectStorageConfigured(undefined)).toBe(false);
  });

  test("formats attachment sizes", () => {
    expect(formatAttachmentSize(42)).toBe("42 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
