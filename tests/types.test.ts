import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUT_NAMES,
  TOOL_SLUGS,
  DEFAULT_LAYOUT,
  CONFIG_SCHEMA_VERSION,
} from '../dist/types/config.js';

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
