import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logService } from '../utils/log-service.js';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';
import latestVersion from 'latest-version';
import semver from 'semver';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.join(__dirname, '..', '..', 'package.json');

async function getCurrentVersion(): Promise<string> {
  try {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    throw new Error('Não foi possível ler a versão atual do package.json');
  }
}

async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const version = await latestVersion(packageName);
    return version;
  } catch (error) {
    const { stdout } = await execAsync(`npm view ${packageName} version`);
    const version = stdout.trim();
    return version;
  }
}

async function isVersionOutdated(currentVersion: string, remoteVersion: string): Promise<boolean> {
  if (!semver.valid(currentVersion) || !semver.valid(remoteVersion)) {
    return false;
  }
  return semver.lt(currentVersion, remoteVersion);
}

function isWindows(): boolean {
  return platform() === 'win32';
}

async function checkNpmInstalled(): Promise<boolean> {
  try {
    await execAsync('npm --version');
    return true;
  } catch (error) {
    return false;
  }
}

async function runUpgradeCommand(): Promise<void> {
  const npmInstalled = await checkNpmInstalled();

  if (!npmInstalled) {
    console.log(chalk.red('✗ npm não encontrado.'));
    console.log(chalk.yellow('Instale Node.js e npm em: https://nodejs.org'));
    process.exit(1);
  }

  console.log(chalk.cyan('Verificando se há atualizações disponíveis...'));

  try {
    const currentVersion = await getCurrentVersion();
    const remoteVersion = await getLatestVersion('specifica-br');
    const outdated = await isVersionOutdated(currentVersion, remoteVersion);

    if (!outdated) {
      console.log(chalk.green(`specifica-br atualização ignorada: a versão ${currentVersion} já está instalada`));
      console.log('');
      process.exit(0);
    }

    console.log(chalk.cyan('Atualizando specifica-br para a versão mais recente...'));
    console.log(chalk.gray(`Versão atual: ${currentVersion} → ${remoteVersion}`));
    console.log(chalk.gray('Executando: npm i -g specifica-br@latest'));
    console.log('');
  } catch (error) {
    console.log('');
    console.log(chalk.yellow('Aviso: Não foi possível verificar a versão mais recente. Continuando com a atualização...'));
    console.log('');
  }

  try {
    const { stdout, stderr } = await execAsync('npm i -g specifica-br@latest', {
      maxBuffer: 1024 * 1024 * 10,
      shell: true
    } as any);

    if (stdout) {
      console.log(stdout);
    }

    if (stderr) {
      console.log(chalk.yellow(stderr));
    }

    console.log('');
    console.log(chalk.green('✓ specifica-br atualizado com sucesso!'));
    console.log('');
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
        console.log('');
        console.log(chalk.red('✗ Permissão negada.'));

        if (isWindows()) {
          console.log(chalk.yellow('Execute como administrador (clique com botão direito > Executar como administrador)'));
        } else {
          console.log(chalk.yellow('Execute: sudo specifica-br upgrade'));
        }

        console.log('');
        process.exit(1);
      }

      console.log('');
      console.log(chalk.red('✗ Erro ao atualizar specifica-br.'));
      
      const logPath = await logService.logError(error, 'UpgradeCommand');
      console.log(chalk.yellow(`Log detalhado salvo em: ${logPath}`));
      console.log('');
      console.log(chalk.cyan('Tente executar manualmente:'));
      console.log(chalk.gray('  npm i -g specifica-br@latest'));
      
      if (isWindows()) {
        console.log(chalk.gray('  (Execute como administrador se necessário)'));
      } else {
        console.log(chalk.gray('  (Use sudo se necessário)'));
      }
      
      console.log('');
      
      process.exit(1);
    }

    console.log('');
    console.log(chalk.red('✗ Erro desconhecido ao executar upgrade.'));
    console.log('');
    
    process.exit(1);
  }
}

async function wrappedRunUpgradeCommand(): Promise<void> {
  await updateNotifierMiddleware.wrap('upgrade', runUpgradeCommand);
}

export const upgradeCommand = new Command('upgrade')
  .description('Atualiza a CLI para a versão mais recente do NPM')
  .action(wrappedRunUpgradeCommand);
