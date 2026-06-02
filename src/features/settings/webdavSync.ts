import type { SyncOverview, WebdavConfig, WebdavConflictStrategy, WebdavSyncAction } from "./types";

export function defaultWebdavConfig(): WebdavConfig {
  return {
    enabled: false,
    endpoint: "",
    username: "",
    password: "",
    remotePath: "floral-notepaper",
    syncOnStartup: false,
    conflictStrategy: "ask",
  };
}

export function normalizeWebdavConfig(config?: Partial<WebdavConfig> | null): WebdavConfig {
  const defaults = defaultWebdavConfig();
  const strategy = normalizeConflictStrategy(config?.conflictStrategy);
  return {
    ...defaults,
    ...config,
    conflictStrategy: strategy,
    remotePath: config?.remotePath || defaults.remotePath,
  };
}

export function normalizeConflictStrategy(value?: string | null): WebdavConflictStrategy {
  if (value === "preferLocal" || value === "preferRemote" || value === "ask") {
    return value;
  }

  return "ask";
}

export function resolveWebdavSyncAction(
  overview: Pick<SyncOverview, "recommendedAction">,
  strategy: WebdavConflictStrategy,
): WebdavSyncAction {
  if (overview.recommendedAction !== "ask") {
    return overview.recommendedAction;
  }

  if (strategy === "preferLocal") {
    return "upload";
  }

  if (strategy === "preferRemote") {
    return "download";
  }

  return "ask";
}
