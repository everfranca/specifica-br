import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVEL,
  GLYPH,
  detectLevel,
  createPainter,
  detectGlyphLevel,
  visibleWidth,
  status,
  banner,
  box,
  rule,
  Spinner,
  QUADROS_SPINNER,
} from '../dist/utils/terminal/index.js';
import type { ColorLevel, GlyphLevel, StatusKind } from '../dist/utils/terminal/index.js';

/**
 * As funcoes de deteccao leem `process.env` e `process.stdout` diretamente,
 * como no arquivo `.js` de origem. Para manter os testes deterministicos e sem
 * vazamento entre casos, cada teste roda dentro de `comAmbiente`, que aplica um
 * conjunto de variaveis e o valor de `isTTY`, executa e restaura tudo.
 */
const VARS_RELEVANTES = [
  'NO_COLOR',
  'FORCE_COLOR',
  'SPECIFICA_GLYPHS',
  'TERM',
  'COLORTERM',
  'TERM_PROGRAM',
  'WT_SESSION',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'CI',
  'GITHUB_ACTIONS',
  'GITEA_ACTIONS',
  'NERD_FONT',
  'POWERLINE_FONT',
];

function comAmbiente(vars: Record<string, string | undefined>, isTTY: boolean | undefined, fn: () => void): void {
  const anterior: Record<string, string | undefined> = {};
  for (const chave of VARS_RELEVANTES) {
    anterior[chave] = process.env[chave];
    delete process.env[chave];
  }
  for (const [chave, valor] of Object.entries(vars)) {
    if (valor === undefined) {
      delete process.env[chave];
    } else {
      process.env[chave] = valor;
    }
  }
  const ttyAnterior = process.stdout.isTTY;
  (process.stdout as { isTTY?: boolean }).isTTY = isTTY;
  try {
    fn();
  } finally {
    (process.stdout as { isTTY?: boolean }).isTTY = ttyAnterior;
    for (const chave of VARS_RELEVANTES) {
      if (anterior[chave] === undefined) {
        delete process.env[chave];
      } else {
        process.env[chave] = anterior[chave];
      }
    }
  }
}

const KINDS: StatusKind[] = ['ok', 'aviso', 'erro', 'info'];

test('detectLevel devolve NONE quando NO_COLOR esta definida', () => {
  comAmbiente({ NO_COLOR: '1' }, true, () => {
    assert.strictEqual(detectLevel(), LEVEL.NONE);
  });
});

test('detectLevel respeita FORCE_COLOR nos quatro valores', () => {
  const casos: Array<[string, ColorLevel]> = [
    ['0', LEVEL.NONE],
    ['1', LEVEL.BASIC],
    ['2', LEVEL.ANSI256],
    ['3', LEVEL.TRUECOLOR],
  ];
  for (const [valor, esperado] of casos) {
    comAmbiente({ FORCE_COLOR: valor }, false, () => {
      assert.strictEqual(detectLevel(), esperado, `FORCE_COLOR=${valor}`);
    });
  }
});

test('createPainter em LEVEL.NONE devolve a string inalterada', () => {
  const p = createPainter(LEVEL.NONE);
  const metodos: Array<(s: string) => string> = [
    p.petroleo, p.paprica, p.ok, p.aviso, p.erro, p.info,
    p.primary, p.secondary, p.muted, p.dim, p.bold, p.reset,
  ];
  for (const metodo of metodos) {
    const saida = metodo('texto-x');
    assert.strictEqual(saida, 'texto-x');
    assert.ok(!saida.includes('\x1b'), 'nenhuma sequencia de escape');
  }
});

test('detectGlyphLevel respeita SPECIFICA_GLYPHS nos tres valores', () => {
  const casos: Array<[string, GlyphLevel]> = [
    ['ascii', GLYPH.ASCII],
    ['box', GLYPH.UNICODE_BOX],
    ['full', GLYPH.UNICODE_FULL],
  ];
  for (const [valor, esperado] of casos) {
    comAmbiente({ SPECIFICA_GLYPHS: valor }, true, () => {
      assert.strictEqual(detectGlyphLevel(), esperado, `SPECIFICA_GLYPHS=${valor}`);
    });
  }
});

test('os quatro rotulos de estado tem exatamente sete caracteres visiveis', () => {
  for (const nivel of [LEVEL.NONE, LEVEL.TRUECOLOR]) {
    const p = createPainter(nivel as ColorLevel);
    for (const kind of KINDS) {
      assert.strictEqual(visibleWidth(status(kind, '', p)), 7, `${kind} nivel ${nivel}`);
    }
  }
});

test('banner e ASCII puro', () => {
  const p = createPainter(LEVEL.NONE);
  for (const linha of banner(p, GLYPH.ASCII)) {
    for (const ch of linha) {
      const cp = ch.codePointAt(0) ?? 0;
      assert.ok(cp >= 0x20 && cp <= 0x7e, `caractere fora de ASCII imprimivel: ${JSON.stringify(ch)}`);
    }
  }
});

test('detectLevel devolve NONE quando a saida nao e TTY', () => {
  comAmbiente({ COLORTERM: 'truecolor', TERM: 'xterm-256color' }, false, () => {
    assert.strictEqual(detectLevel(), LEVEL.NONE);
  });
});

test('detectGlyphLevel devolve ASCII sem confirmacao de UTF-8', () => {
  comAmbiente({ LANG: '', LC_ALL: '', LC_CTYPE: '' }, true, () => {
    assert.strictEqual(detectGlyphLevel(), GLYPH.ASCII);
  });
});

test('status nao emite ponto de codigo fora do ASCII imprimivel em nivel ASCII', () => {
  const p = createPainter(LEVEL.NONE);
  for (const kind of KINDS) {
    const saida = status(kind, 'mensagem de teste', p);
    for (const ch of saida) {
      const cp = ch.codePointAt(0) ?? 0;
      assert.ok(cp >= 0x20 && cp <= 0x7e, `${kind}: ${JSON.stringify(ch)}`);
    }
  }
});

test('os intervalos de quadro do Spinner respeitam o teto de dez quadros por segundo', () => {
  for (const nivel of [GLYPH.ASCII, GLYPH.UNICODE_BOX, GLYPH.UNICODE_FULL]) {
    assert.ok(
      QUADROS_SPINNER[nivel as GlyphLevel].intervaloMs >= 100,
      `glifo ${nivel}: intervalo ${QUADROS_SPINNER[nivel as GlyphLevel].intervaloMs} ms`,
    );
  }
});

test('Spinner sem TTY produz uma linha em start e uma em stop, sem retorno de carro', () => {
  const escritas: string[] = [];
  const stream = { isTTY: false, write: (s: string) => { escritas.push(s); return true; } };
  const sp = new Spinner({ painter: createPainter(LEVEL.NONE), glyphLevel: GLYPH.ASCII, stream });
  sp.start('task-1.md');
  sp.update('task-1.md');
  sp.stop('[  OK ] task-1.md');
  assert.strictEqual(escritas.length, 2);
  for (const linha of escritas) {
    assert.ok(!linha.includes('\r'), `linha com \\r: ${JSON.stringify(linha)}`);
  }
});

test('Spinner restaura o cursor em stop', () => {
  const escritas: string[] = [];
  const stream = { isTTY: true, write: (s: string) => { escritas.push(s); return true; } };
  const ciAnterior = process.env.CI;
  delete process.env.CI;
  try {
    const sp = new Spinner({ painter: createPainter(LEVEL.NONE), glyphLevel: GLYPH.ASCII, stream });
    sp.start('t');
    sp.stop('[  OK ] t');
    assert.ok(escritas.some((s) => s.includes('\x1b[?25h')), 'sequencia de restauracao do cursor');
  } finally {
    if (ciAnterior === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ciAnterior;
    }
  }
});

test('box e rule desmontam para linha simples abaixo de 60 colunas', () => {
  const p = createPainter(LEVEL.NONE);
  const linhas = box(['conteudo'], { painter: p, glyphLevel: GLYPH.UNICODE_BOX, titulo: 't', colunas: 40 });
  assert.deepStrictEqual(linhas, ['conteudo']);

  const regua = rule(40, { painter: p, glyphLevel: GLYPH.UNICODE_BOX, colunas: 40 });
  assert.ok(!regua.includes('─'), 'sem traco de box drawing abaixo de 60 colunas');
  assert.match(regua, /^-+$/);
});
