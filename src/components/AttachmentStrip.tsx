import { useTranslation } from "react-i18next";
import { formatAttachmentSize } from "../features/notes/attachments";
import type { NoteAttachment } from "../features/notes/types";

interface AttachmentStripProps {
  attachments: NoteAttachment[];
  loading: boolean;
  onAdd: () => void;
  onInsert: (attachment: NoteAttachment) => void;
  onDelete: (attachmentId: string) => void;
}

export function AttachmentStrip({
  attachments,
  loading,
  onAdd,
  onInsert,
  onDelete,
}: AttachmentStripProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={onAdd}
        disabled={loading}
        className="h-7 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-bamboo/30 bg-bamboo-mist/30 px-2.5 text-[11px] font-body text-bamboo hover:bg-bamboo-mist/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("main.attachments.add", { defaultValue: "添加附件" })}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>
          {loading
            ? t("main.attachments.adding", { defaultValue: "添加中" })
            : t("main.attachments.add", { defaultValue: "添加附件" })}
        </span>
      </button>

      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group h-7 min-w-0 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-paper-deep/60 bg-paper-warm/65 px-2 text-[11px] text-ink-faint shadow-[0_1px_8px_rgba(26,26,24,0.03)]"
        >
          <button
            type="button"
            onClick={() => onInsert(attachment)}
            className="min-w-0 inline-flex items-center gap-1.5 hover:text-bamboo transition-colors cursor-pointer"
            title={t("main.attachments.insert", {
              name: attachment.fileName,
              defaultValue: "插入 {{name}}",
            })}
          >
            <AttachmentIcon type={attachment.mimeGroup} />
            <span className="max-w-[160px] truncate">{attachment.fileName}</span>
            <span className="text-[10px] text-ink-ghost font-mono">
              {formatAttachmentSize(attachment.size)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(attachment.id)}
            className="ml-0.5 text-ink-ghost opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all cursor-pointer"
            title={t("main.attachments.delete", {
              name: attachment.fileName,
              defaultValue: "删除 {{name}}",
            })}
            aria-label={t("main.attachments.delete", {
              name: attachment.fileName,
              defaultValue: "删除 {{name}}",
            })}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function AttachmentIcon({ type }: { type: NoteAttachment["mimeGroup"] }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-bamboo/70"
      aria-hidden="true"
    >
      {type === "image" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </>
      )}
    </svg>
  );
}
