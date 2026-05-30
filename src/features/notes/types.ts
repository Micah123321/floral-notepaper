export type ReminderKind = "once" | "weekly" | "monthly" | "workday";

export interface Reminder {
  kind: ReminderKind;
  input: string;
  nextAt: string;
  timeOfDay: string;
  weekday?: number;
  dayOfMonth?: number;
}

export interface NoteMetadata {
  id: string;
  title: string;
  fileName: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  preview: string;
  reminder?: Reminder | null;
}

export interface Note extends Omit<NoteMetadata, "preview"> {
  content: string;
}

export interface SaveNoteRequest {
  title: string;
  content: string;
  category: string;
  reminder?: Reminder | null;
}

export interface NoteAttachment {
  id: string;
  noteId: string;
  fileName: string;
  storedFileName: string;
  path: string;
  markdownUrl: string;
  mimeGroup: "image" | "file";
  size: number;
  updatedAt: string;
}

export interface ExternalFile {
  id: string;
  title: string;
  filePath: string;
}
