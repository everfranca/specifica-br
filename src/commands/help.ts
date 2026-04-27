import { Command } from 'commander';
import chalk from 'chalk';
import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';

function showCompleteHelp(): void {
  console.log('');
  console.log(chalk.cyan.bold('Workflow Completo de Spec Driven Development (SDD)'));
  console.log('');
  console.log(chalk.yellow('1. Inicialização:'));
  console.log(chalk.white('   $ specifica init'));
  console.log(chalk.gray('   Cria estrutura de diretórios e templates no projeto.'));
  console.log('');
  console.log(chalk.yellow('2. Definição do Contexto:'));
  console.log(chalk.gray('   Escolha baseada no tipo de projeto:'));
  console.log('');
  console.log(chalk.white('   Projeto Novo (Green Field):'));
  console.log(chalk.white('   /gerar-visao [sua ideia]'));
  console.log(chalk.gray('   Define Fundação (Contexto + Stack) - Role: Product Manager + Tech Lead - Foco: Visão macro'));
  console.log('');
  console.log(chalk.white('   Projeto em Desenvolvimento (Brown Field):'));
  console.log(chalk.white('   /gerar-contexto'));
  console.log(chalk.gray('   Analisa código e INFERE (Contexto + Stack) - Role: Engenheiro Senior + Arquiteto - Foco: Análise automática'));
  console.log('');
  console.log(chalk.yellow('3. Geração de PRD:'));
  console.log(chalk.white('   /gerar-prd [sua ideia]'));
  console.log(chalk.gray('   Define requisitos funcionais e regras de negócio da feature.'));
  console.log('');
  console.log(chalk.yellow('4. Geração de Tech Spec:'));
  console.log(chalk.white('   /gerar-techspec [caminho do prd]'));
  console.log(chalk.gray('   Define arquitetura técnica, componentes e plano de implementação.'));
  console.log('');
  console.log(chalk.yellow('5. Geração de Tarefas:'));
  console.log(chalk.white('   /gerar-tasks [caminho do prd] [caminho do tech spec]'));
  console.log(chalk.gray('   Decompõe o plano técnico em tarefas executáveis.'));
  console.log('');
  console.log(chalk.yellow('6. Execução de Tarefas:'));
  console.log(chalk.white('   /executar-task [caminho da task]'));
  console.log(chalk.gray('   Implementa cada tarefa individualmente seguindo a especificação.'));
  console.log('');
  console.log(chalk.yellow('7. Code Review:'));
  console.log(chalk.white('   /realizar-codereview'));
  console.log(chalk.gray('   Realiza code review do código implementado.'));
  console.log('');
  console.log(chalk.cyan.bold('Ferramentas de IA suportadas:'));
  console.log('');
  console.log(chalk.white('  • ClaudeCode'));
  console.log(chalk.white('  • Cursor'));
  console.log(chalk.white('  • Gemini CLI'));
  console.log(chalk.white('  • Kiro'));
  console.log(chalk.white('  • OpenCode'));
  console.log('');
  console.log(chalk.cyan.bold('Benefícios do SDD:'));
  console.log('');
  console.log(chalk.white('  • Documentação antes do código'));
  console.log(chalk.white('  • Redução de retrabalho'));
  console.log(chalk.white('  • Comunicação alinhada entre vezes'));
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
    console.log(chalk.white('  -V, --version     output version number'));
    console.log(chalk.white('  -h, --help        display help for command'));
    console.log('');
    console.log(chalk.cyan.bold('Commands:'));
    console.log(chalk.white('  init              Inicializa estrutura SDD no projeto atual'));
    console.log(chalk.white('  help [command]    display help for command'));
    console.log(chalk.white('  upgrade           Atualiza templates e comandos (em breve)'));
    console.log('');
    console.log(chalk.cyan.bold('Ferramentas de IA suportadas:'));
    console.log(chalk.white('  OpenCode, ClaudeCode, Cursor, Gemini CLI, Kiro'));
    console.log('');
    console.log(chalk.gray('Para ajuda detalhada, use: specifica-br help --completo'));
    console.log('');
  }
}

async function wrappedRunHelpCommand(options: { completo?: boolean }): Promise<void> {
  await updateNotifierMiddleware.wrap('help', async () => { runHelpCommand(options); });
}

/**
 * Exporta o comando help configurado para uso no Commander.js.
 */
export const helpCommand = new Command('help')
  .description('Exibe ajuda dos comandos disponíveis')
  .option('--completo', 'Exibe ajuda detalhada com workflow completo')
  .action(wrappedRunHelpCommand);
