import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatarDuracao, formatarMilhar } from '../dist/utils/formatos.js';

test('formatarDuracao reproduz a tabela de conversao de RF-004', () => {
  const casos: Array<[number, string]> = [
    [0, '0s'],
    [9.4, '9s'],
    [59.9, '59s'],
    [60, '1m 00s'],
    [72, '1m 12s'],
    [3599, '59m 59s'],
    [3600, '1h 00m'],
    [3870, '1h 04m'],
  ];
  for (const [entrada, esperado] of casos) {
    assert.strictEqual(formatarDuracao(entrada), esperado, `formatarDuracao(${entrada})`);
  }
});

test('formatarMilhar separa o milhar no padrao pt-BR', () => {
  const casos: Array<[number, string]> = [
    [0, '0'],
    [999, '999'],
    [1000, '1.000'],
    [82000, '82.000'],
    [3482190, '3.482.190'],
  ];
  for (const [entrada, esperado] of casos) {
    assert.strictEqual(formatarMilhar(entrada), esperado, `formatarMilhar(${entrada})`);
  }
});

/**
 * A assinatura publica e `number`, mas o contrato de RF-004 fala de valor
 * "indefinido": a conversao explicita abaixo existe para exercitar, em tempo de
 * execucao, a robustez que o modulo promete a chamadores JavaScript.
 */
const formatarDuracaoIrrestrita = formatarDuracao as unknown as (valor: unknown) => string;
const formatarMilharIrrestrito = formatarMilhar as unknown as (valor: unknown) => string;

test('formatarDuracao devolve 0s para entrada invalida, sem lancar', () => {
  const invalidos: unknown[] = [-1, -0.5, -3600, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined];
  for (const entrada of invalidos) {
    assert.strictEqual(formatarDuracaoIrrestrita(entrada), '0s', `formatarDuracao(${String(entrada)})`);
  }
});

test('formatarMilhar devolve 0 para entrada nao finita, sem lancar', () => {
  const invalidos: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined];
  for (const entrada of invalidos) {
    assert.strictEqual(formatarMilharIrrestrito(entrada), '0', `formatarMilhar(${String(entrada)})`);
  }
});

test('formatarMilhar preserva o sinal negativo', () => {
  assert.strictEqual(formatarMilhar(-82000), '-82.000');
});
