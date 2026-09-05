import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
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

test('--pack-model e --pack-effort nao estao declaradas (RF-012, RF-028)', () => {
  const longs = executarTasksCommand.options.map((o) => o.long);
  assert.ok(!longs.includes('--pack-model'), '--pack-model nao deveria existir');
  assert.ok(!longs.includes('--pack-effort'), '--pack-effort nao deveria existir');
});

test('--pack-model e recusada como opcao desconhecida, sem invocar a ferramenta (RF-028)', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'specifica-help-'));
  const env = { ...process.env, HOME: home };

  const { codigo, stderr } = await rodarCliComCodigo(
    ['executar-tasks', path.join(home, 'feature'), '--pack-model', 'sonnet'],
    env
  );

  assert.notEqual(codigo, 0);
  assert.match(stderr, /unknown option '--pack-model'/);
  assert.equal(await haRegistroDeExecucao(home), false);
  await fs.remove(home);
});

test('--pack-effort e recusada como opcao desconhecida, sem invocar a ferramenta (RF-028)', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'specifica-help-'));
  const env = { ...process.env, HOME: home };

  const { codigo, stderr } = await rodarCliComCodigo(
    ['executar-tasks', path.join(home, 'feature'), '--pack-effort', 'low'],
    env
  );

  assert.notEqual(codigo, 0);
  assert.match(stderr, /unknown option '--pack-effort'/);
  assert.equal(await haRegistroDeExecucao(home), false);
  await fs.remove(home);
});

async function rodarCliComCodigo(
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<{ codigo: number | undefined; stderr: string }> {
  return execFileAsync('node', [binPath, ...args], { cwd: raiz, env }).then(
    ({ stderr }) => ({ codigo: 0, stderr }),
    (erro: { code?: number; stderr?: string }) => ({
      codigo: erro.code,
      stderr: String(erro.stderr ?? ''),
    })
  );
}

async function haRegistroDeExecucao(home: string): Promise<boolean> {
  const base = path.join(home, '.specifica-br', 'logs');
  if (!(await fs.pathExists(base))) {
    return false;
  }
  const projetos = await fs.readdir(base);
  for (const projeto of projetos) {
    const arquivos = await fs.readdir(path.join(base, projeto));
    if (arquivos.some((nome) => nome.endsWith('.jsonl'))) {
      return true;
    }
  }
  return false;
}
