import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AccountingService } from '../dist/utils/accounting.js';
import type { TaskResult } from '../dist/types/tool-adapter.js';

function resultado(parcial: Partial<TaskResult>): TaskResult {
  return {
    sessionId: 's',
    subtype: 'success',
    isError: false,
    exitCode: 0,
    numTurns: 1,
    durationMs: 0,
    durationApiMs: 0,
    costUsd: 0,
    model: 'sonnet',
    modelosReportados: 'claude-sonnet-4-5',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    reasoningTokens: null,
    permissionDenials: 0,
    ferramentasNegadas: null,
    contabilidadeParcial: false,
    rawStdout: '',
    rawStderr: '',
    ...parcial,
  };
}

test('accumulate soma os quatro contadores e devolve tokensDaTask', () => {
  const s = new AccountingService();
  const { tokensDaTask, custoDaTask } = s.accumulate(
    resultado({
      inputTokens: 1200,
      outputTokens: 8400,
      cacheCreationInputTokens: 45000,
      cacheReadInputTokens: 980000,
      costUsd: 1.2345,
    })
  );

  assert.strictEqual(tokensDaTask, 1034600);
  assert.strictEqual(custoDaTask, 1.2345);
  assert.strictEqual(s.total.tokensGastosAcumulado, 1034600);
});

test('o acumulado da execucao soma varias tasks', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 100, costUsd: 0.5 }));
  s.accumulate(resultado({ outputTokens: 200, costUsd: 0.25 }));

  assert.strictEqual(s.total.tokensGastosAcumulado, 300);
  assert.strictEqual(s.total.inputTokens, 100);
  assert.strictEqual(s.total.outputTokens, 200);
  assert.strictEqual(s.total.custoAcumuladoUsd, 0.75);
});

test('formatCustoExibicao usa 4 casas e formatCustoRegistro usa 6', () => {
  const s = new AccountingService();
  assert.strictEqual(s.formatCustoExibicao(1.23456789), '1.2346');
  assert.strictEqual(s.formatCustoRegistro(1.23456789), '1.234568');
});

test('formatMilhar usa a separacao pt-BR', () => {
  const s = new AccountingService();
  assert.strictEqual(s.formatMilhar(1034600), '1.034.600');
});

test('excederiaJanela devolve false quando o teto e 0', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 999999 }));
  assert.strictEqual(s.excederiaJanela(0), false);
});

test('excederiaJanela devolve true quando o acumulado alcanca ou passa o teto', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 98000 }));
  assert.strictEqual(s.excederiaJanela(100000), false);
  s.accumulate(resultado({ inputTokens: 2000 }));
  assert.strictEqual(s.excederiaJanela(100000), true);
});

test('accumulate soma os tokens de raciocinio ao total da task', () => {
  const s = new AccountingService();
  const { tokensDaTask } = s.accumulate(
    resultado({
      inputTokens: 13176,
      outputTokens: 8,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 1280,
      reasoningTokens: 69,
    })
  );

  assert.strictEqual(tokensDaTask, 14533);
  assert.strictEqual(s.total.reasoningTokens, 69);
  assert.strictEqual(s.total.tokensGastosAcumulado, 14533);
  assert.strictEqual(s.raciocinioReportado, true);
});

test('custoZeroNaoReportado e falso quando a ferramenta reportou custo', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 1000, costUsd: 0.5 }));
  assert.strictEqual(s.custoZeroNaoReportado, false);
});

test('com reasoningTokens nulo o total e identico ao anterior a esta feature', () => {
  const s = new AccountingService();
  const { tokensDaTask } = s.accumulate(
    resultado({
      inputTokens: 1200,
      outputTokens: 8400,
      cacheCreationInputTokens: 45000,
      cacheReadInputTokens: 980000,
      reasoningTokens: null,
    })
  );

  assert.strictEqual(tokensDaTask, 1034600);
  assert.strictEqual(s.total.reasoningTokens, 0);
  assert.strictEqual(s.total.tokensGastosAcumulado, 1034600);
  assert.strictEqual(s.raciocinioReportado, false);
});

test('raciocinio reportado em uma unica task do lote ja marca o acumulado como reportado', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 100, reasoningTokens: null }));
  s.accumulate(resultado({ inputTokens: 100, reasoningTokens: 40 }));

  assert.strictEqual(s.total.reasoningTokens, 40);
  assert.strictEqual(s.total.tokensGastosAcumulado, 240);
  assert.strictEqual(s.raciocinioReportado, true);
});

test('custoZeroNaoReportado e verdadeiro com tokens gastos e custo zero', () => {
  const s = new AccountingService();
  s.accumulate(resultado({ inputTokens: 1000, costUsd: 0 }));
  assert.strictEqual(s.custoZeroNaoReportado, true);
});

test('custoZeroNaoReportado e falso antes de qualquer task', () => {
  const s = new AccountingService();
  assert.strictEqual(s.custoZeroNaoReportado, false);
});
