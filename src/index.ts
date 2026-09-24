import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { helpCommand } from './commands/help.js';
import { upgradeCommand } from './commands/upgrade.js';
import { executarTasksCommand } from './commands/executar-tasks.js';
import { configCommand } from './commands/config.js';
import { onboardingService } from './utils/onboarding-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('specifica-br')
  .description('Ferramenta de automação para desenvolvimento guiado por especificações (Spec Driven Development - SDD) com IA. Otimizado para o ecossistema brasileiro.')
  .version(packageJson.version);

program.addCommand(initCommand);
program.addCommand(helpCommand);
program.addCommand(upgradeCommand);
program.addCommand(executarTasksCommand);
program.addCommand(configCommand);

const COMANDOS_COM_FLUXO_PROPRIO = ['init', 'upgrade'];
const primeiroArgumento = process.argv[2] ?? '';

if (!COMANDOS_COM_FLUXO_PROPRIO.includes(primeiroArgumento) && !primeiroArgumento.startsWith('-')) {
  await onboardingService.garantirOnboardingSeNecessario();
}

// parseAsync (nao parse): as acoes de executar-tasks e config sao assincronas de
// ponta a ponta e parse() encerraria o processo antes do fim do lote.
program.parseAsync(process.argv);
