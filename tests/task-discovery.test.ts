import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { TaskDiscoveryService } from '../dist/utils/task-discovery.js';

let dir: string;

const CABECALHO = (status: string): string =>
  `# Task\n\n| Metadata | Details |\n| :--- | :--- |\n| **Status** | ${status} |\n`;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'td-'));
});

afterEach(async () => {
  await fs.remove(dir);
});

function servico(): TaskDiscoveryService {
  return new TaskDiscoveryService();
}

test('descobre apenas arquivos task-*.md do primeiro nivel e ignora diretorios', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-10.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'outro.md'), '# nada');
  await fs.ensureDir(path.join(dir, 'task-99.md'));
  await fs.ensureDir(path.join(dir, 'sub'));
  await fs.writeFile(path.join(dir, 'sub', 'task-2.md'), CABECALHO('TODO'));

  const tasks = await servico().discover(dir);

  assert.deepStrictEqual(
    tasks.map((t) => t.arquivo),
    ['task-1.md', 'task-10.md']
  );
});

test('ignora zeros a esquerda: task-1 e task-01 sao o numero 1', async () => {
  await fs.writeFile(path.join(dir, 'task-01.md'), CABECALHO('TODO'));

  const [task] = await servico().discover(dir);
  assert.strictEqual(task.numero, 1);
});

test('ordena numericamente: 1, 2, 10 e nao 1, 10, 2', async () => {
  await fs.writeFile(path.join(dir, 'task-10.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-2.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));

  const tasks = await servico().discover(dir);
  assert.deepStrictEqual(
    tasks.map((t) => t.numero),
    [1, 2, 10]
  );
});

test('detecta DONE com variacoes de espaco e caixa', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), '|**Status**|   DONE   |\n');
  await fs.writeFile(path.join(dir, 'task-2.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-3.md'), CABECALHO('IN_PROGRESS'));

  const tasks = await servico().discover(dir);
  assert.deepStrictEqual(
    tasks.map((t) => t.done),
    [true, false, false]
  );
});

test('task-1.md e task-01.md coexistindo mantem ordenacao estavel', async () => {
  await fs.writeFile(path.join(dir, 'task-01.md'), CABECALHO('DONE'));
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));
  const ordemReaddir = await fs.readdir(dir);

  const tasks = await servico().discover(dir);

  assert.deepStrictEqual(
    tasks.map((t) => t.numero),
    [1, 1]
  );
  assert.deepStrictEqual(
    tasks.map((t) => t.arquivo),
    ordemReaddir
  );
});

test('expandSelection rejeita sintaxe invalida, intervalo invertido e selecao vazia', async () => {
  const s = servico();
  assert.throws(() => s.expandSelection('a,b', [1, 2]), /selecao invalida/);
  assert.throws(() => s.expandSelection('3-1', [1, 2, 3]), /intervalo invertido/);
  assert.throws(() => s.expandSelection(',', [1, 2]), /selecao vazia/);
});

test('expandSelection rejeita intervalo acima de 10.000 numeros', async () => {
  assert.throws(() => servico().expandSelection('1-999999999', [1, 2, 3, 4, 5]), /trecho invalido/);
});

test('expandSelection rejeita numero inexistente com a mensagem nominal', async () => {
  assert.throws(
    () => servico().expandSelection('9', [1, 2, 3, 4, 5]),
    (erro: Error) => erro.message === 'task 9 nao existe nesta feature (disponiveis: 1-5)'
  );
});

test('expandSelection aceita lista, intervalo e mistura', async () => {
  const s = servico();
  assert.deepStrictEqual(s.expandSelection('1,2,5', [1, 2, 3, 4, 5]), [1, 2, 5]);
  assert.deepStrictEqual(s.expandSelection('1-3', [1, 2, 3]), [1, 2, 3]);
  assert.deepStrictEqual(s.expandSelection('1-3,7,9-10', [1, 2, 3, 7, 9, 10]), [1, 2, 3, 7, 9, 10]);
});

test('expandSelection ordena numericamente e nao preserva a ordem digitada', async () => {
  assert.deepStrictEqual(servico().expandSelection('10,1,2', [1, 2, 10]), [1, 2, 10]);
});

test('expandSelection remove duplicatas', async () => {
  assert.deepStrictEqual(servico().expandSelection('1,1,2,2-2', [1, 2]), [1, 2]);
});

test('applySelection e filtro e preserva a ordem numerica', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-2.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-10.md'), CABECALHO('TODO'));

  const tasks = await servico().discover(dir);
  const filtrada = servico().applySelection(tasks, [10, 1]);

  assert.deepStrictEqual(
    filtrada.map((t) => t.numero),
    [1, 10]
  );
  assert.ok(filtrada.every((t) => t.selecionada));
});

test('applySelection com selecao nula devolve todas as tasks sem selecao explicita', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-2.md'), CABECALHO('TODO'));

  const tasks = await servico().discover(dir);
  const todas = servico().applySelection(tasks, null);

  assert.strictEqual(todas.length, 2);
  // Sem `--tasks` ninguem foi selecionado nominalmente: o aviso de RF-004
  // ("estava selecionada mas nao foi executada") e reservado a quem pediu a
  // task pelo nome.
  assert.ok(todas.every((t) => t.selecionada === false));
});

test('uma task DONE selecionada continua marcada como done', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('DONE'));

  const tasks = await servico().discover(dir);
  const filtrada = servico().applySelection(tasks, [1]);

  assert.strictEqual(filtrada[0].done, true);
  assert.strictEqual(filtrada[0].selecionada, true);
});

test('isTasksMdWritable nao le nem altera o arquivo', async () => {
  const alvo = path.join(dir, 'tasks.md');
  const conteudo = '# lista\n- [ ] 1.0\n';
  await fs.writeFile(alvo, conteudo);
  const mtimeAntes = (await fs.stat(alvo)).mtimeMs;

  const resultado = await servico().isTasksMdWritable(dir);

  assert.deepStrictEqual(resultado, { existe: true, gravavel: true });
  assert.strictEqual(await fs.readFile(alvo, 'utf-8'), conteudo);
  assert.strictEqual((await fs.stat(alvo)).mtimeMs, mtimeAntes);
});

test('nenhum arquivo de task e modificado pela descoberta', async () => {
  await fs.writeFile(path.join(dir, 'task-1.md'), CABECALHO('TODO'));
  await fs.writeFile(path.join(dir, 'task-2.md'), CABECALHO('DONE'));
  const antes = await fs.readdir(dir);
  const mtimes = await Promise.all(antes.map((n) => fs.stat(path.join(dir, n)).then((s) => s.mtimeMs)));

  await servico().discover(dir);

  const depois = await fs.readdir(dir);
  assert.deepStrictEqual(depois, antes);
  const mtimesDepois = await Promise.all(
    depois.map((n) => fs.stat(path.join(dir, n)).then((s) => s.mtimeMs))
  );
  assert.deepStrictEqual(mtimesDepois, mtimes);
});
