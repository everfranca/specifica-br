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
import prompts from 'prompts';

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

  /**
   * Obtém a versão mais recente com timeout configurável
   * @param packageName Nome do pacote
   * @param timeoutMs Timeout em milissegundos
   * @returns Promise com a versão ou null em caso de timeout/erro
   */
  private async getLatestVersionWithTimeout(packageName: string, timeoutMs: number): Promise<string | null> {
    try {
      // Criar uma Promise de timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na verificação de versão')), timeoutMs);
      });

      // Correr as duas promises em paralelo - a primeira a resolver/rejeitar vence
      const version = await Promise.race([
        this.getLatestVersion(packageName),
        timeoutPromise
      ]);

      return version;
    } catch (error) {
      // Em caso de timeout ou erro, retornar null silenciosamente
      return null;
    }
  }

  /**
   * Verifica se há uma nova versão disponível
   * @param currentVersion Versão atual
   * @param latestVersion Versão mais recente
   * @returns boolean true se houver nova versão
   */
  private isNewVersionAvailable(currentVersion: string, latestVersion: string): boolean {
    // Validar versões
    if (!this.isValidVersion(currentVersion) || !this.isValidVersion(latestVersion)) {
      return false;
    }

    // Verificar se a versão atual é menor que a mais recente
    return semver.lt(currentVersion, latestVersion);
  }

  /**
   * Obtém a versão atual do package.json
   * @returns string com a versão atual
   */
  private getCurrentVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
      return packageJson.version;
    } catch (error) {
      throw new Error('Não foi possível ler a versão atual do package.json');
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

  /**
   * Exibe prompt interativo perguntando se o usuário deseja atualizar
   * @param latestVersion Versão mais recente disponível
   * @returns Promise<boolean> true se o usuário aceitar atualizar
   */
  private async promptUserForUpdate(latestVersion: string): Promise<boolean> {
    try {
      const response = await prompts({
        type: 'confirm',
        name: 'shouldUpdate',
        message: `Uma nova versão (${latestVersion}) está disponível. Deseja atualizar agora?`,
        initial: true
      });

      // Se o usuário pressionar Ctrl+C, response será undefined
      if (response === undefined) {
        return false;
      }

      return response.shouldUpdate;
    } catch (error) {
      // Em caso de erro no prompt, assumir que o usuário não quer atualizar
      return false;
    }
  }

  /**
   * Exibe prompt de retry após falha na atualização
   * @returns Promise<boolean> true se o usuário quiser tentar novamente
   */
  private async promptForRetry(): Promise<boolean> {
    try {
      const response = await prompts({
        type: 'confirm',
        name: 'shouldRetry',
        message: 'Erro ao atualizar. Deseja tentar novamente?',
        initial: true
      });

      // Se o usuário pressionar Ctrl+C, response será undefined
      if (response === undefined) {
        return false;
      }

      return response.shouldRetry;
    } catch (error) {
      // Em caso de erro no prompt, assumir que o usuário não quer tentar novamente
      return false;
    }
  }

  /**
   * Executa a atualização do pacote via npm install -g
   * @param retryCount Número de tentativas já realizadas
   * @returns Promise<void>
   */
  private async executeUpdate(retryCount: number = 0): Promise<void> {
    try {
      // Executar comando de atualização
      await execAsync('npm install -g specifica-br@latest', {
        timeout: 60000, // Timeout de 60 segundos para o npm install
      });

      // Exibir mensagem de sucesso
      console.log('specifica-br atualizado com sucesso!');
      
      // Encerrar processo após atualização bem-sucedida
      process.exit(0);
    } catch (error) {
      // Log de erro
      logService.logError(error instanceof Error ? error : new Error(String(error)), 'UpdateInterceptorMiddleware - Falha na atualização');
      
      // Exibir mensagem de erro para o usuário
      console.error('Erro ao atualizar specifica-br:');
      console.error(error instanceof Error ? error.message : String(error));
      
      // Perguntar se deseja tentar novamente
      const shouldRetry = await this.promptForRetry();
      
      if (shouldRetry) {
        // Limitar a 3 tentativas para evitar loop infinito
        if (retryCount < 2) {
          console.log('Tentando novamente...');
          await this.executeUpdate(retryCount + 1);
        } else {
          console.error('Número máximo de tentativas atingido. Por favor, tente atualizar manualmente.');
        }
      }
      
      // Se não quiser tentar novamente ou atingir limite de tentativas, lançar erro
      throw error;
    }
  }

  /**
   * Gerencia o fluxo completo de atualização
   * @param latestVersion Versão mais recente disponível
   * @param originalAction Função original a ser executada se recusar atualização
   * @returns Promise<void>
   */
  private async handleUpdateFlow(latestVersion: string, originalAction: () => Promise<void>): Promise<void> {
    // Perguntar ao usuário se deseja atualizar
    const shouldUpdate = await this.promptUserForUpdate(latestVersion);
    
    if (!shouldUpdate) {
      // Se recusou, executar ação original
      await originalAction();
      return;
    }
    
    // Se aceitou, executar atualização
    try {
      await this.executeUpdate();
    } catch (error) {
      // Em caso de falha na atualização, executar ação original
      console.log('Continuando com o comando original...');
      await originalAction();
    }
  }

  /**
   * Envelopa uma função com verificação de atualização
   * @param commandName Nome do comando sendo executado
   * @param originalAction Função original a ser executada
   * @returns Promise com o resultado da função original
   */
  public async wrap(commandName: string, originalAction: () => Promise<void>): Promise<void> {
    // Verificar se o comando está na lista de comandos habilitados para verificação
    const settings = await settingsService.getSettings();
    const enabledCommands = settings.enabledUpgradeCommands || [];
    
    if (!enabledCommands.includes(commandName)) {
      // Se não estiver na lista, executar ação original sem verificação
      await originalAction();
      return;
    }

    // Obter configuração de timeout
    const timeoutMs = settings.versionCheckTimeoutMs || 1500;

    try {
      // Verificar versão mais recente com timeout
      const latestVersion = await this.getLatestVersionWithTimeout('specifica-br', timeoutMs);
      
      // Se não conseguiu obter versão (timeout, erro, etc.), executar ação original
      if (!latestVersion) {
        await originalAction();
        return;
      }

      // Obter versão atual
      const currentVersion = this.getCurrentVersion();

      // Verificar se há nova versão disponível
      if (!this.isNewVersionAvailable(currentVersion, latestVersion)) {
        // Se não há nova versão, executar ação original
        await originalAction();
        return;
      }

      // Se chegou aqui, há nova versão disponível - iniciar fluxo de atualização
      await this.handleUpdateFlow(latestVersion, originalAction);
      
    } catch (error) {
      // Em caso de qualquer erro no fluxo de interceptação, executar ação original
      logService.logError(error instanceof Error ? error : new Error(String(error)), `UpdateInterceptorMiddleware - Erro no comando ${commandName}`);
      await originalAction();
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
