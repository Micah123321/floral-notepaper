import { describe, expect, test } from "vitest";
import {
  defaultWebdavConfig,
  normalizeConflictStrategy,
  normalizeWebdavConfig,
  resolveWebdavSyncAction,
} from "./webdavSync";
import type { SyncOverview } from "./types";

const conflictOverview: Pick<SyncOverview, "recommendedAction"> = {
  recommendedAction: "ask",
};

describe("webdav sync settings", () => {
  test("builds a safe default config", () => {
    expect(defaultWebdavConfig()).toMatchObject({
      enabled: false,
      remotePath: "floral-notepaper",
      syncOnStartup: false,
      conflictStrategy: "ask",
    });
  });

  test("normalizes missing and invalid conflict strategies to ask", () => {
    expect(normalizeConflictStrategy(undefined)).toBe("ask");
    expect(normalizeConflictStrategy("unknown")).toBe("ask");
    expect(normalizeConflictStrategy("preferLocal")).toBe("preferLocal");
  });

  test("fills legacy WebDAV config fields", () => {
    expect(
      normalizeWebdavConfig({
        enabled: true,
        endpoint: "https://example.com/dav",
        username: "user",
        password: "pass",
        remotePath: "",
      }),
    ).toMatchObject({
      enabled: true,
      endpoint: "https://example.com/dav",
      remotePath: "floral-notepaper",
      syncOnStartup: false,
      conflictStrategy: "ask",
    });
  });

  test("resolves ask conflicts from user strategy", () => {
    expect(resolveWebdavSyncAction(conflictOverview, "ask")).toBe("ask");
    expect(resolveWebdavSyncAction(conflictOverview, "preferLocal")).toBe("upload");
    expect(resolveWebdavSyncAction(conflictOverview, "preferRemote")).toBe("download");
  });

  test("keeps backend recommendations when no conflict choice is needed", () => {
    expect(resolveWebdavSyncAction({ recommendedAction: "upload" }, "preferRemote")).toBe("upload");
    expect(resolveWebdavSyncAction({ recommendedAction: "none" }, "preferLocal")).toBe("none");
  });
});
