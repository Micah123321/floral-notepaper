export type ViewMode = "edit" | "split" | "preview";

export type ThemeOption = "light" | "dark" | "system";

export type TileColorMode = "system" | "custom";
export type BackgroundFit = "cover" | "contain" | "repeat";
export type WebdavConflictStrategy = "ask" | "preferLocal" | "preferRemote";
export type WebdavSyncAction = "none" | "ask" | "upload" | "download";

export interface WebdavConfig {
  enabled: boolean;
  endpoint: string;
  username: string;
  password: string;
  remotePath: string;
  syncOnStartup: boolean;
  conflictStrategy: WebdavConflictStrategy;
  lastSyncSignature?: string;
}

export interface ObjectStorageConfig {
  enabled: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  objectPrefix: string;
}

export interface AppConfig {
  locale: string;
  notesDir: string;
  globalShortcut: string;
  closeToTray: boolean;
  autostart: boolean;
  defaultViewMode: string;
  noteAutoSave: boolean;
  noteSurfaceAutoSave: boolean;
  tileColor: string;
  tileColorMode: TileColorMode;
  theme: ThemeOption;
  fontSize: number;
  surfaceFontSize: number;
  tabIndentSize: number;
  externalFileAutoSave: boolean;
  rememberSurfaceSize: boolean;
  tileCtrlClose: boolean;
  tileRenderMarkdown: boolean;
  renderHtmlMarkdown: boolean;
  surfaceWidth?: number;
  surfaceHeight?: number;
  toggleVisibilityShortcut: string;
  openAtCursor: boolean;
  backgroundImagePath?: string;
  backgroundFit?: BackgroundFit;
  backgroundDim?: number;
  backgroundBlur?: number;
  backgroundScale?: number;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
  webdav: WebdavConfig;
  objectStorage: ObjectStorageConfig;
}

export interface SyncStatus {
  ok: boolean;
  message: string;
  syncedAt?: string;
  remotePath: string;
}

export interface SyncOverview {
  ok: boolean;
  remoteExists: boolean;
  inSync: boolean;
  localChanged: boolean;
  remoteChanged: boolean;
  recommendedAction: WebdavSyncAction;
  localSignature: string;
  remoteSignature?: string;
  remotePath: string;
  checkedAt: string;
}
