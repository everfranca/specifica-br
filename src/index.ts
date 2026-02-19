import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { helpCommand } from './commands/help.js';
import { upgradeCommand } from './commands/upgrade.js';

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

program.parse(process.argv);
