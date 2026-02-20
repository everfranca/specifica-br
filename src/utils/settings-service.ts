import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { Settings } from '../types/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'assets', 'settings.json');

class SettingsService {
  private cachedSettings: Settings | null = null;

  public async getSettings(): Promise<Settings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const settingsContent = await fs.readFile(SETTINGS_PATH, 'utf-8');
      const settings: Settings = JSON.parse(settingsContent);

      this.cachedSettings = settings;
      return settings;
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === 'ENOENT') {
        const defaultSettings: Settings = {
          enabledUpgradeCommands: ['init', 'help', 'upgrade']
        };
        this.cachedSettings = defaultSettings;
        return defaultSettings;
      }

      throw error;
    }
  }

  public isCommandEnabled(commandName: string): boolean {
    if (!this.cachedSettings) {
      return true;
    }

    return this.cachedSettings.enabledUpgradeCommands.includes(commandName);
  }
}

export { SettingsService };
export const settingsService = new SettingsService();
