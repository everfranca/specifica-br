import { test } from 'node:test';
import assert from 'node:assert/strict';

import { executarTasksCommand } from '../dist/commands/executar-tasks.js';
import { validateOptions } from '../dist/utils/executar-tasks-validation.js';

const OPCOES_ESPERADAS = [
  '--allow',
  '--auto-approve',
  '--dry-run',
  '--effort',
  '--fallback-model',
  '--max-budget-usd',
  '--mcp-timeout',
  '--model',
  '--no-cache-tuning',
  '--no-context-pack',
  '--no-mcp-check',
  '--no-skill-dirs',
  '--pack-effort',
  '--pack-max-tokens',
  '--pack-model',
  '--permission-mode',
  '--preflight',
  '--require-cmd',
  '--skip-preflight',
  '--sleep',
  '--stop-on-failure',
  '--tasks',
  '--tool',
  '--window-budget-tokens',
].sort();

test('as 24 opcoes de RF-002 estao declaradas, nem mais nem menos', () => {
  const longs = executarTasksCommand.options.map((o) => o.long).sort();
  assert.equal(executarTasksCommand.options.length, 24);
  assert.deepEqual(longs, OPCOES_ESPERADAS);
});

test('nenhuma opcao positiva correspondente as negativas e exposta', () => {
  const longs = executarTasksCommand.options.map((o) => o.long);
  for (const positiva of ['--skill-dirs', '--cache-tuning', '--context-pack', '--mcp-check']) {
    assert.ok(!longs.includes(positiva), `${positiva} nao deveria existir`);
  }
});

test('opcao desconhecida e rejeitada', async () => {
  executarTasksCommand.exitOverride();
  await assert.rejects(async () => {
    await executarTasksCommand.parseAsync(['dir-qualquer', '--opcao-inexistente'], {
      from: 'user',
    });
  });
});

test('--effort fora dos cinco niveis e rejeitado', () => {
  assert.throws(() => validateOptions({ effort: 'turbo' }));
  assert.equal(validateOptions({ effort: 'xhigh' }).effort, 'xhigh');
});

test('--permission-mode fora dos modos aceitos e rejeitado', () => {
  assert.throws(() => validateOptions({ permissionMode: 'root' }));
  assert.equal(validateOptions({ permissionMode: 'acceptEdits' }).permissionMode, 'acceptEdits');
  assert.equal(validateOptions({}).permissionMode, '');
});

test('--tool fora das cinco ferramentas e rejeitado; aceito sem distincao de caixa', () => {
  assert.throws(() => validateOptions({ tool: 'vscode' }));
  assert.equal(validateOptions({ tool: 'ClaudeCode' }).tool, 'claudecode');
  assert.equal(validateOptions({ tool: 'GEMINI-CLI' }).tool, 'gemini-cli');
});

test('valores nao numericos nos cinco numericos sao rejeitados', () => {
  for (const chave of [
    'maxBudgetUsd',
    'windowBudgetTokens',
    'sleep',
    'packMaxTokens',
    'mcpTimeout',
  ]) {
    assert.throws(() => validateOptions({ [chave]: 'abc' }), /numerico/, chave);
  }
});

test('--mcp-timeout exige inteiro maior que zero', () => {
  assert.throws(() => validateOptions({ mcpTimeout: 0 }));
  assert.throws(() => validateOptions({ mcpTimeout: '0' }));
  assert.throws(() => validateOptions({ mcpTimeout: 1.5 }));
  assert.equal(validateOptions({ mcpTimeout: 20 }).mcpTimeout, 20);
});

test('--window-budget-tokens e --pack-max-tokens exigem inteiro >= 0', () => {
  assert.throws(() => validateOptions({ windowBudgetTokens: -1 }));
  assert.throws(() => validateOptions({ windowBudgetTokens: 2.5 }));
  assert.throws(() => validateOptions({ packMaxTokens: -3 }));
  assert.equal(validateOptions({ windowBudgetTokens: 0 }).windowBudgetTokens, 0);
});

test('as quatro opcoes negativas entregam true por padrao e false quando informadas', () => {
  const padrao = validateOptions({});
  assert.equal(padrao.skillDirs, true);
  assert.equal(padrao.cacheTuning, true);
  assert.equal(padrao.contextPack, true);
  assert.equal(padrao.mcpCheck, true);

  const informadas = validateOptions({
    skillDirs: false,
    cacheTuning: false,
    contextPack: false,
    mcpCheck: false,
  });
  assert.equal(informadas.skillDirs, false);
  assert.equal(informadas.cacheTuning, false);
  assert.equal(informadas.contextPack, false);
  assert.equal(informadas.mcpCheck, false);
});

test('os defaults da tabela da secao 4.1 sao aplicados', () => {
  const v = validateOptions({});
  assert.equal(v.model, 'sonnet');
  assert.equal(v.effort, 'medium');
  assert.equal(v.fallbackModel, '');
  assert.equal(v.packModel, 'sonnet');
  assert.equal(v.packEffort, 'low');
  assert.equal(v.packMaxTokens, 8000);
  assert.equal(v.mcpTimeout, 15);
  assert.equal(v.maxBudgetUsd, 0);
  assert.equal(v.sleep, 0);
  assert.deepEqual(v.allow, []);
  assert.deepEqual(v.requireCmd, []);
});
