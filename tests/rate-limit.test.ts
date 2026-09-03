import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectRateLimit } from '../dist/utils/tool-adapters/rate-limit.js';

test('detecta as quatro formas de limite de uso', () => {
  assert.equal(detectRateLimit('Claude AI usage limit reached'), true);
  assert.equal(detectRateLimit('429 rate limit exceeded'), true);
  assert.equal(detectRateLimit('you have hit your weekly limit'), true);
  assert.equal(detectRateLimit('session limit reached for this account'), true);
});

test('a deteccao e insensivel a caixa', () => {
  assert.equal(detectRateLimit('USAGE LIMIT REACHED'), true);
  assert.equal(detectRateLimit('Rate-Limit'), true);
  assert.equal(detectRateLimit('Weekly Limit'), true);
});

test('rate limit e reconhecido com e sem separador', () => {
  assert.equal(detectRateLimit('ratelimit'), true);
  assert.equal(detectRateLimit('rate limit'), true);
  assert.equal(detectRateLimit('rate-limit'), true);
});

test('texto sem mencao a limite nao dispara a deteccao', () => {
  assert.equal(detectRateLimit(''), false);
  assert.equal(detectRateLimit('tudo certo, task concluida'), false);
  assert.equal(detectRateLimit('limit'), false);
  assert.equal(detectRateLimit('daily limit'), false);
  assert.equal(detectRateLimit('rate  limit'), false);
});

test('o adapter do ClaudeCode delega a mesma deteccao', async () => {
  const { ClaudeCodeAdapter } = await import(
    '../dist/utils/tool-adapters/claude-code-adapter.js'
  );
  const adapter = new ClaudeCodeAdapter();
  assert.equal(adapter.detectRateLimit('usage limit reached'), true);
  assert.equal(adapter.detectRateLimit('sem problema algum'), false);
});
