import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  checkGlobalShortcut,
  chooseNotesDirectory,
  checkWebdavStatus,
  downloadWebdavSnapshot,
  getConfig,
  normalizeViewMode,
  saveConfig,
  testWebdavSync,
  uploadWebdavSnapshot,
} from "./api";
import type { AppConfig } from "./types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedOpen = vi.mocked(open);

describe("settings api", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedOpen.mockReset();
  });

  test("gets config through Rust", async () => {
    const config: AppConfig = {
      locale: "zh-CN",
      notesDir: "D:\\notes",
      globalShortcut: "Ctrl+Space",
      closeToTray: true,
      autostart: false,
      defaultViewMode: "split",
      noteAutoSave: true,
      noteSurfaceAutoSave: true,
      tileColor: "#f6f3ec",
      tileColorMode: "system",
      theme: "light",
      fontSize: 14,
      surfaceFontSize: 14,
      tabIndentSize: 2,
      externalFileAutoSave: true,
      rememberSurfaceSize: true,
      tileCtrlClose: true,
      toggleVisibilityShortcut: "",
      tileRenderMarkdown: false,
      renderHtmlMarkdown: false,
      openAtCursor: true,
      webdav: {
        enabled: false,
        endpoint: "",
        username: "",
        password: "",
        remotePath: "floral-notepaper",
        syncOnStartup: false,
        conflictStrategy: "ask",
      },
      objectStorage: {
        enabled: false,
        endpoint: "",
        region: "auto",
        bucket: "",
        accessKeyId: "",
        secretAccessKey: "",
        publicBaseUrl: "",
        objectPrefix: "floral-notepaper",
      },
    };
    mockedInvoke.mockResolvedValue(config);

    await expect(getConfig()).resolves.toBe(config);

    expect(invoke).toHaveBeenCalledWith("config_get");
  });

  test("saves config through Rust", async () => {
    const config: AppConfig = {
      locale: "zh-CN",
      notesDir: "D:\\notes",
      globalShortcut: "Alt+Space",
      closeToTray: false,
      autostart: true,
      defaultViewMode: "preview",
      noteAutoSave: false,
      noteSurfaceAutoSave: false,
      tileColor: "#efe8dc",
      tileColorMode: "custom",
      theme: "dark",
      fontSize: 16,
      surfaceFontSize: 16,
      tabIndentSize: 4,
      externalFileAutoSave: true,
      rememberSurfaceSize: true,
      tileCtrlClose: true,
      toggleVisibilityShortcut: "",
      tileRenderMarkdown: false,
      renderHtmlMarkdown: false,
      openAtCursor: true,
      webdav: {
        enabled: true,
        endpoint: "https://example.com/dav",
        username: "user",
        password: "pass",
        remotePath: "floral-notepaper",
        syncOnStartup: true,
        conflictStrategy: "preferRemote",
      },
      objectStorage: {
        enabled: true,
        endpoint: "https://example.r2.cloudflarestorage.com",
        region: "auto",
        bucket: "floral",
        accessKeyId: "access",
        secretAccessKey: "secret",
        publicBaseUrl: "https://cdn.example.com/files",
        objectPrefix: "floral-notepaper",
      },
    };
    mockedInvoke.mockResolvedValue(config);

    await expect(saveConfig(config)).resolves.toBe(config);

    expect(invoke).toHaveBeenCalledWith("config_save", { config });
  });

  test("checks global shortcut availability through Rust", async () => {
    const result = {
      available: false,
      conflictType: "system",
      message: "与 macOS 系统快捷键冲突",
    };
    mockedInvoke.mockResolvedValue(result);

    await expect(checkGlobalShortcut("Command+Space")).resolves.toBe(result);

    expect(invoke).toHaveBeenCalledWith("global_shortcut_check", {
      shortcut: "Command+Space",
    });
  });

  test("tests WebDAV sync through Rust", async () => {
    const result = {
      ok: true,
      message: "WebDAV connection is available",
      syncedAt: "2026-05-30T10:00:00Z",
      remotePath: "https://example.com/dav/floral-notepaper/floral-notepaper-sync.json",
    };
    mockedInvoke.mockResolvedValue(result);

    await expect(testWebdavSync()).resolves.toBe(result);

    expect(invoke).toHaveBeenCalledWith("sync_webdav_test");
  });

  test("checks WebDAV sync status through Rust", async () => {
    const result = {
      ok: true,
      remoteExists: true,
      inSync: false,
      localChanged: true,
      remoteChanged: false,
      recommendedAction: "upload",
      localSignature: "local",
      remoteSignature: "remote",
      remotePath: "https://example.com/dav/floral-notepaper/floral-notepaper-sync.json",
      checkedAt: "2026-06-02T08:00:00Z",
    };
    mockedInvoke.mockResolvedValue(result);

    await expect(checkWebdavStatus()).resolves.toBe(result);

    expect(invoke).toHaveBeenCalledWith("sync_webdav_status");
  });

  test("uploads WebDAV snapshot through Rust", async () => {
    const result = {
      ok: true,
      message: "Snapshot uploaded",
      remotePath: "https://example.com/dav/floral-notepaper/floral-notepaper-sync.json",
    };
    mockedInvoke.mockResolvedValue(result);

    await expect(uploadWebdavSnapshot()).resolves.toBe(result);

    expect(invoke).toHaveBeenCalledWith("sync_webdav_upload");
  });

  test("downloads WebDAV snapshot through Rust", async () => {
    const result = {
      ok: true,
      message: "Snapshot downloaded",
      remotePath: "https://example.com/dav/floral-notepaper/floral-notepaper-sync.json",
    };
    mockedInvoke.mockResolvedValue(result);

    await expect(downloadWebdavSnapshot()).resolves.toBe(result);

    expect(invoke).toHaveBeenCalledWith("sync_webdav_download");
  });

  test("normalizes supported view modes and falls back to split", () => {
    expect(normalizeViewMode("edit")).toBe("edit");
    expect(normalizeViewMode("split")).toBe("split");
    expect(normalizeViewMode("preview")).toBe("preview");
    expect(normalizeViewMode("unknown")).toBe("split");
  });

  test("chooses a notes directory through the folder picker", async () => {
    mockedOpen.mockResolvedValue("D:\\notes");

    await expect(chooseNotesDirectory()).resolves.toBe("D:\\notes");

    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
  });

  test("returns null when choosing a notes directory is cancelled", async () => {
    mockedOpen.mockResolvedValue(null);

    await expect(chooseNotesDirectory()).resolves.toBeNull();
  });
});
