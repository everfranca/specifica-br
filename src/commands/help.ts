import { Command } from 'commander';
import chalk from 'chalk';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

/**
 * Exibe o workflow completo de Spec Driven Development (SDD).
 * Mostra o fluxo detalhado desde a inicialização até a execução de tarefas.
 */
function showCompleteHelp(): void {
  console.log('');
  console.log(chalk.cyan.bold('Workflow Completo de Spec Driven Development (SDD)'));
  console.log('');
  console.log(chalk.yellow('1. Inicialização:'));
  console.log(chalk.white('   $ specifica init'));
  console.log(chalk.gray('   Cria estrutura de diretórios e templates no projeto.'));
  console.log('');
  console.log(chalk.yellow('2. Geração de PRD:'));
  console.log(chalk.white('   /gerar-prd [sua ideia]'));
  console.log(chalk.gray('   Define requisitos funcionais e regras de negócio da feature.'));
  console.log('');
  console.log(chalk.yellow('3. Geração de Tech Spec:'));
  console.log(chalk.white('   /gerar-techspec [caminho do prd]'));
  console.log(chalk.gray('   Define arquitetura técnica, componentes e plano de implementação.'));
  console.log('');
  console.log(chalk.yellow('4. Geração de Tarefas:'));
  console.log(chalk.white('   /gerar-tasks [caminho do prd] [caminho do tech spec]'));
  console.log(chalk.gray('   Decompõe o plano técnico em tarefas executáveis.'));
  console.log('');
  console.log(chalk.yellow('5. Execução de Tarefas:'));
  console.log(chalk.white('   /executar-task [caminho da task] [prd] [tech spec]'));
  console.log(chalk.gray('   Implementa cada tarefa individualmente seguindo a especificação.'));
  console.log('');
  console.log(chalk.cyan.bold('Benefícios do SDD:'));
  console.log('');
  console.log(chalk.white('  • Documentação antes do código'));
  console.log(chalk.white('  • Redução de retrabalho'));
  console.log(chalk.white('  • Comunicação alinhada entre times'));
  console.log('');
}

/**
 * Função principal do comando help.
 * Exibe ajuda simplificada ou completa baseada na flag --completo.
 */
function runHelpCommand(options: { completo?: boolean }): void {
  if (options.completo) {
    showCompleteHelp();
  } else {
    console.log('');
    console.log(chalk.cyan.bold('Usage:'));
    console.log(chalk.white('  specifica-br [options] [command]'));
    console.log('');
    console.log(chalk.cyan.bold('Options:'));
    console.log(chalk.white('  -V, --version     output the version number'));
    console.log(chalk.white('  -h, --help        display help for command'));
    console.log('');
    console.log(chalk.cyan.bold('Commands:'));
    console.log(chalk.white('  init              Inicializa estrutura SDD no projeto atual'));
    console.log(chalk.white('  help [command]    display help for command'));
    console.log(chalk.white('  upgrade           Atualiza templates e comandos (em breve)'));
    console.log('');
    console.log(chalk.gray('Para ajuda detalhada, use: specifica-br help --completo'));
    console.log('');
  }
}

async function wrappedRunHelpCommand(options: { completo?: boolean }): Promise<void> {
  await updateNotifierMiddleware.wrap('help', () => runHelpCommand(options));
}

/**
 * Exporta o comando help configurado para uso no Commander.js.
 */
export const helpCommand = new Command('help')
  .description('Exibe ajuda dos comandos disponíveis')
  .option('--completo', 'Exibe ajuda detalhada com workflow completo')
  .action(wrappedRunHelpCommand);
