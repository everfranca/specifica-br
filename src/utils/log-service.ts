import fs from 'fs-extra';
import path from 'path';
import { LogEntry } from '../types/settings.js';

const LOGS_DIR = path.join(process.cwd(), '.specifica-br', 'logs');

class LogService {
  private async ensureLogsDirectoryExists(): Promise<void> {
    try {
      await fs.ensureDir(LOGS_DIR);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private generateLogFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const fileName = `log_${year}_${month}_${day}_${hours}_${minutes}_${seconds}.txt`;
    return fileName;
  }

  public async logError(error: Error, context?: string): Promise<string> {
    await this.ensureLogsDirectoryExists();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stackTrace: error.stack
    };

    const fileName = this.generateLogFileName();
    
    const filePath = path.join(LOGS_DIR, fileName);

    let logContent = `[${logEntry.timestamp}] ERROR\n`;
    logContent += `Message: ${logEntry.error}\n`;

    if (context) {
      logContent += `Context: ${context}\n`;
    }

    if (logEntry.stackTrace) {
      logContent += `Stack Trace:\n${logEntry.stackTrace}\n`;
    }

    await fs.writeFile(filePath, logContent);

    return path.resolve(filePath);
  }
}

export { LogService };
export const logService = new LogService();
