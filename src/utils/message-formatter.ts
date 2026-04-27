import chalk from 'chalk';
import path from 'path';
import type { CopyResult } from '../types/init.js';

export function showSuccessMessage(copyResult: CopyResult): void {
  console.log('');
  console.log(chalk.green.bold('✓ Estrutura SDD criada com sucesso!'));
  console.log('');
  console.log(chalk.gray('Diretórios criados:'));
  if (copyResult.commandsDir) {
    console.log(chalk.gray(`  • ${copyResult.commandsDir}`));
  }
  if (copyResult.skillsDir) {
    console.log(chalk.gray(`  • ${copyResult.skillsDir}`));
  }
  if (copyResult.templatesDir) {
    console.log(chalk.gray(`  • ${copyResult.templatesDir}`));
  }
  console.log('');
  if (copyResult.commandsCopied.length > 0) {
    console.log(chalk.gray('Arquivos de comandos copiados:'));
    copyResult.commandsCopied.forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });
    console.log('');
  }
  if (copyResult.skillsCopied.length > 0) {
    console.log(chalk.gray('Arquivos de skills copiados:'));
    copyResult.skillsCopied.forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });
    console.log('');
  }
  if (copyResult.templatesCopied.length > 0) {
    console.log(chalk.gray('Arquivos de templates copiados:'));
    copyResult.templatesCopied.forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });
    console.log('');
  }
  if (copyResult.commandsDir) {
    const rootDir = copyResult.commandsDir.split(path.sep)[0];
    console.log(chalk.gray('Para começar, navegue até o diretório de comandos:'));
    console.log(chalk.gray(`  cd ${rootDir}`));
    console.log('');
  }
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
  console.log(chalk.cyan.bold('Comece agora com o comando: specifica-br help'));
  console.log('');
}

export function showErrorMessage(message: string): void {
  console.error('');
  console.error(chalk.red.bold('Erro:'));
  console.error(chalk.red(message));
  console.error('');
}

export function showInfoMessage(message: string): void {
  console.log('');
  console.log(chalk.blue('ℹ ' + message));
  console.log('');
}
