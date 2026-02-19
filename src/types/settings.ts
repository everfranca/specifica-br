export interface Settings {
  enabledUpgradeCommands: string[];
  versionCheckTimeoutMs?: number;
}

export interface LogEntry {
  timestamp: string;
  error: string;
  stackTrace?: string;
}
