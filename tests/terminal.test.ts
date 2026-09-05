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
  QUADROS_ESPERA,
} from '../dist/utils/terminal/index.js';
import type {
  ColorLevel,
  GlyphLevel,
  StatusKind,
  SpinnerEstado,
  ConjuntoDeQuadros,
} from '../dist/utils/terminal/index.js';

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

/**
 * Remove as sequencias de escape ANSI para medir colunas visiveis do texto.
 */
function semAnsi(texto: string): string {
  // eslint-disable-next-line no-control-regex
  return texto.replace(/\u001B\[[0-9;]*m/g, '');
}

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

test('o texto da mensagem de estado comeca na coluna 9 com e sem cor', () => {
  const MENSAGEM = 'mensagem de teste';
  for (const nivel of [LEVEL.NONE, LEVEL.TRUECOLOR]) {
    const p = createPainter(nivel as ColorLevel);
    for (const kind of KINDS) {
      const visivel = semAnsi(status(kind, MENSAGEM, p));
      assert.strictEqual(visivel.indexOf(MENSAGEM), 8, `${kind} nivel ${nivel}`);
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
  sp.stop('[OK]    task-1.md');
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
    sp.stop('[OK]    t');
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

const CALHA_ESPERADA = 7;

const ROTULOS_ESPERADOS: Record<StatusKind, string> = {
  ok: '[OK]',
  aviso: '[AVISO]',
  erro: '[ERRO]',
  info: '[INFO]',
};

test('nenhuma saida de estado reproduz a forma antiga com preenchimento interno', () => {
  const PROIBIDAS = ['[ AVIS', '[ INFO', '[  OK ', '[ ERRO'];
  for (const nivel of [LEVEL.NONE, LEVEL.TRUECOLOR]) {
    const p = createPainter(nivel as ColorLevel);
    for (const kind of KINDS) {
      for (const mensagem of ['mensagem de teste', '']) {
        const saida = semAnsi(status(kind, mensagem, p));
        for (const proibida of PROIBIDAS) {
          assert.ok(!saida.includes(proibida), `${kind} nivel ${nivel} contem ${proibida}`);
        }
      }
    }
  }
});

test('o rotulo sem mensagem sai sem preenchimento e sem espaco a direita', () => {
  for (const nivel of [LEVEL.NONE, LEVEL.TRUECOLOR]) {
    const p = createPainter(nivel as ColorLevel);
    for (const kind of KINDS) {
      for (const mensagem of ['', '   ']) {
        const visivel = semAnsi(status(kind, mensagem, p));
        assert.strictEqual(visivel, ROTULOS_ESPERADOS[kind], `${kind} nivel ${nivel}`);
        assert.ok(!visivel.endsWith(' '), `${kind} termina em espaco`);
        assert.ok(!/ {2,}/.test(visivel), `${kind} contem sequencia de espacos`);
      }
    }
  }
});

test('nenhuma sequencia de cor envolve o preenchimento da calha', () => {
  const MENSAGEM = 'mensagem de teste';
  const p = createPainter(LEVEL.TRUECOLOR as ColorLevel);
  for (const kind of KINDS) {
    const bruta = status(kind, MENSAGEM, p);
    const inicio = bruta.indexOf(MENSAGEM);
    assert.ok(inicio > 0, `${kind} sem mensagem na saida`);
    const largura = CALHA_ESPERADA - ROTULOS_ESPERADOS[kind].length + 1;
    const calha = bruta.slice(inicio - largura, inicio);
    assert.strictEqual(calha, ' '.repeat(largura), `${kind}: calha nao e texto neutro`);
  }
});

/*
 * Indicador de progresso nos dois estados (RF-008, RF-022, RNF-002).
 */

const NIVEIS_DE_GLIFO: GlyphLevel[] = [GLYPH.ASCII, GLYPH.UNICODE_BOX, GLYPH.UNICODE_FULL];

const CELULAS_DA_BARRA = 6;
const LIMPAR_LINHA = '\r\x1b[2K';

/** Colunas visiveis: sem cor e sem o prefixo de limpeza de linha. */
function corpoVisivel(linha: string): string {
  return semAnsi(linha.startsWith(LIMPAR_LINHA) ? linha.slice(LIMPAR_LINHA.length) : linha);
}

/**
 * Captura as escritas do indicador num stream falso. `CI` e removida porque a
 * condicao de animacao e `isTTY && !CI`, e a suite roda em CI.
 */
function comIndicador(
  glyphLevel: GlyphLevel,
  nivelDeCor: ColorLevel,
  isTTY: boolean,
  fn: (sp: Spinner, escritas: string[]) => void,
): void {
  const escritas: string[] = [];
  const stream = { isTTY, write: (s: string) => { escritas.push(s); return true; } };
  const ciAnterior = process.env.CI;
  delete process.env.CI;
  const sp = new Spinner({ painter: createPainter(nivelDeCor), glyphLevel, stream });
  try {
    fn(sp, escritas);
  } finally {
    sp.stop('fim');
    if (ciAnterior === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ciAnterior;
    }
  }
}

/** Congela o relogio para medir a duracao sem depender do tempo real. */
function comRelogio(fn: (avancarSegundos: (s: number) => void) => void): void {
  const original = Date.now;
  let agora = 1_700_000_000_000;
  Date.now = () => agora;
  try {
    fn((s) => { agora += s * 1000; });
  } finally {
    Date.now = original;
  }
}

test('todo quadro dos dois conjuntos tem 6 colunas visiveis, nos tres niveis de glifo', () => {
  const conjuntos: Array<[string, Record<GlyphLevel, ConjuntoDeQuadros>]> = [
    ['QUADROS_SPINNER', QUADROS_SPINNER],
    ['QUADROS_ESPERA', QUADROS_ESPERA],
  ];
  for (const [nome, conjunto] of conjuntos) {
    for (const nivel of NIVEIS_DE_GLIFO) {
      const { quadros } = conjunto[nivel];
      assert.ok(quadros.length > 0, `${nome} nivel ${nivel} sem quadros`);
      for (const quadro of quadros) {
        assert.strictEqual(
          [...semAnsi(quadro)].length,
          CELULAS_DA_BARRA,
          `${nome} nivel ${nivel}: quadro ${JSON.stringify(quadro)}`,
        );
      }
    }
  }
});

test('o conjunto de execucao tem 8 quadros a 100 ms e o de espera 6 quadros a 500 ms', () => {
  for (const nivel of NIVEIS_DE_GLIFO) {
    assert.strictEqual(QUADROS_SPINNER[nivel].quadros.length, 8, `execucao nivel ${nivel}`);
    assert.strictEqual(QUADROS_SPINNER[nivel].intervaloMs, 100, `execucao nivel ${nivel}`);
    assert.strictEqual(QUADROS_ESPERA[nivel].quadros.length, 6, `espera nivel ${nivel}`);
    assert.strictEqual(QUADROS_ESPERA[nivel].intervaloMs, 500, `espera nivel ${nivel}`);
    assert.ok(QUADROS_SPINNER[nivel].intervaloMs >= 100, `piso RNF-002 execucao ${nivel}`);
    assert.ok(QUADROS_ESPERA[nivel].intervaloMs >= 100, `piso RNF-002 espera ${nivel}`);
  }
});

test('o rotulo de execucao traz lote, modelo, esforco, ctx e a duracao humana em ultimo lugar', () => {
  const ROTULO = 'task-7 [3/12] opus/high ctx:sim';
  comRelogio((avancar) => {
    comIndicador(GLYPH.UNICODE_FULL, LEVEL.NONE as ColorLevel, true, (sp, escritas) => {
      sp.start(ROTULO);
      avancar(72);
      sp.update(ROTULO);
      const linha = corpoVisivel(escritas[escritas.length - 1]);
      for (const campo of ['task-7', '[3/12]', 'opus/high', 'ctx:sim', '1m 12s']) {
        assert.ok(linha.includes(campo), `sem ${campo} em ${JSON.stringify(linha)}`);
      }
      assert.ok(linha.endsWith('1m 12s'), `duracao nao esta em ultimo lugar: ${JSON.stringify(linha)}`);
    });
  });
});

test('a posicao de inicio do rotulo nao muda entre dois quadros consecutivos', () => {
  const ROTULO = 'task-7 [3/12] opus/high ctx:sim';
  for (const nivel of NIVEIS_DE_GLIFO) {
    comRelogio(() => {
      comIndicador(nivel, LEVEL.TRUECOLOR as ColorLevel, true, (sp, escritas) => {
        sp.start(ROTULO);
        sp.update(ROTULO);
        const [penultima, ultima] = escritas.slice(-2).map(corpoVisivel);
        assert.strictEqual(
          penultima.indexOf('task-7'),
          ultima.indexOf('task-7'),
          `nivel ${nivel}: rotulo deslocou entre quadros`,
        );
        assert.strictEqual(penultima.indexOf('task-7'), CELULAS_DA_BARRA + 1, `nivel ${nivel}`);
      });
    });
  }
});

test('no estado aguardando o quadro usa a cor de aviso, nunca a do estado de execucao', () => {
  const LINHA = 'aguardando renovacao da cota - falta 1h 04m - retoma 15:12 - task-7 [3/12]';
  const p = createPainter(LEVEL.TRUECOLOR as ColorLevel);
  comIndicador(GLYPH.UNICODE_FULL, LEVEL.TRUECOLOR as ColorLevel, true, (sp, escritas) => {
    sp.start('task-7 [3/12] opus/high ctx:sim');
    sp.aguardar(LINHA);
    const bruta = escritas[escritas.length - 1];
    const quadro = QUADROS_ESPERA[GLYPH.UNICODE_FULL].quadros[0];
    assert.ok(bruta.includes(p.aviso(quadro)), 'quadro de espera sem a cor de aviso');
    assert.ok(!bruta.includes(p.petroleo(quadro)), 'quadro de espera com a cor de execucao');
  });
});

test('no estado aguardando o rotulo nao recebe cronometro crescente', () => {
  const LINHA = 'aguardando renovacao da cota - falta 1h 04m - retoma 15:12 - task-7 [3/12]';
  comRelogio((avancar) => {
    comIndicador(GLYPH.UNICODE_FULL, LEVEL.NONE as ColorLevel, true, (sp, escritas) => {
      sp.start('task-7 [3/12] opus/high ctx:sim');
      avancar(72);
      sp.aguardar(LINHA);
      avancar(30);
      sp.update(LINHA);
      const linha = corpoVisivel(escritas[escritas.length - 1]);
      assert.ok(linha.endsWith(LINHA), `linha de espera alterada: ${JSON.stringify(linha)}`);
      assert.ok(!/\d+s$/.test(linha), 'cronometro crescente na linha de espera');
      assert.strictEqual(sp.estadoAtual, 'aguardando' satisfies SpinnerEstado);
    });
  });
});

test('retomar devolve o indicador a execucao, com a duracao medida desde o start', () => {
  const ROTULO = 'task-7 [3/12] opus/high ctx:sim';
  comRelogio((avancar) => {
    comIndicador(GLYPH.UNICODE_FULL, LEVEL.NONE as ColorLevel, true, (sp, escritas) => {
      sp.start(ROTULO);
      sp.aguardar('aguardando renovacao da cota');
      avancar(72);
      sp.retomar(ROTULO);
      assert.strictEqual(sp.estadoAtual, 'executando' satisfies SpinnerEstado);
      assert.ok(corpoVisivel(escritas[escritas.length - 1]).endsWith('1m 12s'));
    });
  });
});

test('sem cor os quadros de espera continuam distintos dos de execucao, nos tres niveis', () => {
  comAmbiente({ NO_COLOR: '1' }, true, () => {
    assert.strictEqual(detectLevel(), LEVEL.NONE);
    for (const nivel of NIVEIS_DE_GLIFO) {
      const execucao = new Set(QUADROS_SPINNER[nivel].quadros);
      for (const quadro of QUADROS_ESPERA[nivel].quadros) {
        assert.ok(!execucao.has(quadro), `nivel ${nivel}: quadro ${JSON.stringify(quadro)} repetido`);
      }
    }
    const p = createPainter(LEVEL.NONE);
    const escritas: string[] = [];
    const stream = { isTTY: true, write: (s: string) => { escritas.push(s); return true; } };
    const ciAnterior = process.env.CI;
    delete process.env.CI;
    const sp = new Spinner({ painter: p, glyphLevel: GLYPH.ASCII, stream });
    try {
      sp.start('task-7 [3/12] opus/high ctx:sim');
      sp.aguardar('aguardando renovacao da cota');
      const linha = corpoVisivel(escritas[escritas.length - 1]);
      assert.ok(!linha.includes('\x1b'), 'sequencia de cor com NO_COLOR');
      assert.ok(linha.startsWith(QUADROS_ESPERA[GLYPH.ASCII].quadros[0]), linha);
      assert.ok(linha.includes('aguardando'), linha);
    } finally {
      sp.stop('fim');
      if (ciAnterior === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = ciAnterior;
      }
    }
  });
});

test('sem TTY, ou com CI definida, nenhuma sequencia de animacao e emitida na espera', () => {
  const ANIMACAO = ['\r', '\x1b[?25l', '\x1b[?25h', '\x1b[2K'];
  const casos: Array<[string, boolean, string | undefined]> = [
    ['sem TTY', false, undefined],
    ['CI definida', true, '1'],
  ];
  for (const [nome, isTTY, ci] of casos) {
    const escritas: string[] = [];
    const stream = { isTTY, write: (s: string) => { escritas.push(s); return true; } };
    const ciAnterior = process.env.CI;
    if (ci === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ci;
    }
    try {
      const sp = new Spinner({ painter: createPainter(LEVEL.NONE), glyphLevel: GLYPH.ASCII, stream });
      sp.start('task-7 [3/12] opus/high ctx:sim');
      sp.aguardar('aguardando renovacao da cota');
      sp.update('aguardando renovacao da cota');
      sp.retomar('task-7 [3/12] opus/high ctx:sim');
      sp.stop('[OK] task-7');
      for (const linha of escritas) {
        for (const sequencia of ANIMACAO) {
          assert.ok(!linha.includes(sequencia), `${nome}: ${JSON.stringify(linha)}`);
        }
      }
    } finally {
      if (ciAnterior === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = ciAnterior;
      }
    }
  }
});

test('o cursor e restaurado quando o encerramento ocorre no estado aguardando', () => {
  const escritas: string[] = [];
  const stream = { isTTY: true, write: (s: string) => { escritas.push(s); return true; } };
  const ciAnterior = process.env.CI;
  delete process.env.CI;
  try {
    const sp = new Spinner({ painter: createPainter(LEVEL.NONE), glyphLevel: GLYPH.ASCII, stream });
    sp.start('task-7 [3/12] opus/high ctx:sim');
    sp.aguardar('aguardando renovacao da cota');
    assert.strictEqual(sp.estadoAtual, 'aguardando' satisfies SpinnerEstado);
    sp.stop('[AVISO] task-7 desistencia');
    assert.ok(escritas.some((s) => s.includes('\x1b[?25h')), 'cursor nao restaurado');
    assert.strictEqual(sp.estadoAtual, 'executando' satisfies SpinnerEstado);
  } finally {
    if (ciAnterior === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ciAnterior;
    }
  }
});
