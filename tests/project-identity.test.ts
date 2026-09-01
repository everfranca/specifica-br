import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  ProjectIdentityService,
  sanitizeProjectName,
} from '../dist/utils/project-identity.js';

interface FakeRunResult {
  exitCode: number;
  signal: null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnFailed: boolean;
}

function res(parcial: Partial<FakeRunResult>): FakeRunResult {
  return {
    exitCode: 0,
    signal: null,
    stdout: '',
    stderr: '',
    timedOut: false,
    spawnFailed: false,
    ...parcial,
  };
}

function fakeRunner(roteiro: FakeRunResult[]): any {
  let i = 0;
  return {
    run: async (): Promise<FakeRunResult> => roteiro[Math.min(i++, roteiro.length - 1)],
  };
}

function servico(roteiro: FakeRunResult[]): ProjectIdentityService {
  return new ProjectIdentityService(fakeRunner(roteiro));
}

test('sanitize substitui caracteres fora de [A-Za-z0-9._-] por hifen', () => {
  assert.equal(sanitizeProjectName('meu projeto@v1/beta'), 'meu-projeto-v1-beta');
});

test('sanitize devolve projeto-sem-nome para vazio, ponto e ponto-ponto', () => {
  assert.equal(sanitizeProjectName(''), 'projeto-sem-nome');
  assert.equal(sanitizeProjectName('.'), 'projeto-sem-nome');
  assert.equal(sanitizeProjectName('..'), 'projeto-sem-nome');
});

test('resolve usa o remoto git quando disponivel, removendo o sufixo .git', async () => {
  const identidade = await servico([
    res({ stdout: 'https://github.com/org/repo.git\n' }),
  ]).resolve('/qualquer/coisa');

  assert.deepEqual(identidade, { nome: 'repo', origem: 'git-remote', bruto: 'repo' });
});

test('resolve cai para o basename do cwd quando nao ha git, sem lancar', async () => {
  const identidade = await servico([
    res({ spawnFailed: true, exitCode: -1 }),
    res({ spawnFailed: true, exitCode: -1 }),
  ]).resolve('/tmp/experimento');

  assert.deepEqual(identidade, { nome: 'experimento', origem: 'cwd', bruto: 'experimento' });
});

test('logsDirFor compoe o caminho para uma identidade valida', () => {
  const dir = servico([]).logsDirFor(
    { nome: 'repo', origem: 'git-remote', bruto: 'repo' },
    '/tmp/base'
  );
  assert.equal(dir, path.join('/tmp/base', 'repo'));
});

test('sanitize trunca em 64 caracteres', () => {
  assert.equal(sanitizeProjectName('x'.repeat(200)).length, 64);
});

test('sanitize neutraliza tentativa de path traversal', () => {
  const resultado = sanitizeProjectName('../../etc');
  assert.ok(!resultado.includes('/'));
  assert.ok(!resultado.includes('\\'));
  assert.equal(resultado, '..-..-etc');
});

test('resolve trata a forma SSH do remoto', async () => {
  const identidade = await servico([
    res({ stdout: 'git@github.com:org/repo.git\n' }),
  ]).resolve('/qualquer');
  assert.equal(identidade.nome, 'repo');
  assert.equal(identidade.origem, 'git-remote');
});

test('resolve cai para o toplevel quando nao ha remoto', async () => {
  const identidade = await servico([
    res({ exitCode: 1 }),
    res({ stdout: '/home/user/my-project\n' }),
  ]).resolve('/qualquer');
  assert.deepEqual(identidade, {
    nome: 'my-project',
    origem: 'git-toplevel',
    bruto: 'my-project',
  });
});

test('resolve e deterministico para o mesmo cwd', async () => {
  const svc = servico([res({ spawnFailed: true }), res({ spawnFailed: true })]);
  const a = await svc.resolve('/tmp/foo');
  const b = await svc.resolve('/tmp/foo');
  assert.deepEqual(a, b);
});

test('logsDirFor rejeita caminho que escapa do diretorio base', () => {
  assert.throws(() =>
    servico([]).logsDirFor(
      { nome: '../evil', origem: 'cwd', bruto: 'x' },
      '/tmp/base'
    )
  );
});
