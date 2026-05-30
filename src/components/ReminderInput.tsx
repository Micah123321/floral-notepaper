import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reminder } from "../features/notes/types";
import {
  formatReminderSummary,
  parseReminderInput,
  REMINDER_PRESETS,
} from "../features/reminders/parser";

interface ReminderInputProps {
  value: Reminder | null;
  disabled?: boolean;
  locale?: string;
  onChange: (value: Reminder | null) => void;
}

export function ReminderInput({
  value,
  disabled = false,
  locale = "zh-CN",
  onChange,
}: ReminderInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value?.input ?? "");

  useEffect(() => {
    setDraft(value?.input ?? "");
  }, [value?.input]);

  const parsed = useMemo(() => parseReminderInput(draft), [draft]);
  const hasDraft = draft.trim().length > 0;
  const draftMatchesSavedReminder = draft.trim() === (value?.input ?? "");
  const activeReminder = parsed ?? (draftMatchesSavedReminder ? value : null);
  const summary = activeReminder ? formatReminderSummary(activeReminder, locale) : null;
  const showUnrecognized = hasDraft && !parsed && !draftMatchesSavedReminder;

  const applyDraft = (nextDraft: string) => {
    setDraft(nextDraft);
    const nextReminder = parseReminderInput(nextDraft);
    if (nextReminder) {
      onChange(nextReminder);
    } else if (!nextDraft.trim()) {
      onChange(null);
    }
  };

  return (
    <div className="reminder-paper-slip mt-3" data-reminder-active={value ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[180px] flex-1 items-center gap-2">
          <span className="text-[10px] font-mono text-bamboo/70 tracking-wider shrink-0">
            {t("main.reminder.label", { defaultValue: "提醒" })}
          </span>
          <input
            type="text"
            value={draft}
            disabled={disabled}
            onChange={(event) => applyDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && parsed) onChange(parsed);
              if (event.key === "Escape") applyDraft("");
            }}
            placeholder={t("main.reminder.placeholder", {
              defaultValue: "明天下午四点、每周一、每个工作日…",
            })}
            className="min-w-0 flex-1 text-[12px] text-ink-soft placeholder:text-ink-ghost/60 disabled:opacity-50"
          />
        </label>

        {value && (
          <button
            type="button"
            onClick={() => applyDraft("")}
            disabled={disabled}
            className="h-6 px-2 rounded-md text-[11px] text-ink-ghost hover:text-red-400 hover:bg-danger-bg transition-colors disabled:opacity-40 cursor-pointer"
          >
            {t("main.reminder.clear", { defaultValue: "清除" })}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {REMINDER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => applyDraft(preset.input)}
            className="h-6 px-2 rounded-md border border-bamboo/15 bg-paper/45 text-[10px] text-bamboo/80 hover:bg-bamboo-mist/70 hover:border-bamboo/25 transition-all disabled:opacity-40 cursor-pointer"
          >
            {t(preset.labelKey, { defaultValue: preset.defaultLabel })}
          </button>
        ))}
      </div>

      <div className="mt-2 min-h-4">
        {summary ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-bamboo-mist/60 px-2 py-0.5 text-[10px] font-mono text-bamboo/80">
            <span className="h-1.5 w-1.5 rounded-full bg-bamboo/60 shrink-0" />
            <span className="truncate">
              {t("main.reminder.summary", { time: summary, defaultValue: "提醒 {{time}}" })}
            </span>
          </span>
        ) : showUnrecognized ? (
          <span className="text-[10px] text-amber-600/75">
            {t("main.reminder.unrecognized", { defaultValue: "未识别为提醒时间" })}
          </span>
        ) : (
          <span className="text-[10px] text-ink-ghost/70">
            {t("main.reminder.hint", { defaultValue: "输入时间后自动识别" })}
          </span>
        )}
      </div>
    </div>
  );
}

interface ReminderBadgeProps {
  value: Reminder;
  locale?: string;
  className?: string;
}

export function ReminderBadge({ value, locale = "zh-CN", className = "" }: ReminderBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md border border-bamboo/10 bg-bamboo-mist/55 px-1.5 py-0.5 text-[10px] font-mono text-bamboo/75 ${className}`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="truncate">{formatReminderSummary(value, locale)}</span>
    </span>
  );
}
