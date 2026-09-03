import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseJsonc } from '../dist/utils/jsonc.js';

test('JSON ja valido e devolvido sem alteracao', () => {
  const texto = '{\n  "model": "anthropic/claude-sonnet-4-5",\n  "autoupdate": true\n}';

  assert.deepStrictEqual(parseJsonc(texto), {
    model: 'anthropic/claude-sonnet-4-5',
    autoupdate: true,
  });
});

test('comentario de linha e removido', () => {
  const texto = '{\n  // o modelo padrao do projeto\n  "model": "anthropic/claude-sonnet-4-5"\n}';

  assert.deepStrictEqual(parseJsonc(texto), { model: 'anthropic/claude-sonnet-4-5' });
});

test('comentario de bloco e removido, inclusive em varias linhas', () => {
  const texto = '{\n  /* bloco\n     de duas linhas */\n  "server": { "port": 4096 }\n}';

  assert.deepStrictEqual(parseJsonc(texto), { server: { port: 4096 } });
});

test('virgula final antes de } e de ] e tolerada', () => {
  const texto = '{\n  "plugin": [\n    "a",\n    "b",\n  ],\n  "autoupdate": true,\n}';

  assert.deepStrictEqual(parseJsonc(texto), { plugin: ['a', 'b'], autoupdate: true });
});

test('// dentro de string de URL e preservado', () => {
  const texto = '{ "url": "https://mcp.context7.com/mcp" }';

  assert.deepStrictEqual(parseJsonc(texto), { url: 'https://mcp.context7.com/mcp' });
});

test('/* dentro de string e preservado', () => {
  const texto = '{ "glob": "src/**/*.ts", "outro": "/* nao e comentario */" }';

  assert.deepStrictEqual(parseJsonc(texto), { glob: 'src/**/*.ts', outro: '/* nao e comentario */' });
});

test('aspas escapadas nao encerram a string', () => {
  const texto = '{ "citacao": "ele disse \\"// isto nao e comentario\\"" }';

  assert.deepStrictEqual(parseJsonc(texto), { citacao: 'ele disse "// isto nao e comentario"' });
});

test('virgula seguida de } dentro de string nao e removida', () => {
  const texto = '{ "literal": "a,} b,] c" }';

  assert.deepStrictEqual(parseJsonc(texto), { literal: 'a,} b,] c' });
});

test('comentario de linha no fim do arquivo, sem quebra de linha final', () => {
  const texto = '{ "a": 1 }\n// comentario sem newline no fim';

  assert.deepStrictEqual(parseJsonc(texto), { a: 1 });
});

test('comentario de bloco nao fechado nao trava a varredura', () => {
  const texto = '{ "a": 1 }\n/* bloco sem fechamento';

  assert.deepStrictEqual(parseJsonc(texto), { a: 1 });
});

test('texto realmente invalido propaga a excecao do JSON.parse', () => {
  assert.throws(() => parseJsonc('{ "a": }'), SyntaxError);
});

test('texto vazio propaga a excecao do JSON.parse, sem lancar por conta propria', () => {
  assert.throws(() => parseJsonc(''), SyntaxError);
});
