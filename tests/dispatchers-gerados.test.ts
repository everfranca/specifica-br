import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ_PROJETO, 'scripts', 'gerar-dispatchers.mjs');
const DIRETORIO_COMMANDS = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'commands');
const DIRETORIO_SKILLS = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'skills');
const DIRETORIO_TEMPLATES = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'templates');

function executarScript(...args: string[]): { codigo: number; saida: string } {
  const resultado = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  return {
    codigo: resultado.status ?? 1,
    saida: `${resultado.stdout}${resultado.stderr}`
  };
}

function copiaDoBoilerplate(): string {
  const raiz = mkdtempSync(path.join(tmpdir(), 'gerar-dispatchers-'));
  cpSync(path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate'), path.join(raiz, 'src', 'assets', 'boilerplate'), { recursive: true });
  return raiz;
}

test('dispatchers e templates commitados conferem com a fonte unica (--check)', () => {
  const resultado = executarScript('--check');

  assert.equal(resultado.codigo, 0, `divergencias detectadas: ${resultado.saida}`);
});

test('execucao do gerador e idempotente', () => {
  const primeira = executarScript();
  const verificacao = executarScript('--check');

  assert.equal(primeira.codigo, 0, `saida: ${primeira.saida}`);
  assert.equal(verificacao.codigo, 0, `saida: ${verificacao.saida}`);
});

test('--check falha quando um dispatcher commitado diverge da skill', () => {
  const raiz = copiaDoBoilerplate();

  try {
    const alvo = path.join(raiz, 'src', 'assets', 'boilerplate', 'commands', 'gerar-prd.md');
    writeFileSync(alvo, `${readFileSync(alvo, 'utf-8')}\n<!-- adulterado -->\n`, 'utf-8');

    const resultado = executarScript('--raiz', raiz, '--check');

    assert.equal(resultado.codigo, 1, 'divergencia deveria falhar o --check');
    assert.ok(resultado.saida.includes('gerar-prd.md'), 'saida deveria apontar o arquivo divergente');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('--check falha quando um template carimbado diverge da fonte unica', () => {
  const raiz = copiaDoBoilerplate();

  try {
    const alvo = path.join(raiz, 'src', 'assets', 'boilerplate', 'skills', 'gerar-prd', 'assets', 'prd-template.md');
    writeFileSync(alvo, `${readFileSync(alvo, 'utf-8')}\n<!-- adulterado -->\n`, 'utf-8');

    const resultado = executarScript('--raiz', raiz, '--check');

    assert.equal(resultado.codigo, 1, 'divergencia deveria falhar o --check');
    assert.ok(resultado.saida.includes('prd-template.md'), 'saida deveria apontar o arquivo divergente');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('executar-task esta fora do alcance do gerador e nunca e regenerado', () => {
  const raiz = copiaDoBoilerplate();

  try {
    const alvo = path.join(raiz, 'src', 'assets', 'boilerplate', 'commands', 'executar-task.md');
    const original = readFileSync(alvo, 'utf-8');
    const adulterado = `${original}\n<!-- adulterado -->\n`;

    writeFileSync(alvo, adulterado, 'utf-8');

    const execucao = executarScript('--raiz', raiz);
    const verificacao = executarScript('--raiz', raiz, '--check');

    assert.equal(execucao.codigo, 0, `saida: ${execucao.saida}`);
    assert.equal(verificacao.codigo, 0, 'executar-task adulterado nao deveria afetar o --check');
    assert.equal(readFileSync(alvo, 'utf-8'), adulterado, 'gerador sobrescreveu executar-task.md');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('carimbagem de build produz assets identicos aos templates canonicos em todas as skills', () => {
  const pares: Array<[string, string]> = [
    ['gerar-prd', 'prd-template.md'],
    ['realizar-codereview', 'codereview-template.md'],
    ['gerar-techspec', 'techspec-template.md'],
    ['gerar-tasks', 'task-template.md'],
    ['gerar-tasks', 'tasks-template.md'],
    ['gerar-visao', 'architecture-template.md'],
    ['gerar-visao', 'product_vision-template.md'],
    ['gerar-contexto', 'architecture-template.md'],
    ['gerar-contexto', 'product_vision-template.md']
  ];

  for (const [skill, template] of pares) {
    const asset = readFileSync(path.join(DIRETORIO_SKILLS, skill, 'assets', template));
    const canonico = readFileSync(path.join(DIRETORIO_TEMPLATES, template));

    assert.ok(
      asset.equals(canonico),
      `assets/${template} da skill ${skill} difere do template canonico`
    );
  }
});
