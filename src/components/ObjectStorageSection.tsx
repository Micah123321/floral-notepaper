import { useTranslation } from "react-i18next";
import type { AppConfig, ObjectStorageConfig } from "../features/settings/types";

interface ObjectStorageSectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export function ObjectStorageSection({ config, onChange }: ObjectStorageSectionProps) {
  const { t } = useTranslation();
  const objectStorage = normalizeObjectStorageConfig(config.objectStorage);

  const updateObjectStorage = <Key extends keyof ObjectStorageConfig>(
    key: Key,
    value: ObjectStorageConfig[Key],
  ) => {
    onChange({
      ...config,
      objectStorage: {
        ...objectStorage,
        [key]: value,
      },
    });
  };

  return (
    <section className="space-y-2">
      <ToggleRow
        label={t("settings.objectStorage.enabled", { defaultValue: "R2/S3 存储" })}
        checked={objectStorage.enabled}
        onChange={(checked) => updateObjectStorage("enabled", checked)}
      />

      <div
        className={`space-y-2 rounded-lg bg-paper-warm/35 border border-paper-deep/25 p-2.5 ${
          objectStorage.enabled ? "" : "opacity-75"
        }`}
      >
        <StorageField
          label={t("settings.objectStorage.endpoint", { defaultValue: "地址" })}
          value={objectStorage.endpoint}
          placeholder="https://account.r2.cloudflarestorage.com"
          onChange={(value) => updateObjectStorage("endpoint", value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <StorageField
            label={t("settings.objectStorage.region", { defaultValue: "区域" })}
            value={objectStorage.region}
            placeholder="auto"
            onChange={(value) => updateObjectStorage("region", value)}
          />
          <StorageField
            label={t("settings.objectStorage.bucket", { defaultValue: "Bucket" })}
            value={objectStorage.bucket}
            onChange={(value) => updateObjectStorage("bucket", value)}
          />
        </div>
        <StorageField
          label={t("settings.objectStorage.publicBaseUrl", { defaultValue: "公开地址" })}
          value={objectStorage.publicBaseUrl}
          placeholder="https://cdn.example.com"
          onChange={(value) => updateObjectStorage("publicBaseUrl", value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <StorageField
            label={t("settings.objectStorage.accessKeyId", { defaultValue: "Access Key" })}
            value={objectStorage.accessKeyId}
            onChange={(value) => updateObjectStorage("accessKeyId", value)}
          />
          <StorageField
            label={t("settings.objectStorage.secretAccessKey", { defaultValue: "Secret Key" })}
            type="password"
            value={objectStorage.secretAccessKey}
            onChange={(value) => updateObjectStorage("secretAccessKey", value)}
          />
        </div>
        <StorageField
          label={t("settings.objectStorage.objectPrefix", { defaultValue: "目录" })}
          value={objectStorage.objectPrefix}
          placeholder="floral-notepaper"
          onChange={(value) => updateObjectStorage("objectPrefix", value)}
        />
      </div>
    </section>
  );
}

function normalizeObjectStorageConfig(
  config: ObjectStorageConfig | undefined,
): ObjectStorageConfig {
  return {
    enabled: config?.enabled ?? false,
    endpoint: config?.endpoint ?? "",
    region: config?.region ?? "auto",
    bucket: config?.bucket ?? "",
    accessKeyId: config?.accessKeyId ?? "",
    secretAccessKey: config?.secretAccessKey ?? "",
    publicBaseUrl: config?.publicBaseUrl ?? "",
    objectPrefix: config?.objectPrefix ?? "floral-notepaper",
  };
}

interface StorageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}

function StorageField({ label, value, onChange, placeholder, type = "text" }: StorageFieldProps) {
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
