export interface Settings {
  enabledUpgradeCommands: string[];
}

export interface LogEntry {
  timestamp: string;
  error: string;
  stackTrace?: string;
}
