import chalk from 'chalk';
import path from 'path';
import type { CopyResult, CopyTarget, TargetKind } from '../types/init.js';
import { shortenPath } from './path-resolver.js';

const KIND_LABELS: Record<TargetKind, string> = {
  commands: 'Comandos',
  skills: 'Skills',
  templates: 'Templates'
};

/**
 * Caminhos dentro do projeto saem relativos (`specs/templates/`) e os de fora
 * com `~` no lugar do home (`~/.claude/commands/`).
 */
export function displayPath(target: string): string {
  const relative = path.relative(process.cwd(), target);

  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative;
  }

  return shortenPath(target);
}

/**
 * `~/.agents/skills/ (Gemini CLI, OpenCode)` -- deixa explicito quando um mesmo
 * diretorio atende mais de uma ferramenta.
 */
export function describeTarget(target: CopyTarget): string {
  return `${displayPath(target.dir)} (${target.tools.join(', ')})`;
}

export function showTargetsPreview(targets: CopyTarget[]): void {
  for (const kind of ['commands', 'skills', 'templates'] as const) {
    const ofKind = targets.filter(target => target.kind === kind);

    if (ofKind.length === 0) {
      continue;
    }

    console.log(chalk.gray(`  ${KIND_LABELS[kind]}:`));
    ofKind.forEach(target => {
      console.log(chalk.gray(`    • ${describeTarget(target)}`));
    });
  }
}

export function showSuccessMessage(copyResult: CopyResult): void {
  console.log('');
  console.log(chalk.green.bold('✓ Estrutura SDD criada com sucesso!'));
  console.log('');
  console.log(chalk.gray(
    copyResult.scope === 'global'
      ? 'Instalação global (compartilhada por todos os projetos):'
      : 'Instalação no projeto atual:'
  ));
  console.log('');

  for (const kind of ['commands', 'skills', 'templates'] as const) {
    const ofKind = copyResult.targets.filter(target => target.kind === kind);

    if (ofKind.length === 0) {
      continue;
    }

    for (const target of ofKind) {
      console.log(chalk.gray(`${KIND_LABELS[kind]} — ${describeTarget(target)}`));
      target.files.forEach(file => {
        console.log(chalk.gray(`  • ${file}`));
      });
      console.log('');
    }
  }

  if (copyResult.projectCleanup.removed.length > 0) {
    console.log(chalk.gray('Instalação antiga removida do projeto:'));
    copyResult.projectCleanup.removed.forEach(entry => {
      console.log(chalk.gray(`  • ${displayPath(entry)}`));
    });
    console.log('');
  }

  copyResult.projectCleanup.keptDirs.forEach(dir => {
    console.log(chalk.yellow(`Atenção: ${displayPath(dir)} ainda contém arquivos que não são do specifica-br`));
    console.log(chalk.yellow('e por isso foi mantido. Revise o conteúdo restante manualmente.'));
    console.log('');
  });

  if (copyResult.scope === 'global') {
    console.log(chalk.gray('Os comandos e skills já estão disponíveis em qualquer projeto —'));
    console.log(chalk.gray('não é preciso rodar o init novamente a cada repositório.'));
    console.log('');
  } else {
    const commandsTarget = copyResult.targets.find(target => target.kind === 'commands');

    if (commandsTarget) {
      const relative = path.relative(process.cwd(), commandsTarget.dir) || '.';
      console.log(chalk.gray('Para começar, navegue até o diretório de comandos:'));
      console.log(chalk.gray(`  cd ${relative}`));
      console.log('');
    }
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
