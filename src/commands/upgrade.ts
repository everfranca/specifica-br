import { Command } from 'commander';
import chalk from 'chalk';

/**
 * Função principal do comando upgrade.
 * Exibe mensagem informativa sobre o comando em desenvolvimento.
 */
function runUpgradeCommand(): void {
  console.log('');
  console.log(chalk.yellow('Comando em desenvolvimento.'));
  console.log(chalk.gray('Em breve você poderá atualizar templates e comandos automaticamente.'));
  console.log('');
}

/**
 * Exporta o comando upgrade configurado para uso no Commander.js.
 */
export const upgradeCommand = new Command('upgrade')
  .description('Atualiza templates e comandos (em breve)')
  .action(runUpgradeCommand);
