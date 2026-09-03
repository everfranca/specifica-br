import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { RunLoggerService, buildRunId } from '../dist/utils/run-logger.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-'));
});

afterEach(async () => {
  await fs.remove(dir);
});

test('buildRunId produz YYYYMMDD_HHmmss em horario local com zeros a esquerda', () => {
  const id = buildRunId(new Date(2026, 0, 5, 3, 7, 9));
  assert.strictEqual(id, '20260105_030709');
});

test('open cria o diretorio de registros e os dois arquivos, inclusive o .stderr vazio', async () => {
  const logsDir = path.join(dir, 'logs', 'projeto-x');
  const logger = new RunLoggerService();
  await logger.open(logsDir, '20260105_030709');
  await logger.close();

  assert.strictEqual(await fs.pathExists(path.join(logsDir, 'run_20260105_030709.jsonl')), true);
  const stderr = path.join(logsDir, 'run_20260105_030709.stderr');
  assert.strictEqual(await fs.pathExists(stderr), true);
  assert.strictEqual(await fs.readFile(stderr, 'utf-8'), '');
});

test('logEvent grava uma linha JSON valida por evento, com \\n ao final', async () => {
  const logsDir = path.join(dir, 'logs', 'p');
  const logger = new RunLoggerService();
  await logger.open(logsDir, 'RID');
  await logger.logEvent({ event: 'start', ts: '', task: 'task-1.md' } as never);
  await logger.logEvent({ event: 'end', ts: '2026-01-01T00:00:00.000Z', task: 'task-1.md' } as never);
  await logger.close();

  const texto = await fs.readFile(path.join(logsDir, 'run_RID.jsonl'), 'utf-8');
  const linhas = texto.split('\n');
  assert.strictEqual(linhas.length, 3);
  assert.strictEqual(linhas[2], '');
  const primeiro = JSON.parse(linhas[0]);
  assert.strictEqual(primeiro.event, 'start');
  assert.ok(primeiro.ts.length > 0);
});

test('os arquivos sao abertos em append e eventos anteriores sobrevivem a uma reabertura', async () => {
  const logsDir = path.join(dir, 'logs', 'p');

  const primeiro = new RunLoggerService();
  await primeiro.open(logsDir, 'RID');
  await primeiro.logEvent({ event: 'start', ts: 'x', task: 'a' } as never);
  await primeiro.close();

  const segundo = new RunLoggerService();
  await segundo.open(logsDir, 'RID');
  await segundo.logEvent({ event: 'end', ts: 'y', task: 'a' } as never);
  await segundo.close();

  const linhas = (await fs.readFile(path.join(logsDir, 'run_RID.jsonl'), 'utf-8'))
    .split('\n')
    .filter(Boolean);
  assert.strictEqual(linhas.length, 2);
});

test('appendStderr grava no arquivo e nao escreve em stdout', async () => {
  const logsDir = path.join(dir, 'logs', 'p');
  const logger = new RunLoggerService();
  await logger.open(logsDir, 'RID');

  const original = process.stdout.write.bind(process.stdout);
  let chamadas = 0;
  process.stdout.write = ((...args: unknown[]) => {
    chamadas += 1;
    return (original as (...a: unknown[]) => boolean)(...args);
  }) as typeof process.stdout.write;

  try {
    logger.appendStderr('linha de erro\n');
  } finally {
    process.stdout.write = original;
  }

  await logger.close();

  assert.strictEqual(chamadas, 0);
  assert.strictEqual(
    await fs.readFile(path.join(logsDir, 'run_RID.stderr'), 'utf-8'),
    'linha de erro\n'
  );
});

test('open lanca a mensagem nominal quando o diretorio nao e gravavel', async (t) => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('processo rodando como root ignora permissoes de diretorio');
    return;
  }

  const logsDir = path.join(dir, 'logs', 'projeto-x');
  await fs.ensureDir(logsDir);
  await fs.chmod(logsDir, 0o500);

  try {
    await assert.rejects(new RunLoggerService().open(logsDir, 'RID'), {
      message: 'sem permissao de escrita em ~/.specifica-br/logs/<projeto>/',
    });
  } finally {
    await fs.chmod(logsDir, 0o700);
  }
});

test('nenhum valor de variavel de ambiente e gravado', async () => {
  const logsDir = path.join(dir, 'logs', 'p');
  const logger = new RunLoggerService();
  await logger.open(logsDir, 'RID');
  process.env.SEGREDO_DE_TESTE = 'valor-secreto-xyz';
  await logger.logEvent({ event: 'run_start', ts: 'x', feature: 'f' } as never);
  await logger.close();
  delete process.env.SEGREDO_DE_TESTE;

  const texto = await fs.readFile(path.join(logsDir, 'run_RID.jsonl'), 'utf-8');
  assert.ok(!texto.includes('valor-secreto-xyz'));
  assert.ok(!texto.includes('SEGREDO_DE_TESTE'));
});

test('readPreviousRuns ignora linhas invalidas sem lancar', async () => {
  const logsDir = path.join(dir, 'logs', 'p');
  await fs.ensureDir(logsDir);
  await fs.writeFile(
    path.join(logsDir, 'run_A.jsonl'),
    '{"event":"start","ts":"x"}\nlixo nao json\n{"event":"end","ts":"y"}\n'
  );

  const eventos = await new RunLoggerService().readPreviousRuns(logsDir);
  assert.deepStrictEqual(
    eventos.map((e) => e.event),
    ['start', 'end']
  );
});

test('readPreviousRuns le apenas as 100 execucoes mais recentes', async () => {
  const logsDir = path.join(dir, 'logs', 'p');
  await fs.ensureDir(logsDir);

  for (let i = 0; i < 103; i += 1) {
    const id = String(i).padStart(3, '0');
    await fs.writeFile(
      path.join(logsDir, `run_${id}.jsonl`),
      `{"event":"skip","ts":"x","task":"task-${id}.md","motivo":"DONE","selecionada":true}\n`
    );
  }

  const eventos = await new RunLoggerService().readPreviousRuns(logsDir);
  const tasks = eventos.map((e) => (e as { task: string }).task);
  assert.strictEqual(tasks.length, 100);
  assert.ok(!tasks.includes('task-000.md'));
  assert.ok(!tasks.includes('task-002.md'));
  assert.ok(tasks.includes('task-003.md'));
  assert.ok(tasks.includes('task-102.md'));
});
