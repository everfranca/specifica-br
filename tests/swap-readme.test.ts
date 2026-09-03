import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_ORIGEM = path.join(RAIZ_PROJETO, 'scripts', 'swap-readme.js');

const CONTEUDO_GITHUB = '# README do GitHub\n';
const CONTEUDO_NPM = '# README do npm\n';

interface PacoteFalso {
  raiz: string;
  script: string;
  readme: string;
  readmeNpm: string;
  backup: string;
}

function criarPacoteFalso(): PacoteFalso {
  const raiz = mkdtempSync(path.join(tmpdir(), 'swap-readme-'));

  mkdirSync(path.join(raiz, 'scripts'));
  mkdirSync(path.join(raiz, 'docs'));

  const pacote: PacoteFalso = {
    raiz,
    script: path.join(raiz, 'scripts', 'swap-readme.js'),
    readme: path.join(raiz, 'README.md'),
    readmeNpm: path.join(raiz, 'docs', 'README.npm.md'),
    backup: path.join(raiz, '.readme-github.bak.md'),
  };

  copyFileSync(SCRIPT_ORIGEM, pacote.script);
  writeFileSync(path.join(raiz, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(pacote.readme, CONTEUDO_GITHUB);
  writeFileSync(pacote.readmeNpm, CONTEUDO_NPM);

  return pacote;
}

function executarSwap(pacote: PacoteFalso, modo: string): { codigo: number; saida: string } {
  const resultado = spawnSync(process.execPath, [pacote.script, modo], { encoding: 'utf8' });

  return {
    codigo: resultado.status ?? 1,
    saida: `${resultado.stdout}${resultado.stderr}`,
  };
}

test('--npm aplica o README do npm e guarda o do GitHub no backup', () => {
  const pacote = criarPacoteFalso();

  try {
    const resultado = executarSwap(pacote, '--npm');

    assert.equal(resultado.codigo, 0);
    assert.equal(readFileSync(pacote.readme, 'utf8'), CONTEUDO_NPM);
    assert.equal(readFileSync(pacote.backup, 'utf8'), CONTEUDO_GITHUB);
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});

test('--restore devolve o README do GitHub e remove o backup', () => {
  const pacote = criarPacoteFalso();

  try {
    executarSwap(pacote, '--npm');
    const resultado = executarSwap(pacote, '--restore');

    assert.equal(resultado.codigo, 0);
    assert.equal(readFileSync(pacote.readme, 'utf8'), CONTEUDO_GITHUB);
    assert.equal(existsSync(pacote.backup), false);
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});

test('--npm é recusado quando já existe backup de um ciclo anterior', () => {
  const pacote = criarPacoteFalso();

  try {
    writeFileSync(pacote.backup, '# backup de ciclo travado\n');
    const resultado = executarSwap(pacote, '--npm');

    assert.equal(resultado.codigo, 1);
    assert.match(resultado.saida, /já existe/);
    assert.match(resultado.saida, /--restore/);
    assert.equal(readFileSync(pacote.readme, 'utf8'), CONTEUDO_GITHUB);
    assert.equal(readFileSync(pacote.backup, 'utf8'), '# backup de ciclo travado\n');
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});

test('--restore é recusado quando não há backup', () => {
  const pacote = criarPacoteFalso();

  try {
    const resultado = executarSwap(pacote, '--restore');

    assert.equal(resultado.codigo, 1);
    assert.match(resultado.saida, /não encontrado/);
    assert.equal(readFileSync(pacote.readme, 'utf8'), CONTEUDO_GITHUB);
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});

test('--npm é recusado quando falta a versão npm do README, sem criar backup', () => {
  const pacote = criarPacoteFalso();

  try {
    rmSync(pacote.readmeNpm);
    const resultado = executarSwap(pacote, '--npm');

    assert.equal(resultado.codigo, 1);
    assert.match(resultado.saida, /README\.npm\.md/);
    assert.equal(existsSync(pacote.backup), false);
    assert.equal(readFileSync(pacote.readme, 'utf8'), CONTEUDO_GITHUB);
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});

test('sem modo informado o script falha com instrução de uso', () => {
  const pacote = criarPacoteFalso();

  try {
    const resultado = executarSwap(pacote, '');

    assert.equal(resultado.codigo, 1);
    assert.match(resultado.saida, /Informe um modo/);
  } finally {
    rmSync(pacote.raiz, { recursive: true, force: true });
  }
});
