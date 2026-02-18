#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { helpCommand } from './commands/help';
import { upgradeCommand } from './commands/upgrade';

const program = new Command();

program
  .name('specifica-br')
  .description('Ferramenta de automação para desenvolvimento guiado por especificações (Spec Driven Development - SDD) com IA. Otimizado para o ecossistema brasileiro.')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(helpCommand);
program.addCommand(upgradeCommand);

program.parse(process.argv);
