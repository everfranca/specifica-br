import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  getAdapter,
  getCapabilities,
  getExecutavel,
  getToolDisplayName,
  isContratoValidado,
  normalizeToolSlug,
} from '../dist/utils/tool-adapters/tool-registry.js';
import { TOOL_SLUGS } from '../dist/types/config.js';
import { OpenCodeExecutorConfigService } from '../dist/utils/opencode-executor-config.js';

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

test('claudecode e opencode tem contratoValidado true', () => {
  assert.equal(isContratoValidado('claudecode'), true);
  assert.equal(isContratoValidado('opencode'), true);
  for (const slug of ['cursor', 'gemini-cli', 'kiro'] as const) {
    assert.equal(isContratoValidado(slug), false);
  }
});

test('getAdapter das outras tres lanca a mensagem nominal com as duas habilitadas', () => {
  const esperado: Record<string, string> = {
    cursor: 'Cursor',
    'gemini-cli': 'Gemini CLI',
    kiro: 'Kiro',
  };

  for (const [slug, nome] of Object.entries(esperado)) {
    assert.throws(() => getAdapter(slug as never), {
      message: `contrato de execucao de ${nome} ainda nao validado nesta versao. Disponiveis: ClaudeCode, OpenCode`,
    });
  }
});

test('getAdapter de opencode devolve o adapter do OpenCode', () => {
  const adapter = getAdapter('opencode');
  assert.equal(adapter.slug, 'opencode');
  assert.equal(adapter.contratoValidado, true);
  assert.equal(typeof adapter.buildTaskArgs, 'function');
  assert.equal(getAdapter('opencode'), adapter);
});

test('as capacidades do registro conferem com as declaradas pelo adapter', () => {
  assert.deepEqual(getCapabilities('opencode'), getAdapter('opencode').capacidades);
  assert.deepEqual(getCapabilities('claudecode'), getAdapter('claudecode').capacidades);
});

test('opencode declara as treze capacidades de CT-038', () => {
  assert.deepEqual(getCapabilities('opencode'), {
    execucaoNaoInterativa: true,
    modoSemPromptDePermissao: true,
    saidaEstruturadaComTokens: true,
    identificadorDeSessao: true,
    injecaoDeContextoNoSystemPrompt: true,
    liberacaoDeDiretoriosDeLeitura: false,
    consultaAosMcps: true,
    relatoDeCustoEmUSD: true,
    tetoDeCustoNativo: false,
    modeloDeFallback: false,
    otimizacaoDeCacheDePrompt: false,
    relatoDeNegacoesDePermissao: false,
    formaDeInjecaoSelecionavel: true,
  });
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

test('claudecode declara as treze capacidades', () => {
  const capacidades = getCapabilities('claudecode');
  assert.deepEqual(capacidades, {
    execucaoNaoInterativa: true,
    modoSemPromptDePermissao: true,
    saidaEstruturadaComTokens: true,
    identificadorDeSessao: true,
    injecaoDeContextoNoSystemPrompt: true,
    liberacaoDeDiretoriosDeLeitura: true,
    consultaAosMcps: true,
    relatoDeCustoEmUSD: true,
    tetoDeCustoNativo: true,
    modeloDeFallback: true,
    otimizacaoDeCacheDePrompt: true,
    relatoDeNegacoesDePermissao: true,
    formaDeInjecaoSelecionavel: false,
  });

  const cursor = getCapabilities('cursor');
  assert.equal(
    Object.values(cursor).every((valor) => valor === false),
    true
  );
});

test('getAdapter injeta o configService no OpenCodeAdapter: buildEnv exporta o caminho gravado', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'specifica-reg-'));
  const servico = new OpenCodeExecutorConfigService(home);
  const { caminho } = await servico.ensure({
    runId: 'RUN',
    pid: 4242,
    formaDeInjecao: 'prompt',
    destiladoPath: null,
    allow: [],
  });

  const adapter = getAdapter('opencode', { configService: servico });

  assert.equal(adapter.buildEnv(false, { PATH: '/usr/bin' }).OPENCODE_CONFIG, caminho);

  await fs.remove(home);
});

test('getAdapter injeta o onAviso: o aviso nominal de RF-007 chega a quem chamou', () => {
  const avisos: string[] = [];
  const adapter = getAdapter('opencode', { onAviso: (m) => avisos.push(m) });

  assert.equal(
    adapter.modoDePermissaoEfetivo({ permissionMode: 'manual' } as never),
    'permissao total'
  );
  assert.deepEqual(avisos, [
    '--permission-mode manual nao tem equivalente no OpenCode - ignorado',
  ]);
});

test('a construcao com dependencias nunca e memorizada: um lote nao vaza para o seguinte', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'specifica-reg-'));
  const primeiro = new OpenCodeExecutorConfigService(home);
  await primeiro.ensure({
    runId: 'PRIMEIRO',
    pid: 1,
    formaDeInjecao: 'prompt',
    destiladoPath: null,
    allow: [],
  });
  const segundo = new OpenCodeExecutorConfigService(home);
  const gravado = await segundo.ensure({
    runId: 'SEGUNDO',
    pid: 2,
    formaDeInjecao: 'prompt',
    destiladoPath: null,
    allow: [],
  });

  const adapterA = getAdapter('opencode', { configService: primeiro });
  const adapterB = getAdapter('opencode', { configService: segundo });

  assert.notEqual(adapterA, adapterB);
  assert.equal(adapterB.buildEnv(false, {}).OPENCODE_CONFIG, gravado.caminho);
  // Sem dependencia o memo do modulo continua valendo e nao herda instancia alguma.
  assert.equal(getAdapter('opencode'), getAdapter('opencode'));
  assert.equal(getAdapter('opencode').buildEnv(false, {}).OPENCODE_CONFIG, undefined);

  await fs.remove(home);
});
