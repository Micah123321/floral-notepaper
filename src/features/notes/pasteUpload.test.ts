import { describe, expect, test } from "vitest";
import { normalizedPasteContentType, normalizedPasteFileName } from "./pasteUpload";

function file(name: string, type = "", size = 1): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("paste upload helpers", () => {
  test("keeps pasted file names and content types", () => {
    const pasted = file("photo.png", "image/png");

    expect(normalizedPasteFileName(pasted, 0)).toBe("photo.png");
    expect(normalizedPasteContentType(pasted)).toBe("image/png");
  });

  test("fills missing pasted file names and content types", () => {
    const pasted = file("", "image/webp");
    const unknown = file("");

    expect(normalizedPasteFileName(pasted, 1)).toBe("pasted-file-2.webp");
    expect(normalizedPasteFileName(unknown, 0)).toBe("pasted-file-1");
    expect(normalizedPasteContentType(unknown)).toBe("application/octet-stream");
  });
});
