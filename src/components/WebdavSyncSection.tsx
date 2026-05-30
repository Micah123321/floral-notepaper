import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  downloadWebdavSnapshot,
  testWebdavSync,
  uploadWebdavSnapshot,
} from "../features/settings/api";
import { getErrorMessage } from "../features/notes/api";
import type { AppConfig, SyncStatus, WebdavConfig } from "../features/settings/types";

interface WebdavSyncSectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onSave: (config: AppConfig) => Promise<AppConfig>;
}

type SyncAction = "test" | "upload" | "download";
type SyncMessage = { tone: "idle" | "ok" | "error"; text: string };

export function WebdavSyncSection({ config, onChange, onSave }: WebdavSyncSectionProps) {
  const { t } = useTranslation();
  const [runningAction, setRunningAction] = useState<SyncAction | null>(null);
  const [message, setMessage] = useState<SyncMessage>({
    tone: "idle",
    text: t("settings.sync.idle", { defaultValue: "未同步" }),
  });

  const webdav = config.webdav ?? defaultWebdavConfig();

  const updateWebdav = <Key extends keyof WebdavConfig>(key: Key, value: WebdavConfig[Key]) => {
    onChange({
      ...config,
      webdav: {
        ...webdav,
        [key]: value,
      },
    });
  };

  const runAction = async (action: SyncAction) => {
    if (action === "download") {
      const confirmed = window.confirm(
        t("settings.sync.confirmDownload", {
          defaultValue: "下载远端快照会覆盖本机笔记、附件、背景图和应用设置，继续？",
        }),
      );
      if (!confirmed) return;
    }

    setRunningAction(action);
    setMessage({
      tone: "idle",
      text: t("settings.sync.running", { defaultValue: "同步中" }),
    });
    try {
      await onSave(config);
      const result = await runSyncAction(action);
      setMessage({ tone: "ok", text: formatSyncStatus(action, result, t) });
    } catch (error) {
      setMessage({
        tone: "error",
        text: getErrorMessage(error, t),
      });
    } finally {
      setRunningAction(null);
    }
  };

  const statusClass =
    message.tone === "ok"
      ? "text-bamboo"
      : message.tone === "error"
        ? "text-red-400"
        : "text-ink-ghost";
  const isRunning = runningAction !== null;

  return (
    <section className="space-y-2">
      <ToggleRow
        label={t("settings.sync.enabled", { defaultValue: "WebDAV 同步" })}
        checked={webdav.enabled}
        onChange={(checked) => updateWebdav("enabled", checked)}
      />

      {webdav.enabled && (
        <div className="space-y-2 rounded-lg bg-paper-warm/35 border border-paper-deep/25 p-2.5">
          <SyncField
            label={t("settings.sync.endpoint", { defaultValue: "地址" })}
            value={webdav.endpoint}
            placeholder="https://example.com/dav"
            onChange={(value) => updateWebdav("endpoint", value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <SyncField
              label={t("settings.sync.username", { defaultValue: "用户" })}
              value={webdav.username}
              onChange={(value) => updateWebdav("username", value)}
            />
            <SyncField
              label={t("settings.sync.password", { defaultValue: "密码" })}
              type="password"
              value={webdav.password}
              onChange={(value) => updateWebdav("password", value)}
            />
          </div>
          <SyncField
            label={t("settings.sync.remotePath", { defaultValue: "目录" })}
            value={webdav.remotePath}
            placeholder="floral-notepaper"
            onChange={(value) => updateWebdav("remotePath", value)}
          />

          <div className="grid grid-cols-3 gap-2">
            <SyncButton
              disabled={isRunning}
              label={
                runningAction === "test"
                  ? t("settings.sync.testing", { defaultValue: "检测中" })
                  : t("settings.sync.test", { defaultValue: "测试" })
              }
              onClick={() => void runAction("test")}
            />
            <SyncButton
              disabled={isRunning}
              label={
                runningAction === "upload"
                  ? t("settings.sync.uploading", { defaultValue: "上传中" })
                  : t("settings.sync.upload", { defaultValue: "上传" })
              }
              onClick={() => void runAction("upload")}
            />
            <SyncButton
              disabled={isRunning}
              tone="danger"
              label={
                runningAction === "download"
                  ? t("settings.sync.downloading", { defaultValue: "下载中" })
                  : t("settings.sync.download", { defaultValue: "下载" })
              }
              onClick={() => void runAction("download")}
            />
          </div>

          <p className={`min-h-4 text-[11px] leading-relaxed break-words ${statusClass}`}>
            {message.text}
          </p>
        </div>
      )}
    </section>
  );
}

function defaultWebdavConfig(): WebdavConfig {
  return {
    enabled: false,
    endpoint: "",
    username: "",
    password: "",
    remotePath: "floral-notepaper",
  };
}

async function runSyncAction(action: SyncAction): Promise<SyncStatus> {
  switch (action) {
    case "test":
      return testWebdavSync();
    case "upload":
      return uploadWebdavSnapshot();
    case "download":
      return downloadWebdavSnapshot();
  }
}

function formatSyncStatus(action: SyncAction, result: SyncStatus, translate: TFunction): string {
  const label =
    action === "test"
      ? String(translate("settings.sync.tested", { defaultValue: "连接正常" }))
      : action === "upload"
        ? String(translate("settings.sync.uploaded", { defaultValue: "已上传" }))
        : String(translate("settings.sync.downloaded", { defaultValue: "已下载" }));
  const when = result.syncedAt ? new Date(result.syncedAt).toLocaleString() : "";
  return when ? `${label} · ${when}` : label;
}

interface SyncFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}

function SyncField({ label, value, onChange, placeholder, type = "text" }: SyncFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] text-ink-faint/70">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-8 px-2.5 rounded-lg bg-cloud/65 border border-paper-deep/35 text-[11px] font-mono text-ink-soft placeholder:text-ink-ghost/45 outline-none focus:border-bamboo/40"
      />
    </label>
  );
}

interface SyncButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: "default" | "danger";
}

function SyncButton({ label, onClick, disabled, tone = "default" }: SyncButtonProps) {
  const toneClass =
    tone === "danger"
      ? "border-red-400/35 text-red-400 hover:bg-red-400/10"
      : "border-paper-deep/45 text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-lg border text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${toneClass}`}
    >
      {label}
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between h-9 rounded-lg px-2.5 bg-paper-warm/45 border border-paper-deep/25 cursor-pointer">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "bg-bamboo" : "bg-paper-deep/50"
        }`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
