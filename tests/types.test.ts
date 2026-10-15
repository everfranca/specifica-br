import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUT_NAMES,
  TOOL_SLUGS,
  DEFAULT_LAYOUT,
  CONFIG_SCHEMA_VERSION,
} from '../dist/types/config.js';
import type {
  ContextInjection,
  ExecutorAgentConfig,
  ExecutorConfig,
  ExecutorPermissionRule,
  RunEventRunStart,
} from '../dist/types/executar-tasks.js';
import { OPENCODE_CONFIG_SCHEMA } from '../dist/types/executar-tasks.js';
import type { McpCheckResult } from '../dist/types/tool-adapter.js';

/**
 * Exaustividade de `ContextInjection` (CT-030): o `never` da clausula final faz
 * a compilacao falhar no dia em que a uniao ganhar um terceiro valor sem que
 * este tratamento o cubra.
 */
function descreverInjecao(forma: ContextInjection): string {
  switch (forma) {
    case 'prompt':
      return 'posicional';
    case 'instructions':
      return 'arquivo de apoio';
    default: {
      const _exaustivo: never = forma;
      return _exaustivo;
    }
  }
}

test('LAYOUT_NAMES cobre exatamente os quatro layouts de RF-015', () => {
  assert.deepStrictEqual(LAYOUT_NAMES, ['coluna', 'moldura', 'regua', 'lote']);
});

test('TOOL_SLUGS cobre exatamente as cinco ferramentas de RF-011', () => {
  assert.deepStrictEqual(TOOL_SLUGS, ['claudecode', 'cursor', 'gemini-cli', 'kiro', 'opencode']);
});

test('DEFAULT_LAYOUT e coluna, conforme RF-016', () => {
  assert.strictEqual(DEFAULT_LAYOUT, 'coluna');
});

test('CONFIG_SCHEMA_VERSION e 1, conforme CT-010', () => {
  assert.strictEqual(CONFIG_SCHEMA_VERSION, 1);
});

test('ContextInjection cobre exatamente prompt e instructions', () => {
  assert.strictEqual(descreverInjecao('prompt'), 'posicional');
  assert.strictEqual(descreverInjecao('instructions'), 'arquivo de apoio');
});

test('McpCheckResult aceita o campo opcional estado (CT-055)', () => {
  const semEstado: McpCheckResult = { nome: 'mcp', severidade: 'OK', linha: null };
  const comEstado: McpCheckResult = { nome: 'mcp', severidade: 'AVISO', linha: 'x', estado: 'falhou' };

  assert.strictEqual('estado' in semEstado, false);
  assert.strictEqual(comEstado.estado, 'falhou');
});

test('ExecutorPermissionRule so admite effect allow (CT-035)', () => {
  const regra: ExecutorPermissionRule = { action: '*', resource: '*', effect: 'allow' };
  const efeito: 'allow' = regra.effect;

  assert.strictEqual(efeito, 'allow');
});

test('ExecutorConfig usa agents plural com permissions array (CT-035)', () => {
  const agente: ExecutorAgentConfig = {
    description: 'Executor de tasks do specifica-br (uso nao-interativo)',
    mode: 'primary',
    permissions: [{ action: '*', resource: '*', effect: 'allow' }],
  };
  const config: ExecutorConfig = {
    $schema: OPENCODE_CONFIG_SCHEMA,
    agents: { 'specifica-executor': agente },
  };

  assert.strictEqual(config.agents['specifica-executor'].permissions[0].effect, 'allow');
  assert.strictEqual('instructions' in config, false);
});

test('RunEventRunStart aceita modo_de_execucao opcional (CT-054)', () => {
  const semModo: RunEventRunStart = {
    event: 'run_start',
    ts: 'x',
    feature: 'f',
    tool: 'claudecode',
    cli_version: 'v',
    model: 'm',
    effort: 'medium',
    fallback_model: '',
    total_tasks: 1,
    total_tasks_feature: 1,
    task_selection: 'todas',
    tasks_selecionadas: [1],
    window_budget_tokens: 0,
    max_budget_usd: 0,
    auto_approve: false,
    permission_mode: '',
    extra_dirs: [],
    cache_tuning: false,
    context_pack: false,
    pack_model: 'm',
    pack_effort: 'medium',
    pack_max_tokens: 8000,
    dry_run: false,
    layout: 'coluna',
    capacidades_ausentes: [],
    context_injection: 'n/a',
    cli_version_abaixo_do_piso: false,
    max_wait_segundos: 0,
    wait_on_limit: false,
    cabecalho: 'painel',
  };
  const comModo: RunEventRunStart = { ...semModo, modo_de_execucao: 'processo_privado' };

  assert.strictEqual('modo_de_execucao' in semModo, false);
  assert.strictEqual(comModo.modo_de_execucao, 'processo_privado');
});
