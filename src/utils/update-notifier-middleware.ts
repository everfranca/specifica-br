import chalk from 'chalk';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { settingsService } from './settings-service.js';
import { logService } from './log-service.js';
import latestVersion from 'latest-version';
import semver from 'semver';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.join(__dirname, '..', '..', 'package.json');

class UpdateNotifierMiddleware {
  private async shouldNotify(commandName: string): Promise<boolean> {
    const settings = await settingsService.getSettings();
    return settings.enabledUpgradeCommands.includes(commandName);
  }

  private async getLatestVersion(packageName: string): Promise<string | null> {
    try {
      const version = await latestVersion(packageName);
      return version;
    } catch (error) {
      try {
        const { stdout } = await execAsync(`npm view ${packageName} version`);
        const version = stdout.trim();
        return version;
      } catch (fallbackError) {
        console.error('Erro ao obter versão mais recente:', fallbackError);
        return null;
      }
    }
  }

  private isValidVersion(version: string): boolean {
    if (!version) {
      return false;
    }

    const isValid = semver.valid(version);
    return isValid !== null;
  }

  private getUpdateType(currentVersion: string, latestVersion: string): string {
    const diff = semver.diff(currentVersion, latestVersion);

    if (!diff) {
      return 'unknown';
    }

    return diff;
  }

  public async wrap(commandName: string, originalAction: () => void | Promise<void>): Promise<void> {
    try {
      const enabled = await this.shouldNotify(commandName);

      if (!enabled) {
        await originalAction();
        return;
      }

      await originalAction();

      const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
      const currentVersion = packageJson.version;
      const latestVersion = await this.getLatestVersion('specifica-br');

      if (!latestVersion || !this.isValidVersion(latestVersion)) {
        return;
      }

      if (!semver.lt(currentVersion, latestVersion)) {
        return;
      }

      const updateType = this.getUpdateType(currentVersion, latestVersion);

      this.displayNotification({
        name: 'specifica-br',
        currentVersion,
        latestVersion,
        type: updateType
      });
    } catch (error) {
      if (error instanceof Error) {
        const logPath = await logService.logError(error, `UpdateNotifierMiddleware - Command: ${commandName}`);
        console.log('');
        console.log(chalk.yellow('Erro ao verificar atualizações.'));
        console.log(chalk.gray(`Log detalhado salvo em: ${logPath}`));
        console.log('');
      }
    }
  }

  private displayNotification(update: {
    name: string;
    currentVersion: string;
    latestVersion: string;
    type: string;
  }): void {
    const { name, currentVersion, latestVersion, type } = update;

    const lines = [
      'Update disponível',
      '',
      `${name} 🇧🇷`,
      `${currentVersion} → ${latestVersion}`,
      '',
      `Tipo: ${type}`,
      '',
      'Run specifica-br upgrade',
      'Run npm i -g specifica-br para atualizar'
    ];

    const boxWidth = 60;
    const horizontalBorder = '─'.repeat(boxWidth);
    
    console.log('');
    console.log(chalk.bgYellow.black('┌' + horizontalBorder + '┐'));
    
    lines.forEach(line => {
      const content = line.trim() === '' ? '' : line;
      let visualLength = 0;
      const hasFlagEmoji = content.includes('🇧🇷');
      let tempContent = content;
      
      if (hasFlagEmoji) {
        tempContent = content.replace('🇧🇷', '  ');
      }
      
      for (let i = 0; i < tempContent.length; i++) {
        const char = tempContent[i];
        const codePoint = char.codePointAt(0) || 0;
        if (codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF) {
          visualLength += 2;
        } else {
          visualLength += 1;
        }
      }
      
      if (hasFlagEmoji) {
        visualLength += 2;
      }
      
      const padding = Math.max(0, boxWidth - visualLength);
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = hasFlagEmoji ? padding - leftPadding + 2 : padding - leftPadding;
      const paddedLine = ' '.repeat(leftPadding) + content + ' '.repeat(rightPadding);
      
      console.log(chalk.bgYellow.black('│' + paddedLine + '│'));
    });
    
    console.log(chalk.bgYellow.black('└' + horizontalBorder + '┘'));
    console.log('');
  }
}

export const updateNotifierMiddleware = new UpdateNotifierMiddleware();
