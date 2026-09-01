import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import { configCommand } from '../dist/commands/config.js';
import { executarTasksCommand } from '../dist/commands/executar-tasks.js';

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binPath = path.join(raiz, 'dist', 'index.js');

function rodar(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('node', [binPath, ...args], { cwd: raiz }).catch((erro) => ({
    stdout: String(erro.stdout ?? ''),
    stderr: String(erro.stderr ?? ''),
  }));
}

test('a ajuda curta lista executar-tasks e config', async () => {
  const { stdout } = await rodar(['help']);
  assert.match(stdout, /executar-tasks/);
  assert.match(stdout, /\bconfig\b/);
});

test('a ajuda --completo documenta o passo 6 do workflow com a forma em lote', async () => {
  const { stdout } = await rodar(['help', '--completo']);
  assert.match(stdout, /6\. Execução de Tarefas/);
  assert.match(stdout, /specifica-br executar-tasks/);
});

test('os dois subcomandos estao registrados no program', async () => {
  const { stdout } = await rodar(['--help']);
  assert.match(stdout, /executar-tasks \[options\] <feature-dir>/);
  assert.match(stdout, /config \[chave\] \[valor\]/);
});

test('os comandos existentes init, help e upgrade continuam registrados e inalterados', async () => {
  const { stdout } = await rodar(['--help']);
  assert.match(stdout, /\binit \[options\]/);
  assert.match(stdout, /\bhelp \[options\]/);
  assert.match(stdout, /\bupgrade\b/);
});

test('o program usa parseAsync e os comandos existentes continuam funcionando', async () => {
  const indexFonte = readFileSync(path.join(raiz, 'src', 'index.ts'), 'utf-8');
  assert.match(indexFonte, /parseAsync\(process\.argv\)/);
  assert.doesNotMatch(indexFonte, /program\.parse\(process\.argv\)/);

  const init = await rodar(['init', '--help']);
  assert.match(init.stdout, /--local/);
  const upgrade = await rodar(['upgrade', '--help']);
  assert.match(upgrade.stdout, /Usage: specifica-br upgrade/);
  const help = await rodar(['help']);
  assert.match(help.stdout, /Commands:/);
});

test('os comandos exportam Command com o nome esperado', () => {
  assert.equal(configCommand.name(), 'config');
  assert.equal(executarTasksCommand.name(), 'executar-tasks');
});
