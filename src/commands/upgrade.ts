import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { logService } from '../utils/log-service.js';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

const execAsync = promisify(exec);

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
  console.log('');
  console.log(chalk.cyan('Verificando instalação do npm...'));
  console.log('');

  const npmInstalled = await checkNpmInstalled();

  if (!npmInstalled) {
    console.log('');
    console.log(chalk.red('✗ npm não encontrado.'));
    console.log(chalk.yellow('Instale Node.js e npm em: https://nodejs.org'));
    console.log('');
    process.exit(1);
  }

  console.log(chalk.green('✓ npm encontrado.'));
  console.log('');
  console.log(chalk.cyan('Atualizando specifica-br para a versão mais recente...'));
  console.log(chalk.gray('Executando: npm i -g specifica-br@latest'));
  console.log('');

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
