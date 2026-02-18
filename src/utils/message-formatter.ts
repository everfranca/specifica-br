import chalk from 'chalk';

export function showSuccessMessage(): void {
  console.log('');
  console.log(chalk.green.bold('✓ Estrutura SDD criada com sucesso!'));
  console.log('');
  console.log(chalk.gray('Diretórios criados:'));
  console.log(chalk.gray('  - .opencode/commands'));
  console.log(chalk.gray('  - specs/templates'));
  console.log('');
  console.log(chalk.gray('Arquivos de comandos copiados:'));
  console.log(chalk.gray('  - gerar-prd.md'));
  console.log(chalk.gray('  - gerar-techspec.md'));
  console.log(chalk.gray('  - gerar-tasks.md'));
  console.log(chalk.gray('  - executar-task.md'));
  console.log('');
  console.log(chalk.gray('Arquivos de templates copiados:'));
  console.log(chalk.gray('  - prd-template.md'));
  console.log(chalk.gray('  - techspec-template.md'));
  console.log(chalk.gray('  - task-template.md'));
  console.log(chalk.gray('  - tasks-template.md'));
  console.log('');
}

export function showMissionMessage(): void {
  console.log('');
  console.log(chalk.cyan.bold('Bem-vindo ao Specifica-BR!'));
  console.log('');
  console.log(chalk.yellow('O que é Spec Driven Development (SDD)?'));
  console.log('');
  console.log(chalk.white('SDD é uma metodologia de desenvolvimento que prioriza'));
  console.log(chalk.white('a documentação e especificação antes da escrita de código.'));
  console.log('');
  console.log(chalk.yellow('Benefícios do SDD:'));
  console.log('');
  console.log(chalk.white('  • Documentação antes do código'));
  console.log(chalk.white('  • Redução de retrabalho'));
  console.log(chalk.white('  • Comunicação alinhada entre times'));
  console.log(chalk.white('  • Maior qualidade e manutenibilidade'));
  console.log('');
  console.log(chalk.yellow('Próximos passos:'));
  console.log('');
  console.log(chalk.white('  1. Execute: specifica help --completo'));
  console.log(chalk.white('  2. Crie seu PRD usando o template'));
  console.log(chalk.white('  3. Gere sua Tech Spec baseada no PRD'));
  console.log(chalk.white('  4. Decomponha em tarefas executáveis'));
  console.log('');
  console.log(chalk.cyan.bold('Comece agora com: specifica help'));
  console.log('');
}

export function showErrorMessage(message: string): void {
  console.error('');
  console.error(chalk.red.bold('✗ Erro:'));
  console.error(chalk.red(message));
  console.error('');
}

export function showInfoMessage(message: string): void {
  console.log('');
  console.log(chalk.blue('ℹ ' + message));
  console.log('');
}
