import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getAdapter,
  getCapabilities,
  getExecutavel,
  getToolDisplayName,
  isContratoValidado,
  normalizeToolSlug,
} from '../dist/utils/tool-adapters/tool-registry.js';
import { TOOL_SLUGS } from '../dist/types/config.js';

test('as cinco ferramentas estao registradas', () => {
  assert.deepEqual(
    [...TOOL_SLUGS],
    ['claudecode', 'cursor', 'gemini-cli', 'kiro', 'opencode']
  );

  assert.equal(getToolDisplayName('claudecode'), 'ClaudeCode');
  assert.equal(getToolDisplayName('cursor'), 'Cursor');
  assert.equal(getToolDisplayName('gemini-cli'), 'Gemini CLI');
  assert.equal(getToolDisplayName('kiro'), 'Kiro');
  assert.equal(getToolDisplayName('opencode'), 'OpenCode');
});

test('getExecutavel devolve o executavel de cada slug do registro', () => {
  assert.equal(getExecutavel('claudecode'), 'claude');
  assert.equal(getExecutavel('cursor'), 'cursor');
  assert.equal(getExecutavel('gemini-cli'), 'gemini');
  assert.equal(getExecutavel('kiro'), 'kiro');
  assert.equal(getExecutavel('opencode'), 'opencode');
});

test('apenas claudecode tem contratoValidado true', () => {
  assert.equal(isContratoValidado('claudecode'), true);
  for (const slug of ['cursor', 'gemini-cli', 'kiro', 'opencode'] as const) {
    assert.equal(isContratoValidado(slug), false);
  }
});

test('getAdapter das outras quatro lanca a mensagem nominal', () => {
  const esperado: Record<string, string> = {
    cursor: 'Cursor',
    'gemini-cli': 'Gemini CLI',
    kiro: 'Kiro',
    opencode: 'OpenCode',
  };

  for (const [slug, nome] of Object.entries(esperado)) {
    assert.throws(() => getAdapter(slug as never), {
      message: `contrato de execucao de ${nome} ainda nao validado nesta versao. Disponivel: ClaudeCode`,
    });
  }
});

test('getAdapter de claudecode devolve um adapter', () => {
  const adapter = getAdapter('claudecode');
  assert.equal(adapter.slug, 'claudecode');
  assert.equal(adapter.contratoValidado, true);
  assert.equal(typeof adapter.buildTaskArgs, 'function');
});

test('normalizeToolSlug aceita sem distincao de caixa', () => {
  assert.equal(normalizeToolSlug('ClaudeCode'), 'claudecode');
  assert.equal(normalizeToolSlug('CLAUDECODE'), 'claudecode');
  assert.equal(normalizeToolSlug('claudecode'), 'claudecode');
  assert.equal(normalizeToolSlug('  Gemini-CLI  '), 'gemini-cli');
});

test('normalizeToolSlug devolve null para valor fora das cinco', () => {
  assert.equal(normalizeToolSlug('vscode'), null);
  assert.equal(normalizeToolSlug(''), null);
  assert.equal(normalizeToolSlug('claude code'), null);
});

test('claudecode declara as sete capacidades', () => {
  const capacidades = getCapabilities('claudecode');
  assert.deepEqual(capacidades, {
    execucaoNaoInterativa: true,
    modoSemPromptDePermissao: true,
    saidaEstruturadaComTokens: true,
    identificadorDeSessao: true,
    injecaoDeContextoNoSystemPrompt: true,
    liberacaoDeDiretoriosDeLeitura: true,
    consultaAosMcps: true,
  });

  const cursor = getCapabilities('cursor');
  assert.equal(
    Object.values(cursor).every((valor) => valor === false),
    true
  );
});
