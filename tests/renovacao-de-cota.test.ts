import { test } from 'node:test';
import assert from 'node:assert/strict';

import { determinarRenovacao } from '../dist/utils/renovacao-de-cota.js';

/** Instante de referencia fixo: 04/09/2026 14:00 local. */
const AGORA = new Date(2026, 8, 4, 14, 0, 0, 0).getTime();

test('forma 1: instante absoluto em ISO 8601 e devolvido como informado', () => {
  const daqui2h = new Date(AGORA + 2 * 60 * 60 * 1000);
  const texto = `Claude usage limit reached. Your limit will reset at ${daqui2h.toISOString()}`;

  const renovacao = determinarRenovacao(texto, AGORA);

  assert.notStrictEqual(renovacao, null);
  assert.strictEqual(renovacao?.toISOString(), daqui2h.toISOString());
});

test('forma 1: epoch em segundos associado a reset e devolvido como informado', () => {
  const daqui3h = Math.floor((AGORA + 3 * 60 * 60 * 1000) / 1000);
  const texto = `usage limit reached, resets at ${daqui3h}`;

  const renovacao = determinarRenovacao(texto, AGORA);

  assert.strictEqual(renovacao?.getTime(), daqui3h * 1000);
});

test('forma 2: horario do dia na linha do limite resolve para a proxima ocorrencia futura', () => {
  const texto = 'Claude usage limit reached. Try again at 15:30';

  const renovacao = determinarRenovacao(texto, AGORA);

  assert.strictEqual(renovacao?.getTime(), new Date(2026, 8, 4, 15, 30, 0, 0).getTime());
});

test('forma 2: horario ja passado hoje resolve para amanha', () => {
  // As 23:00, um alvo de 10:00 ja passou ha 13 horas: a proxima ocorrencia e
  // amanha as 10:00, a 11 horas de distancia, dentro do teto de 12 h (RNF-007).
  const asVinteETres = new Date(2026, 8, 4, 23, 0, 0, 0).getTime();
  const texto = 'weekly limit reached. new quota at 10:00';

  const renovacao = determinarRenovacao(texto, asVinteETres);

  assert.strictEqual(renovacao?.getTime(), new Date(2026, 8, 5, 10, 0, 0, 0).getTime());
});

test('forma 3: quantidade restante em minutos resulta em agora mais a duracao', () => {
  const renovacao = determinarRenovacao('rate limit exceeded, try again in 45 minutes', AGORA);

  assert.strictEqual(renovacao?.getTime(), AGORA + 45 * 60 * 1000);
});

test('forma 3: quantidade restante em horas com until resulta em agora mais a duracao', () => {
  const renovacao = determinarRenovacao('usage limit: 2 hours until reset', AGORA);

  assert.strictEqual(renovacao?.getTime(), AGORA + 2 * 60 * 60 * 1000);
});

test('a ordem da tabela vale: o instante absoluto vence o horario do dia na mesma linha', () => {
  const daqui1h = new Date(AGORA + 60 * 60 * 1000);
  const texto = `usage limit reached, reset at ${daqui1h.toISOString()} ou as 23:45`;

  const renovacao = determinarRenovacao(texto, AGORA);

  assert.strictEqual(renovacao?.toISOString(), daqui1h.toISOString());
});

test('instante no passado e tratado como desconhecido', () => {
  const passado = new Date(AGORA - 60 * 1000).toISOString();

  assert.strictEqual(determinarRenovacao(`usage limit, reset at ${passado}`, AGORA), null);
});

test('instante a 30 horas a frente e tratado como desconhecido (teto de 12 h)', () => {
  const daqui30h = new Date(AGORA + 30 * 60 * 60 * 1000).toISOString();

  assert.strictEqual(determinarRenovacao(`usage limit, reset at ${daqui30h}`, AGORA), null);
});

test('texto sem nenhuma das tres formas e desconhecido', () => {
  assert.strictEqual(determinarRenovacao('usage limit reached, sorry', AGORA), null);
  assert.strictEqual(determinarRenovacao('', AGORA), null);
});

test('horario do dia fora da linha do limite nao e reconhecido', () => {
  const texto = 'usage limit reached\nbuild concluido as 15:30';

  assert.strictEqual(determinarRenovacao(texto, AGORA), null);
});

test('epoch sem termo de associacao na mesma linha nao e reconhecido', () => {
  const daqui2h = Math.floor((AGORA + 2 * 60 * 60 * 1000) / 1000);

  assert.strictEqual(determinarRenovacao(`usage limit ${daqui2h}`, AGORA), null);
});

test('sequencias ANSI ao redor do horario nao atrapalham o reconhecimento', () => {
  const verde = '\u001B[32m';
  const reset = '\u001B[0m';
  const texto = `${verde}Claude usage limit reached${reset}. Try again at ${verde}15:30${reset}`;

  const renovacao = determinarRenovacao(texto, AGORA);

  assert.strictEqual(renovacao?.getTime(), new Date(2026, 8, 4, 15, 30, 0, 0).getTime());
});
