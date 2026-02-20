import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { Settings } from '../types/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

class SettingsService {
  public async getSettings(): Promise<Settings> {
    try {
      const settingsContent = await fs.readFile(SETTINGS_PATH, 'utf-8');
      const settings: Settings = JSON.parse(settingsContent);
      return settings;
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === 'ENOENT') {
        const defaultSettings: Settings = {
          enabledUpgradeCommands: ['init', 'help', 'upgrade']
        };
        return defaultSettings;
      }

      throw error;
    }
  }
}

export { SettingsService };
export const settingsService = new SettingsService();
