import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  createLayout,
  ColumnLayout,
  MolduraLayout,
  ReguaLayout,
  LoteLayout,
} from '../dist/utils/layouts/index.js';
import type {
  LayoutContext,
  LayoutRenderer,
  TaskStartInfo,
  TaskEndInfo,
} from '../dist/utils/layouts/index.js';
import { camposConsumo, linhasDeTempoDoResumo, linhaDeEvidencia } from '../dist/utils/layouts/coluna.js';
import type { EstadoDeEspera } from '../dist/types/executar-tasks.js';
import {
  buildPreview,
  buildHeaderPreview,
  DADOS_DE_EXEMPLO,
} from '../dist/utils/layout-preview.js';
import { renderCabecalho } from '../dist/utils/cabecalho/index.js';
import type { HeaderStyle } from '../dist/types/config.js';
import { createPainter, LEVEL, GLYPH, visibleWidth } from '../dist/utils/terminal/index.js';
import type { GlyphLevel } from '../dist/utils/terminal/index.js';
import type { LayoutName } from '../dist/types/config.js';

const ANSI = /\x1b\[[0-9;]*m/g;
const painterNone = createPainter(LEVEL.NONE);
const painterCor = createPainter(LEVEL.TRUECOLOR);

interface FakeStream {
  writes: string[];
  isTTY?: boolean;
  write(texto: string): boolean;
}

function fakeStream(isTTY: boolean): FakeStream {
  const writes: string[] = [];
  return {
    writes,
    isTTY,
    write(texto: string): boolean {
      writes.push(String(texto));
      return true;
    },
  };
}

interface CtxOpts {
  isTTY?: boolean;
  largura?: number;
  glyphLevel?: GlyphLevel;
  cor?: boolean;
  estiloCabecalho?: HeaderStyle;
}

function fazerCtx(opts: CtxOpts = {}): { contexto: LayoutContext; stream: FakeStream } {
  const stream = fakeStream(opts.isTTY ?? false);
  const contexto: LayoutContext = {
    painter: opts.cor ? painterCor : painterNone,
    glyphLevel: opts.glyphLevel ?? GLYPH.ASCII,
    isTTY: opts.isTTY ?? false,
    largura: opts.largura ?? 100,
    stream: stream as unknown as NodeJS.WritableStream,
    estiloCabecalho: opts.estiloCabecalho ?? 'painel',
  };
  return { contexto, stream };
}

const START: TaskStartInfo = {
  arquivo: 'task-1.md',
  numero: 1,
  posicao: 1,
  total: 4,
  model: 'sonnet',
  effort: 'medium',
  usouContextoExecucao: true,
};

const END: TaskEndInfo = {
  arquivo: 'task-1.md',
  numero: 1,
  posicao: 1,
  total: 4,
  estado: 'ok',
  sessionId: '7f3a',
  numTurns: 34,
  wallSeconds: 514,
  tokensDaTask: 1034600,
  custoDaTaskUsd: 1.2346,
  reasoningTokens: null,
  permissionDenials: 0,
  semCertificacao: false,
};

function semAnsi(s: string): string {
  return s.replace(ANSI, '');
}

function rodarStartEnd(layout: LayoutRenderer): void {
  layout.header(DADOS_DE_EXEMPLO);
  layout.taskStart(START);
  layout.taskEnd(END);
  layout.summary(['resumo']);
  layout.dispose();
}

function semCI<T>(fn: () => T): T {
  const anterior = process.env.CI;
  delete process.env.CI;
  try {
    return fn();
  } finally {
    if (anterior !== undefined) {
      process.env.CI = anterior;
    }
  }
}

const NOMES: LayoutName[] = ['coluna', 'moldura', 'regua', 'lote'];

// 1
test('createLayout devolve ColumnLayout para lote sem TTY', () => {
  const { contexto } = fazerCtx({ isTTY: false });
  assert.ok(createLayout('lote', contexto) instanceof ColumnLayout);
});

// 2
test('createLayout devolve LoteLayout para lote com TTY', () => {
  const { contexto } = fazerCtx({ isTTY: true });
  assert.ok(createLayout('lote', contexto) instanceof LoteLayout);
});

// 3
test('createLayout devolve a classe correta para coluna, moldura e regua', () => {
  const { contexto } = fazerCtx({ isTTY: true });
  assert.ok(createLayout('coluna', contexto) instanceof ColumnLayout);
  assert.ok(createLayout('moldura', contexto) instanceof MolduraLayout);
  assert.ok(createLayout('regua', contexto) instanceof ReguaLayout);
});

// 4
test('createLayout devolve ColumnLayout para nome fora dos quatro, sem lancar', () => {
  const { contexto } = fazerCtx({ isTTY: true });
  assert.ok(createLayout('outro' as LayoutName, contexto) instanceof ColumnLayout);
});

// 5
test('os quatro layouts emitem os mesmos dados de estado e de consumo', () => {
  const esperados = [
    'task-1',
    '[1/4]',
    'sonnet',
    'medium',
    'ctx:sim',
    '[OK]',
    'tokens=1.034.600',
    'custo=$1.2346',
    'turnos=34',
    'tempo=8m 34s',
    'rac=n/d',
    'neg=0',
  ];
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    const saida = semAnsi(stream.writes.join(''));
    for (const token of esperados) {
      assert.ok(saida.includes(token), `${nome} sem ${token}`);
    }
  }
});

// 8
test('o rotulo de estado sai por extenso e na calha de sete colunas nos quatro layouts', () => {
  assert.equal(visibleWidth('[OK]' + ' '.repeat(3)), 7);
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    const saida = semAnsi(stream.writes.join(''));
    assert.ok(saida.includes('[OK]'), nome);
    assert.ok(!saida.includes('[  OK '), `${nome} manteve o preenchimento interno`);
  }
});

// 11
test('com TTY, o layout coluna substitui o indicador na mesma linha', () => {
  semCI(() => {
    const { contexto, stream } = fazerCtx({ isTTY: true });
    const layout = createLayout('coluna', contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    const juntas = stream.writes.join('');
    assert.ok(juntas.includes('\r\x1b[2K'));
    assert.ok(semAnsi(juntas).includes('tokens=1.034.600'));
    layout.dispose();
  });
});

// 12
test('o layout regua exibe a posicao da task no lote a direita', () => {
  const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
  const layout = createLayout('regua', contexto);
  layout.taskStart(START);
  const linha = semAnsi(stream.writes.join('')).trimEnd();
  assert.ok(linha.endsWith('[1/4]'), linha);
});

// 13
test('o layout moldura abre e fecha uma moldura por task', () => {
  const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100, glyphLevel: GLYPH.ASCII });
  const layout = createLayout('moldura', contexto);
  layout.taskStart(START);
  const bordas = semAnsi(stream.writes.join('')).match(/^\+-+\+$/gm) ?? [];
  assert.ok(bordas.length >= 2, `bordas=${bordas.length}`);
});

// 14
test('o layout lote exibe barra de progresso e mantem altura fixa ate quinze tasks', () => {
  const { contexto, stream } = fazerCtx({ isTTY: true, largura: 100 });
  const layout = new LoteLayout(contexto);
  for (let i = 1; i <= 5; i += 1) {
    layout.taskStart({ ...START, arquivo: `task-${i}.md`, numero: i, posicao: i, total: 5 });
    layout.taskEnd({ ...END, arquivo: `task-${i}.md`, numero: i, posicao: i, total: 5 });
  }
  const juntas = stream.writes.join('');
  assert.ok(semAnsi(juntas).includes('] 5/5'));
  assert.ok(/\x1b\[\d+A/.test(juntas), 'sem movimento de cursor para cima');
  assert.ok(!juntas.includes('\x1b[2J'), 'limpou a tela');
  layout.dispose();
});

// 15
test('o layout lote com mais de quinze tasks exibe janela das ativas mais contador das concluidas', () => {
  const { contexto, stream } = fazerCtx({ isTTY: true, largura: 100 });
  const layout = new LoteLayout(contexto);
  for (let i = 1; i <= 20; i += 1) {
    layout.taskStart({ ...START, arquivo: `task-${i}.md`, numero: i, posicao: i, total: 20 });
  }
  const saida = semAnsi(stream.writes.join(''));
  assert.ok(saida.includes('concluidas:'));
  assert.ok(saida.includes('/20'));
  layout.dispose();
});

// 18
test('taskSkipped avisa quando a task pulada estava selecionada', () => {
  const comAviso = fazerCtx({ isTTY: false });
  createLayout('coluna', comAviso.contexto).taskSkipped('task-2.md', 'DONE', true);
  const texto = semAnsi(comAviso.stream.writes.join(''));
  assert.ok(/selecionada/.test(texto));
  assert.ok(/Status/.test(texto));

  const semAviso = fazerCtx({ isTTY: false });
  createLayout('coluna', semAviso.contexto).taskSkipped('task-2.md', 'DONE', false);
  assert.ok(!/selecionada mas nao foi executada/.test(semAnsi(semAviso.stream.writes.join(''))));
});

// 19
test('dispose para o spinner e restaura o cursor nos quatro layouts', () => {
  semCI(() => {
    for (const nome of NOMES) {
      const { contexto, stream } = fazerCtx({ isTTY: true });
      const layout =
        nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
      layout.taskStart(START);
      layout.dispose();
      assert.ok(stream.writes.join('').includes('\x1b[?25h'), nome);
    }
  });
});

// 6
test('nenhum layout emite sequencia ANSI com painter de nivel NONE', () => {
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, cor: false });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    rodarStartEnd(layout);
    assert.ok(!ANSI.test(stream.writes.join('')), nome);
    ANSI.lastIndex = 0;
  }
});

// 7
test('nenhum layout emite caractere nao-ASCII com glyphLevel ASCII', () => {
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, glyphLevel: GLYPH.ASCII, cor: false });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    rodarStartEnd(layout);
    const saida = stream.writes.join('');
    for (const ch of saida) {
      assert.ok(ch.charCodeAt(0) <= 0x7e || ch === '\x1b', `${nome}: ${ch}`);
    }
  }
});

// 9
test('sem TTY, cada task produz exatamente uma escrita em taskStart e uma em taskEnd, nos quatro layouts', () => {
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    assert.equal(stream.writes.length, 1, `${nome} taskStart`);
    layout.taskEnd(END);
    assert.equal(stream.writes.length, 2, `${nome} taskEnd`);
  }
});

// 10
test('sem TTY, nenhuma escrita contem retorno de carro, nos quatro layouts', () => {
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    rodarStartEnd(layout);
    for (const escrita of stream.writes) {
      assert.ok(!escrita.includes('\r'), nome);
    }
  }
});

// 16
test('moldura e regua desmontam para linha simples abaixo de 60 colunas', () => {
  for (const nome of ['moldura', 'regua'] as LayoutName[]) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 50 });
    const layout = createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    const saida = semAnsi(stream.writes.join(''));
    assert.ok(!saida.includes('+'), `${nome} manteve moldura`);
    assert.ok(!/-{3,}/.test(saida), `${nome} manteve regua`);
  }
});

// 17
test('a largura util e limitada entre 60 e 100 colunas', () => {
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 200 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    for (const linha of semAnsi(stream.writes.join('')).split('\n')) {
      assert.ok(visibleWidth(linha) <= 100, `${nome}: ${linha.length}`);
    }
  }
});

// 20
test('nenhum layout emite emoji em nenhum nivel de glifo', () => {
  const niveis: GlyphLevel[] = [GLYPH.ASCII, GLYPH.UNICODE_BOX, GLYPH.UNICODE_FULL];
  for (const nome of NOMES) {
    for (const glyphLevel of niveis) {
      const { contexto, stream } = fazerCtx({ isTTY: false, glyphLevel });
      const layout =
        nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
      rodarStartEnd(layout);
      assert.ok(
        !/\p{Extended_Pictographic}/u.test(stream.writes.join('')),
        `${nome}/${glyphLevel}`,
      );
    }
  }
});

const DIR_LAYOUTS = join(process.cwd(), 'src', 'utils', 'layouts');

// 21
test('nenhum arquivo de layouts importa chalk', () => {
  for (const arquivo of readdirSync(DIR_LAYOUTS)) {
    const fonte = readFileSync(join(DIR_LAYOUTS, arquivo), 'utf8');
    assert.ok(!/chalk/.test(fonte), arquivo);
  }
});

// 22
test('nenhum layout le variavel de ambiente diretamente', () => {
  for (const arquivo of readdirSync(DIR_LAYOUTS)) {
    const fonte = readFileSync(join(DIR_LAYOUTS, arquivo), 'utf8');
    assert.ok(!/process\.env/.test(fonte), arquivo);
  }
});

// CR-004: o indicador de andamento e do comando, nao do layout `coluna`.
test('com TTY, moldura, regua e coluna exibem indicador animado com tempo decorrido', () => {
  semCI(() => {
    for (const nome of ['coluna', 'moldura', 'regua'] as LayoutName[]) {
      const { contexto, stream } = fazerCtx({ isTTY: true, largura: 100 });
      const layout = createLayout(nome, contexto);
      layout.taskStart(START);
      const durante = stream.writes.join('');
      assert.ok(durante.includes('\r\x1b[2K'), `${nome} sem reescrita de linha`);
      assert.ok(/\b\d+s\b/.test(semAnsi(durante)), `${nome} sem tempo decorrido`);
      assert.ok(durante.includes('\x1b[?25l'), `${nome} nao ocultou o cursor`);

      layout.taskEnd(END);
      const total = semAnsi(stream.writes.join(''));
      assert.ok(total.includes('tokens=1.034.600'), `${nome} sem numeros de consumo`);
      assert.ok(stream.writes.join('').includes('\x1b[?25h'), `${nome} nao devolveu o cursor`);
    }
  });
});

test('o layout lote atualiza o tempo decorrido da task ativa', async () => {
  const { contexto, stream } = fazerCtx({ isTTY: true, largura: 100 });
  const layout = new LoteLayout(contexto);
  layout.taskStart(START);
  const inicial = stream.writes.length;

  // O bloco e redesenhado por temporizador, nao apenas em taskStart/taskEnd.
  await new Promise((r) => setTimeout(r, 350));
  assert.ok(stream.writes.length > inicial, 'o bloco nao foi redesenhado sozinho');
  assert.ok(/\b\d+s\b/.test(semAnsi(stream.writes.join(''))), 'sem tempo decorrido');

  layout.taskEnd(END);
  layout.dispose();

  // Sem task ativa o temporizador para: nenhuma escrita nova depois do dispose.
  const depois = stream.writes.length;
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(stream.writes.length, depois);
});

test('camposConsumo exibe raciocinio e negacoes reportados como numero', () => {
  const linha = camposConsumo({ ...END, reasoningTokens: 69, permissionDenials: 3 });
  assert.ok(linha.includes('rac=69'), linha);
  assert.ok(linha.includes('neg=3'), linha);
});

test('camposConsumo exibe n/d, e nunca 0, para raciocinio e negacoes nao reportados', () => {
  const linha = camposConsumo({ ...END, reasoningTokens: null, permissionDenials: null });
  assert.ok(linha.includes('rac=n/d'), linha);
  assert.ok(linha.includes('neg=n/d'), linha);
  assert.ok(!linha.includes('rac=0'), linha);
  assert.ok(!linha.includes('neg=0'), linha);
});

test('camposConsumo distingue zero reportado de nao reportado', () => {
  const zero = camposConsumo({ ...END, reasoningTokens: 0, permissionDenials: 0 });
  assert.ok(zero.includes('rac=0'), zero);
  assert.ok(zero.includes('neg=0'), zero);
});

test('os quatro layouts exibem n/d quando os contadores nao sao reportados', () => {
  const NOMES: LayoutName[] = ['coluna', 'moldura', 'regua', 'lote'];
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd({ ...END, reasoningTokens: null, permissionDenials: null });
    const saida = semAnsi(stream.writes.join(''));
    assert.ok(saida.includes('rac=n/d'), `${nome} sem rac=n/d`);
    assert.ok(saida.includes('neg=n/d'), `${nome} sem neg=n/d`);
  }
});

const ESPERA_CONHECIDA: EstadoDeEspera = {
  natureza: 'renovacao_conhecida',
  restanteSegundos: 3870,
  retomadaEm: new Date(2026, 8, 4, 15, 12, 0),
  task: 'task-7.md',
  posicao: 3,
  total: 12,
  tentativa: 2,
};

const ESPERA_SONDAGEM: EstadoDeEspera = {
  ...ESPERA_CONHECIDA,
  natureza: 'sondagem',
  restanteSegundos: 277,
  retomadaEm: new Date(2026, 8, 4, 14, 13, 0),
};

test('o mesmo DadosDeAbertura produz o mesmo cabecalho nos quatro layouts, e trocar o estilo troca a forma nos quatro', () => {
  const ESTILOS: HeaderStyle[] = ['painel', 'regua', 'compacto'];
  for (const estilo of ESTILOS) {
    const saidas: string[] = [];
    for (const nome of NOMES) {
      const { contexto, stream } = fazerCtx({
        isTTY: false,
        largura: 100,
        estiloCabecalho: estilo,
      });
      const layout =
        nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
      layout.header(DADOS_DE_EXEMPLO);
      layout.dispose();
      saidas.push(stream.writes.join(''));
    }
    for (const saida of saidas.slice(1)) {
      assert.equal(saida, saidas[0], `estilo ${estilo} divergiu entre layouts`);
    }
  }

  const formas = ESTILOS.map((estilo) => {
    const { contexto, stream } = fazerCtx({
      isTTY: false,
      largura: 100,
      estiloCabecalho: estilo,
    });
    createLayout('coluna', contexto).header(DADOS_DE_EXEMPLO);
    return stream.writes.join('');
  });
  assert.equal(new Set(formas).size, 3, 'os tres estilos deveriam produzir formas distintas');
});

test('a linha de fim apresenta tempo, tokens, custo, turnos, raciocinio e negacoes nessa ordem nos quatro layouts', () => {
  const fim = {
    ...END,
    wallSeconds: 72,
    tokensDaTask: 82000,
    custoDaTaskUsd: 0.1234,
    reasoningTokens: null,
  };
  const campos = [
    'tempo=1m 12s',
    'tokens=82.000',
    'custo=$0.1234',
    'turnos=34',
    'rac=n/d',
    'neg=0',
  ];
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false, largura: 100 });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(fim);
    const saida = semAnsi(stream.writes.join(''));
    const posicoes = campos.map((campo) => saida.indexOf(campo));
    for (const [i, pos] of posicoes.entries()) {
      assert.ok(pos >= 0, `${nome} sem ${campos[i]}`);
      if (i > 0) {
        assert.ok(pos > posicoes[i - 1], `${nome}: ${campos[i]} fora de ordem`);
      }
    }
  }
});

test('o resumo apresenta Tempo total sempre e Tempo em espera apenas quando o acumulado e maior que zero', () => {
  assert.deepEqual(linhasDeTempoDoResumo(3870, 0), ['  Tempo total        1h 04m']);
  assert.deepEqual(linhasDeTempoDoResumo(3870, 8100), [
    '  Tempo total        1h 04m',
    '  Tempo em espera    2h 15m',
  ]);
});

test('cada evidencia apresenta o tempo da respectiva task em primeiro lugar', () => {
  const linha = linhaDeEvidencia({
    arquivo: 'task-1.md',
    tempoSegundos: 242,
    sessionId: '7f3a...',
    tokens: 482100,
    turnos: 34,
    negacoes: 0,
    usouContexto: true,
  });
  assert.ok(linha.startsWith('    task-1  tempo=4m 02s  '), linha);
  assert.ok(linha.includes('sessao=7f3a...'), linha);
  assert.ok(linha.includes('tokens=482.100'), linha);
  assert.ok(linha.includes('neg=0'), linha);
  assert.ok(linha.includes('ctx=sim'), linha);
});

test('a linha de espera apresenta tempo restante e horario absoluto com renovacao conhecida, e proxima sondagem quando desconhecida', () => {
  semCI(() => {
    const { contexto, stream } = fazerCtx({ isTTY: true });
    const layout = createLayout('coluna', contexto);
    layout.waitStart(ESPERA_CONHECIDA);
    layout.waitUpdate(ESPERA_CONHECIDA);
    layout.waitEnd(6387);
    layout.dispose();
    const saida = semAnsi(stream.writes.join(''));
    assert.ok(saida.includes('aguardando renovacao da cota'), saida);
    assert.ok(saida.includes('falta 1h 04m'), saida);
    assert.ok(saida.includes('retoma 15:12'), saida);
    assert.ok(saida.includes('task-7 [3/12]'), saida);
    assert.ok(saida.includes('espera de 1h 46m'), saida);
  });

  semCI(() => {
    const { contexto, stream } = fazerCtx({ isTTY: true });
    const layout = createLayout('coluna', contexto);
    layout.waitStart(ESPERA_SONDAGEM);
    layout.waitUpdate(ESPERA_SONDAGEM);
    layout.dispose();
    const saida = semAnsi(stream.writes.join(''));
    assert.ok(saida.includes('proxima sondagem em 4m 37s'), saida);
    assert.ok(saida.includes('retoma 14:13'), saida);
  });
});

test('fora de TTY, os metodos de espera escrevem linhas de texto sem nenhuma sequencia de animacao', () => {
  const { contexto, stream } = fazerCtx({ isTTY: false });
  const layout = createLayout('coluna', contexto);
  layout.waitStart(ESPERA_CONHECIDA);
  layout.waitUpdate(ESPERA_CONHECIDA);
  layout.waitEnd(6387);
  layout.dispose();
  const juntas = stream.writes.join('');
  assert.ok(juntas.includes('aguardando renovacao da cota'), juntas);
  assert.ok(juntas.includes('retomada as '), juntas);
  assert.ok(juntas.includes('espera de 1h 46m'), juntas);
  for (const escrita of stream.writes) {
    assert.ok(!escrita.includes('\r'), 'retorno de carro fora de TTY');
    assert.ok(!escrita.includes('\x1b[?25l'), 'ocultou o cursor fora de TTY');
    assert.ok(!escrita.includes('\x1b[2K'), 'limpou linha fora de TTY');
  }
});

test('em LoteLayout, os tres metodos de espera encerram o bloco antes de escrever', () => {
  semCI(() => {
    const acoes: Array<{ agir: (layout: LoteLayout) => void; marca: string }> = [
      { agir: (layout) => layout.waitStart(ESPERA_CONHECIDA), marca: 'aguardando renovacao da cota' },
      { agir: (layout) => layout.waitUpdate(ESPERA_CONHECIDA), marca: 'aguardando renovacao da cota' },
      { agir: (layout) => layout.waitEnd(6387), marca: 'retomada as ' },
    ];
    for (const { agir, marca } of acoes) {
      const { contexto, stream } = fazerCtx({ isTTY: true, largura: 100 });
      const layout = new LoteLayout(contexto);
      layout.taskStart(START);
      agir(layout);
      const idx = stream.writes.findIndex((escrita) => escrita.includes(marca));
      assert.ok(idx > 0, `linha com "${marca}" nao foi escrita`);
      const quebra = stream.writes.lastIndexOf('\n', idx - 1);
      assert.ok(quebra >= 0, 'o bloco de altura fixa nao foi encerrado antes de escrever');
      for (const escrita of stream.writes.slice(quebra + 1, idx)) {
        assert.ok(
          !/\x1b\[\d+A/.test(escrita),
          'o bloco foi redesenhado depois de encerrado',
        );
      }
      layout.dispose();
    }
  });
});

/**
 * Pre-visualizacoes de `config` (RF-007). Ambiente fixo: sem cor e em ASCII, para
 * que a comparacao seja textual e nao dependa do terminal de quem roda a suite.
 */
const BASE_PREVIA = {
  painter: painterNone,
  glyphLevel: GLYPH.ASCII,
  largura: 72,
};

const ESTILOS_DE_CABECALHO: HeaderStyle[] = ['painel', 'regua', 'compacto'];
const NOMES_DE_LAYOUT: LayoutName[] = ['coluna', 'moldura', 'regua', 'lote'];

test('cada uma das tres opcoes de estilo mostra o cabecalho na sua forma', () => {
  const formas = ESTILOS_DE_CABECALHO.map((estilo) =>
    buildHeaderPreview(estilo, BASE_PREVIA).join('\n')
  );

  for (const [i, estilo] of ESTILOS_DE_CABECALHO.entries()) {
    const esperado = renderCabecalho(estilo, DADOS_DE_EXEMPLO, BASE_PREVIA).join('\n');
    assert.equal(formas[i], esperado, `previa do estilo ${estilo} diverge de renderCabecalho`);
    assert.ok(formas[i].includes(DADOS_DE_EXEMPLO.feature), `estilo ${estilo} sem a feature`);
  }

  assert.equal(new Set(formas).size, 3, 'as tres formas deveriam ser distintas');
});

test('cada uma das quatro opcoes de layout mostra o cabecalho seguido das linhas de task', () => {
  for (const nome of NOMES_DE_LAYOUT) {
    const cabecalho = buildHeaderPreview('painel', BASE_PREVIA);
    const previa = buildPreview(nome, { ...BASE_PREVIA, cabecalho: 'painel' });

    assert.deepEqual(
      previa.slice(0, cabecalho.length),
      cabecalho,
      `previa do layout ${nome} nao comeca pelo cabecalho`
    );
    assert.ok(
      previa.length > cabecalho.length,
      `previa do layout ${nome} nao tem linhas de task depois do cabecalho`
    );
    assert.ok(
      previa.slice(cabecalho.length).join('\n').includes('task-1'),
      `previa do layout ${nome} sem as linhas de task`
    );
  }
});

test('a previa de layout usa o estilo de cabecalho recebido', () => {
  for (const estilo of ESTILOS_DE_CABECALHO) {
    const previa = buildPreview('coluna', { ...BASE_PREVIA, cabecalho: estilo });
    const cabecalho = buildHeaderPreview(estilo, BASE_PREVIA);
    assert.deepEqual(previa.slice(0, cabecalho.length), cabecalho, `estilo ${estilo}`);
  }
});

test('as duas previas usam a mesma constante de dados de exemplo', () => {
  // 100 colunas: o teto de `larguraUtil`, onde nenhum valor longo e truncado.
  const larga = { ...BASE_PREVIA, largura: 100 };
  const doEstilo = buildHeaderPreview('regua', larga).join('\n');
  const doLayout = buildPreview('regua', { ...larga, cabecalho: 'regua' }).join('\n');

  for (const valor of [
    DADOS_DE_EXEMPLO.feature,
    DADOS_DE_EXEMPLO.criterioDeSelecao,
    DADOS_DE_EXEMPLO.permissoes,
    DADOS_DE_EXEMPLO.registroPath,
  ]) {
    assert.ok(doEstilo.includes(valor), `previa de estilo sem ${valor}`);
    assert.ok(doLayout.includes(valor), `previa de layout sem ${valor}`);
  }
});
