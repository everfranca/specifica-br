import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM_ASSETS = path.join(RAIZ_PROJETO, 'src', 'assets');
const DIST = path.join(RAIZ_PROJETO, 'dist');

const ARQUIVOS_ACHATADOS = ['settings.json', 'tokens.json', 'tools-mapping.json'];

test('copiar-assets produz o layout esperado em dist', () => {
  assert.ok(existsSync(path.join(DIST, 'boilerplate')), 'dist/boilerplate deveria existir');

  for (const arquivo of ARQUIVOS_ACHATADOS) {
    assert.ok(existsSync(path.join(DIST, arquivo)), `dist/${arquivo} deveria existir`);
  }

  assert.ok(existsSync(path.join(DIST, 'assets', 'tokens.json')), 'dist/assets/tokens.json deveria existir');
});

test('arquivos copiados em dist sao identicos a fonte em src/assets', () => {
  const paresDeArquivos = [
    ['tokens.json', path.join(DIST, 'tokens.json')],
    ['tokens.json', path.join(DIST, 'assets', 'tokens.json')],
    [path.join('boilerplate', 'commands', 'gerar-prd.md'), path.join(DIST, 'boilerplate', 'commands', 'gerar-prd.md')]
  ];

  for (const [origemRelativa, destino] of paresDeArquivos) {
    const origem = readFileSync(path.join(ORIGEM_ASSETS, origemRelativa));
    const copia = readFileSync(destino);

    assert.ok(origem.equals(copia), `${destino} deveria ser identico a src/assets/${origemRelativa}`);
  }
});
