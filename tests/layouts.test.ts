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
}

function fazerCtx(opts: CtxOpts = {}): { contexto: LayoutContext; stream: FakeStream } {
  const stream = fakeStream(opts.isTTY ?? false);
  const contexto: LayoutContext = {
    painter: opts.cor ? painterCor : painterNone,
    glyphLevel: opts.glyphLevel ?? GLYPH.ASCII,
    isTTY: opts.isTTY ?? false,
    largura: opts.largura ?? 100,
    stream: stream as unknown as NodeJS.WritableStream,
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
  permissionDenials: 0,
  semCertificacao: false,
};

function semAnsi(s: string): string {
  return s.replace(ANSI, '');
}

function rodarStartEnd(layout: LayoutRenderer): void {
  layout.header(['cabecalho']);
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
    '[  OK ]',
    'tokens=1034600',
    'custo=$1.2346',
    'turnos=34',
    'dur=514s',
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
test('o rotulo de estado tem sete colunas visiveis nos quatro layouts', () => {
  assert.equal(visibleWidth('[  OK ]'), 7);
  for (const nome of NOMES) {
    const { contexto, stream } = fazerCtx({ isTTY: false });
    const layout =
      nome === 'lote' ? new LoteLayout(contexto) : createLayout(nome, contexto);
    layout.taskStart(START);
    layout.taskEnd(END);
    assert.ok(semAnsi(stream.writes.join('')).includes('[  OK ]'), nome);
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
    assert.ok(semAnsi(juntas).includes('tokens=1034600'));
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
      assert.ok(total.includes('tokens=1034600'), `${nome} sem numeros de consumo`);
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
