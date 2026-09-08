import process from 'node:process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runConfig,
  type ConfigDeps,
  type SelectLayoutParams,
  type SelectHeaderStyleParams,
  type SelectFerramentaParams,
} from '../dist/commands/config.js';
import {
  validateChave,
  validateLayoutValor,
  validateCabecalhoValor,
  validateFerramentaValor,
} from '../dist/utils/config-command-validation.js';
import { buildPreview } from '../dist/utils/layout-preview.js';
import {
  createPainter,
  LEVEL,
  GLYPH,
  visibleWidth,
} from '../dist/utils/terminal/index.js';
import type { HeaderStyle, LayoutName, ToolSlug } from '../dist/types/config.js';

// Separador nominal deterministico nos cartoes: `detectGlyphLevel` le o
// ambiente a cada execucao e a suite precisa de um unico nivel.
process.env.SPECIFICA_GLYPHS = 'ascii';

const ANSI = /\x1b\[[0-9;]*m/g;
// Variant ASCII do hint: a suite forca SPECIFICA_GLYPHS=ascii no topo do arquivo.
const HINT = 'cima/baixo navegam - enter aplica - esc encerra';
const HINT_UNICODE = '↑ ↓ navegam - enter aplica - esc encerra';
// Forma dobrada: o kleur do prompts reescreve \x1b[24m literal reabrindo o
// sublinhado, e a forma combinada escapa dessa reescrita.
const SEM_SUBLINHADO = '\x1b[24;24m';

interface FakeConfig {
  version: number;
  layout?: LayoutName;
  cabecalho?: HeaderStyle;
  projetos?: Record<string, { ferramenta: ToolSlug; atualizadoEm: string }>;
}

interface FakeState {
  arquivo: FakeConfig | Error;
  setLayoutCalls: LayoutName[];
  setHeaderStyleCalls: HeaderStyle[];
  setToolCalls: Array<{ projeto: string; slug: ToolSlug }>;
  saida: string[];
  erros: string[];
  selectParams: SelectLayoutParams[];
  selectHeaderParams: SelectHeaderStyleParams[];
  selectFerramentaParams: SelectFerramentaParams[];
}

interface DepsOpts {
  arquivo?: FakeConfig | Error;
  projeto?: string;
  isTTY?: boolean;
  colunas?: number;
  escolha?: LayoutName | undefined;
  escolhaCabecalho?: HeaderStyle | undefined;
  escolhaFerramenta?: ToolSlug | undefined;
}

function fazerDeps(opts: DepsOpts = {}): { deps: ConfigDeps; state: FakeState } {
  const state: FakeState = {
    arquivo: opts.arquivo ?? { version: 1, layout: 'coluna', cabecalho: 'painel', projetos: {} },
    setLayoutCalls: [],
    setHeaderStyleCalls: [],
    setToolCalls: [],
    saida: [],
    erros: [],
    selectParams: [],
    selectHeaderParams: [],
    selectFerramentaParams: [],
  };

  const configService = {
    configPath: '/home/tester/.specifica-br/config.json',
    async load(): Promise<FakeConfig> {
      if (state.arquivo instanceof Error) {
        throw state.arquivo;
      }
      // `load()` real normaliza `cabecalho` para o padrao quando ausente ou
      // invalido (CT-042); o dublê reproduz essa garantia.
      const copia = JSON.parse(JSON.stringify(state.arquivo)) as FakeConfig;
      return { ...copia, cabecalho: copia.cabecalho ?? 'painel' };
    },
    async setLayout(layout: LayoutName): Promise<void> {
      state.setLayoutCalls.push(layout);
      if (!(state.arquivo instanceof Error)) {
        state.arquivo.layout = layout;
      }
    },
    async setHeaderStyle(estilo: HeaderStyle): Promise<void> {
      state.setHeaderStyleCalls.push(estilo);
      if (!(state.arquivo instanceof Error)) {
        state.arquivo.cabecalho = estilo;
      }
    },
    async setProjectTool(projeto: string, slug: ToolSlug): Promise<void> {
      state.setToolCalls.push({ projeto, slug });
    },
  };

  const identityService = {
    async resolve() {
      return { nome: opts.projeto ?? 'projeto-x', origem: 'cwd', bruto: opts.projeto ?? 'projeto-x' };
    },
  };

  const io = {
    write: (texto: string) => {
      state.saida.push(texto);
    },
    writeErr: (texto: string) => {
      state.erros.push(texto);
    },
    isTTY: opts.isTTY ?? false,
    colunas: opts.colunas === undefined ? undefined : () => opts.colunas,
    async selectLayout(params: SelectLayoutParams): Promise<LayoutName | undefined> {
      state.selectParams.push(params);
      return opts.escolha;
    },
    async selectHeaderStyle(params: SelectHeaderStyleParams): Promise<HeaderStyle | undefined> {
      state.selectHeaderParams.push(params);
      return opts.escolhaCabecalho;
    },
    async selectFerramenta(params: SelectFerramentaParams): Promise<ToolSlug | undefined> {
      state.selectFerramentaParams.push(params);
      return opts.escolhaFerramenta;
    },
  };

  return {
    deps: {
      configService: configService as unknown as ConfigDeps['configService'],
      identityService: identityService as unknown as ConfigDeps['identityService'],
      io,
    },
    state,
  };
}

function textoSaida(state: FakeState): string {
  return state.saida.join('');
}

function primeiraLinha(title: string): string {
  return title.split('\n')[0];
}

function maiorLarguraVisivel(titles: string[]): number {
  return Math.max(
    ...titles.flatMap((title) => title.split('\n').map(visibleWidth)),
  );
}

test('validateChave rejeita chave diferente de layout e ferramenta', () => {
  assert.equal(validateChave('layout'), 'layout');
  assert.equal(validateChave('ferramenta'), 'ferramenta');
  assert.throws(() => validateChave('outra'));
});

test('validateLayoutValor rejeita valor fora dos quatro layouts', () => {
  for (const nome of ['coluna', 'moldura', 'regua', 'lote']) {
    assert.equal(validateLayoutValor(nome), nome);
  }
  assert.throws(() => validateLayoutValor('grade'));
});

test('validateFerramentaValor aceita os cinco slugs sem distincao de caixa e rejeita os demais', () => {
  assert.equal(validateFerramentaValor('CLAUDECODE'), 'claudecode');
  assert.equal(validateFerramentaValor('Gemini-CLI'), 'gemini-cli');
  assert.throws(() => validateFerramentaValor('copilot'));
});

test('config sem argumentos e sem TTY exibe a vigente e encerra com codigo 0, sem abrir nenhuma selecao', async () => {
  const { deps, state } = fazerDeps({ isTTY: false });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.equal(state.selectParams.length, 0);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.equal(state.selectFerramentaParams.length, 0);
  assert.match(textoSaida(state), /Layout\s+coluna/);
});

test('config com TTY abre o carrossel: um cartao por pagina, contador, marcador de atual e hint', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined, arquivo: { version: 1, layout: 'regua', projetos: {} } });
  await runConfig(undefined, undefined, deps);
  assert.equal(state.selectParams.length, 1);
  const params = state.selectParams[0];
  assert.equal(params.choices.length, 4);
  assert.equal(params.optionsPerPage, 1);
  assert.equal(params.hint, HINT);
  assert.equal(params.initial, params.choices.findIndex((c) => c.value === 'regua'));

  const atual = params.choices.find((c) => c.value === 'regua');
  assert.ok(atual, 'cartao do layout vigente ausente');
  assert.match(primeiraLinha(atual.title), /regua  3\/4 - atual$/);
  for (const [indice, escolha] of params.choices.entries()) {
    assert.match(primeiraLinha(escolha.title), new RegExp(` ${indice + 1}/4`));
    assert.ok(escolha.title.split('\n').length > 1, 'cartao sem previa');
  }
  assert.equal(
    params.choices.filter((c) => / - atual$/.test(primeiraLinha(c.title))).length,
    1,
    'marcador de atual em mais de um cartao',
  );
});

test('a segunda selecao, a de cabecalho, tambem e carrossel e abre apos a de layout', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'moldura',
    escolhaCabecalho: 'compacto',
    escolhaFerramenta: undefined,
    arquivo: { version: 1, layout: 'coluna', cabecalho: 'regua', projetos: {} },
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.equal(state.selectHeaderParams.length, 1);
  const params = state.selectHeaderParams[0];
  assert.equal(params.choices.length, 3);
  assert.equal(params.optionsPerPage, 1);
  assert.equal(params.hint, HINT);
  const atual = params.choices.find((c) => c.value === 'regua');
  assert.ok(atual, 'cartao do cabecalho vigente ausente');
  assert.match(primeiraLinha(atual.title), /regua  2\/3 - atual$/);
  assert.equal(params.initial, params.choices.findIndex((c) => c.value === 'regua'));
  assert.ok(params.choices.every((c) => c.title.split('\n').length > 1));
  assert.deepEqual(state.setHeaderStyleCalls, ['compacto']);
  assert.equal(state.selectFerramentaParams.length, 1);
  assert.match(textoSaida(state), /- o que foi aplicado antes desta etapa foi mantido/);
});

test('com cor ativa todo title de cartao abre desligando o sublinhado do prompts', async () => {
  const forcaAnterior = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = '3';
  try {
    const { deps, state } = fazerDeps({
      isTTY: true,
      escolha: 'coluna',
      escolhaCabecalho: 'painel',
      escolhaFerramenta: 'claudecode',
    });
    await runConfig(undefined, undefined, deps);
    const titles = [
      ...state.selectParams[0].choices.map((c) => c.title),
      ...state.selectHeaderParams[0].choices.map((c) => c.title),
      ...state.selectFerramentaParams[0].choices.map((c) => c.title),
    ];
    assert.ok(titles.length >= 12, 'cartoes ausentes');
    for (const title of titles) {
      assert.ok(title.startsWith(SEM_SUBLINHADO), 'title sem o prefixo que desliga o sublinhado');
    }
  } finally {
    if (forcaAnterior === undefined) {
      delete process.env.FORCE_COLOR;
    } else {
      process.env.FORCE_COLOR = forcaAnterior;
    }
  }
});

test('sem cor nenhum title de cartao carrega escape ANSI', async () => {
  const semCorAnterior = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  try {
    const { deps, state } = fazerDeps({
      isTTY: true,
      escolha: 'coluna',
      escolhaCabecalho: 'painel',
      escolhaFerramenta: 'claudecode',
    });
    await runConfig(undefined, undefined, deps);
    const titles = [
      ...state.selectParams[0].choices.map((c) => c.title),
      ...state.selectHeaderParams[0].choices.map((c) => c.title),
      ...state.selectFerramentaParams[0].choices.map((c) => c.title),
    ];
    for (const title of titles) {
      assert.ok(!ANSI.test(title), 'title carregando escape sem cor ativa');
    }
  } finally {
    if (semCorAnterior === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = semCorAnterior;
    }
  }
});

test('o hint nomeia o eixo de setas e degrada para palavras em glifo ASCII', async () => {
  const glyphsAnterior = process.env.SPECIFICA_GLYPHS;
  process.env.SPECIFICA_GLYPHS = 'full';
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'coluna',
    escolhaCabecalho: 'painel',
    escolhaFerramenta: 'claudecode',
  });
  try {
    await runConfig(undefined, undefined, deps);
  } finally {
    process.env.SPECIFICA_GLYPHS = glyphsAnterior ?? 'ascii';
  }
  assert.equal(state.selectParams[0].hint, HINT_UNICODE);
  assert.equal(state.selectHeaderParams[0].hint, HINT_UNICODE);
  assert.equal(state.selectFerramentaParams[0].hint, HINT_UNICODE);

  const { deps: depsAscii, state: stateAscii } = fazerDeps({ isTTY: true, escolha: undefined });
  await runConfig(undefined, undefined, depsAscii);
  assert.equal(stateAscii.selectParams[0].hint, HINT);
});

test('config layout <nome> grava sem interacao', async () => {
  const { deps, state } = fazerDeps({ isTTY: true });
  const code = await runConfig('layout', 'moldura', deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setLayoutCalls, ['moldura']);
  assert.equal(state.selectParams.length, 0);
});

test('config ferramenta <slug> grava a ferramenta do projeto corrente sem interacao', async () => {
  const { deps, state } = fazerDeps({ projeto: 'meu-repo', isTTY: true });
  const code = await runConfig('ferramenta', 'claudecode', deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setToolCalls, [{ projeto: 'meu-repo', slug: 'claudecode' }]);
  assert.equal(state.selectParams.length, 0);
});

test('config ferramenta nao altera o registro dos demais projetos', async () => {
  const { deps, state } = fazerDeps({
    projeto: 'projeto-a',
    arquivo: {
      version: 1,
      layout: 'coluna',
      projetos: { 'projeto-b': { ferramenta: 'cursor', atualizadoEm: 'x' } },
    },
  });
  await runConfig('ferramenta', 'claudecode', deps);
  assert.deepEqual(state.setToolCalls, [{ projeto: 'projeto-a', slug: 'claudecode' }]);
  const arquivo = state.arquivo as FakeConfig;
  assert.equal(arquivo.projetos?.['projeto-b'].ferramenta, 'cursor');
});

test('o layout gravado vale para qualquer projeto', async () => {
  const { deps, state } = fazerDeps({ projeto: 'projeto-a' });
  await runConfig('layout', 'lote', deps);
  const { deps: deps2, state: state2 } = fazerDeps({
    projeto: 'projeto-b',
    arquivo: state.arquivo as FakeConfig,
  });
  await runConfig(undefined, undefined, deps2);
  assert.match(textoSaida(state2), /Layout\s+lote/);
});

test('valor invalido produz codigo de saida 1', async () => {
  const { deps, state } = fazerDeps();
  assert.equal(await runConfig('layout', 'grade', deps), 1);
  assert.equal(await runConfig('ferramenta', 'copilot', deps), 1);
  assert.equal(await runConfig('chaveerrada', 'x', deps), 1);
  assert.ok(state.erros.join('').includes('[ERRO]'));
});

test('chave sem valor na forma nao interativa produz codigo 1', async () => {
  const { deps } = fazerDeps({ isTTY: true });
  assert.equal(await runConfig('layout', undefined, deps), 1);
  assert.equal(await runConfig('ferramenta', undefined, deps), 1);
});

test('cancelar a primeira etapa nao grava nada, nao abre as seguintes e encerra com 0 sem aviso', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setLayoutCalls, []);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.equal(state.selectFerramentaParams.length, 0);
  assert.ok(!textoSaida(state).includes('[AVISO]'), 'aviso sem nenhuma gravacao');
});

test('o layout atual e marcado pelo indice correto em initial', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, arquivo: { version: 1, layout: 'lote', projetos: {} } });
  await runConfig(undefined, undefined, deps);
  const params = state.selectParams[0];
  assert.equal(params.initial, params.choices.findIndex((c) => c.value === 'lote'));
  assert.equal(params.initial, 3);
});

test('configuracao global invalida produz codigo 1 sem sobrescrever o arquivo', async () => {
  const original = new Error('~/.specifica-br/config.json invalido. Corrija ou remova o arquivo.');
  const { deps, state } = fazerDeps({ arquivo: original });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 1);
  assert.deepEqual(state.setLayoutCalls, []);
  assert.deepEqual(state.setToolCalls, []);
  assert.ok(state.erros.join('').includes('invalido'));
});

test('a saida do config exibe as cinco linhas Arquivo, Layout, Cabecalho, Projeto e Ferramenta', async () => {
  const { deps, state } = fazerDeps({ projeto: 'projeto-x' });
  await runConfig(undefined, undefined, deps);
  const texto = textoSaida(state);
  assert.match(texto, /Arquivo\s+/);
  assert.match(texto, /Layout\s+coluna/);
  assert.match(texto, /Cabecalho\s+painel/);
  assert.match(texto, /Projeto\s+projeto-x/);
  assert.match(texto, /Ferramenta\s+/);
});

test('a saida exibe explicitamente a ausencia de ferramenta registrada e ensina o caminho curto', async () => {
  const { deps, state } = fazerDeps();
  await runConfig(undefined, undefined, deps);
  assert.match(
    textoSaida(state),
    /Ferramenta\s+nao registrada \(defina no fluxo interativo ou rode: config ferramenta <slug>\)/,
  );
});

test('a pre-visualizacao nao emite sequencia ANSI com painter de nivel NONE', () => {
  const linhas = buildPreview('moldura', {
    painter: createPainter(LEVEL.NONE),
    glyphLevel: GLYPH.ASCII,
    largura: 72,
    cabecalho: 'painel',
  });
  assert.ok(linhas.length > 0);
  assert.doesNotMatch(linhas.join('\n'), /\x1b\[/);
});

test('a pre-visualizacao emite apenas ASCII com glyphLevel ASCII', () => {
  for (const nome of ['coluna', 'moldura', 'regua', 'lote'] as LayoutName[]) {
    const linhas = buildPreview(nome, {
      painter: createPainter(LEVEL.NONE),
      glyphLevel: GLYPH.ASCII,
      largura: 72,
      cabecalho: 'painel',
    });
    assert.doesNotMatch(linhas.join(''), /[^\x20-\x7E]/);
  }
});

test('config nao cria nem altera nenhum arquivo dentro do projeto', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: 'moldura', escolhaCabecalho: undefined });
  await runConfig(undefined, undefined, deps);
  await runConfig('ferramenta', 'kiro', deps);
  assert.equal(state.setLayoutCalls.length, 1);
  assert.equal(state.setToolCalls.length, 1);
});

test('validateChave aceita a chave cabecalho ao lado de layout e ferramenta', () => {
  assert.equal(validateChave('cabecalho'), 'cabecalho');
});

test('validateCabecalhoValor aceita as tres formas e nomeia chave, valor e aceitos', () => {
  for (const estilo of ['painel', 'regua', 'compacto']) {
    assert.equal(validateCabecalhoValor(estilo), estilo);
  }
  assert.throws(
    () => validateCabecalhoValor('xpto'),
    /cabecalho: xpto\. Valores aceitos: painel, regua, compacto\./
  );
});

test('config cabecalho <valor> grava o estilo sem interacao e encerra com 0', async () => {
  const { deps, state } = fazerDeps({ isTTY: true });
  const code = await runConfig('cabecalho', 'regua', deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setHeaderStyleCalls, ['regua']);
  assert.equal(state.selectParams.length, 0);
  assert.equal(state.selectHeaderParams.length, 0);
});

test('a saida do config exibe a linha Cabecalho entre Layout e Projeto', async () => {
  const { deps, state } = fazerDeps({
    projeto: 'projeto-x',
    arquivo: { version: 1, layout: 'coluna', cabecalho: 'compacto', projetos: {} },
  });
  await runConfig(undefined, undefined, deps);
  const linhas = textoSaida(state).split('\n');
  const indice = (rotulo: string): number => linhas.findIndex((l) => l.includes(rotulo));
  assert.match(textoSaida(state), /Cabecalho\s+compacto/);
  assert.ok(indice('Layout') < indice('Cabecalho'));
  assert.ok(indice('Cabecalho') < indice('Projeto'));
});

test('config cabecalho <invalido> emite [ERRO] com chave, valor e aceitos, e encerra com 1', async () => {
  const { deps, state } = fazerDeps({ isTTY: true });
  const code = await runConfig('cabecalho', 'xpto', deps);
  assert.equal(code, 1);
  assert.deepEqual(state.setHeaderStyleCalls, []);
  const erro = state.erros.join('');
  assert.ok(erro.includes('[ERRO]'), erro);
  assert.match(erro, /cabecalho/);
  assert.match(erro, /xpto/);
  assert.match(erro, /painel, regua, compacto/);
});

test('config cabecalho sem valor produz codigo 1', async () => {
  const { deps, state } = fazerDeps({ isTTY: true });
  assert.equal(await runConfig('cabecalho', undefined, deps), 1);
  assert.deepEqual(state.setHeaderStyleCalls, []);
});

test('cancelar a segunda selecao preserva o layout escolhido, nao abre a etapa de ferramenta e avisa', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'moldura',
    escolhaCabecalho: undefined,
    arquivo: { version: 1, layout: 'coluna', cabecalho: 'painel', projetos: {} },
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setLayoutCalls, ['moldura']);
  assert.deepEqual(state.setHeaderStyleCalls, []);
  assert.equal(state.selectFerramentaParams.length, 0);
  const arquivo = state.arquivo as FakeConfig;
  assert.equal(arquivo.layout, 'moldura');
  assert.equal(arquivo.cabecalho, 'painel');
  assert.match(textoSaida(state), /\[AVISO\] configuracao encerrada - o que foi aplicado antes desta etapa foi mantido/);
});

test('cancelar a primeira selecao nao abre a segunda e encerra com 0', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined });
  assert.equal(await runConfig(undefined, undefined, deps), 0);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.deepEqual(state.setHeaderStyleCalls, []);
});

test('sem TTY nenhuma das tres selecoes e aberta e o codigo de saida e 0', async () => {
  const { deps, state } = fazerDeps({
    isTTY: false,
    escolha: 'lote',
    escolhaCabecalho: 'regua',
    escolhaFerramenta: 'opencode',
  });
  assert.equal(await runConfig(undefined, undefined, deps), 0);
  assert.equal(state.selectParams.length, 0);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.equal(state.selectFerramentaParams.length, 0);
  assert.deepEqual(state.setLayoutCalls, []);
  assert.deepEqual(state.setHeaderStyleCalls, []);
  assert.deepEqual(state.setToolCalls, []);
});

test('a terceira etapa oferece as cinco ferramentas com contador, avisos de contrato e initial da registrada', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'coluna',
    escolhaCabecalho: 'painel',
    escolhaFerramenta: undefined,
    projeto: 'projeto-x',
    arquivo: {
      version: 1,
      layout: 'coluna',
      cabecalho: 'painel',
      projetos: { 'projeto-x': { ferramenta: 'opencode', atualizadoEm: 'x' } },
    },
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);

  assert.equal(state.selectFerramentaParams.length, 1);
  const params = state.selectFerramentaParams[0];
  assert.equal(params.choices.length, 5);
  assert.equal(params.optionsPerPage, 5);
  assert.equal(params.hint, HINT);
  assert.equal(params.warn, 'contrato de execucao ainda nao validado nesta versao');

  const valores = params.choices.map((c) => c.value);
  assert.deepEqual(valores, ['claudecode', 'opencode', 'cursor', 'gemini-cli', 'kiro']);
  assert.deepEqual(
    params.choices.map((c) => c.disabled === true),
    [false, false, true, true, true],
  );
  assert.match(primeiraLinha(params.choices[0].title), /ClaudeCode \(claude\)   1\/5$/);
  assert.match(primeiraLinha(params.choices[1].title), /OpenCode \(opencode\)   2\/5 - atual$/);
  assert.match(primeiraLinha(params.choices[2].title), /Cursor \(cursor\)   3\/5 - contrato nao validado$/);
  for (const [indice, escolha] of params.choices.entries()) {
    assert.match(primeiraLinha(escolha.title), new RegExp(` ${indice + 1}/5`));
  }
  assert.equal(params.initial, 1);
  assert.deepEqual(state.setToolCalls, []);
  assert.match(textoSaida(state), /\[AVISO\] configuracao encerrada - o que foi aplicado antes desta etapa foi mantido/);
});

test('sem ferramenta registrada o cartao inicial e o primeiro', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'coluna',
    escolhaCabecalho: 'painel',
    escolhaFerramenta: undefined,
  });
  await runConfig(undefined, undefined, deps);
  assert.equal(state.selectFerramentaParams[0].initial, 0);
});

test('confirmar a ferramenta grava no projeto corrente com [OK] nominal e encerra com 0 sem aviso', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'coluna',
    escolhaCabecalho: 'painel',
    escolhaFerramenta: 'claudecode',
    projeto: 'meu-repo',
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setToolCalls, [{ projeto: 'meu-repo', slug: 'claudecode' }]);
  const saida = textoSaida(state);
  assert.match(saida, /\[OK\]\s+ferramenta do projeto meu-repo definida como claudecode/);
  assert.ok(!saida.includes('[AVISO]'), 'aviso de encerramento com fluxo completo');
});

test('confirmar slug de contrato nao validado nao grava e emite o aviso nominal do registry', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'coluna',
    escolhaCabecalho: 'painel',
    escolhaFerramenta: 'cursor',
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setToolCalls, []);
  assert.match(
    textoSaida(state),
    /\[AVISO\] contrato de execucao de Cursor ainda nao validado nesta versao\. Disponiveis: ClaudeCode, OpenCode/,
  );
});

test('cancelar a terceira etapa mantem layout e cabecalho gravados e encerra com 0', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'moldura',
    escolhaCabecalho: 'compacto',
    escolhaFerramenta: undefined,
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setLayoutCalls, ['moldura']);
  assert.deepEqual(state.setHeaderStyleCalls, ['compacto']);
  assert.deepEqual(state.setToolCalls, []);
  assert.match(textoSaida(state), /\[AVISO\] configuracao encerrada - o que foi aplicado antes desta etapa foi mantido/);
});

test('a largura da previa segue a porta colunas com piso 60 e teto 100', async () => {
  const arquivo: FakeConfig = { version: 1, layout: 'coluna', cabecalho: 'regua', projetos: {} };

  const largura = async (colunas?: number): Promise<number> => {
    const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined, colunas, arquivo: JSON.parse(JSON.stringify(arquivo)) });
    await runConfig(undefined, undefined, deps);
    return maiorLarguraVisivel(state.selectParams[0].choices.map((c) => c.title));
  };

  assert.equal(await largura(120), 100);
  assert.equal(await largura(70), 70);
  assert.equal(await largura(undefined), 80);
});

test('nenhuma linha de previa excede a largura informada, nos extremos de 60 e 100', async () => {
  for (const colunas of [60, 100]) {
    const { deps, state } = fazerDeps({
      isTTY: true,
      escolha: 'coluna',
      escolhaCabecalho: undefined,
      colunas,
    });
    await runConfig(undefined, undefined, deps);
    for (const params of [state.selectParams[0], state.selectHeaderParams[0]]) {
      const larguras = params.choices.flatMap((c) => c.title.split('\n').map(visibleWidth));
      assert.ok(larguras.every((l) => l <= colunas), `linha acima de ${colunas}: ${Math.max(...larguras)}`);
    }
  }
});

test('o bloco vigente mantem sete linhas, rotulos e ordem, com alinhamento igual com e sem cor', async () => {
  const esperados: Array<[string, string]> = [
    ['Arquivo', '~'],
    ['Layout', 'coluna'],
    ['Cabecalho', 'painel'],
    ['Projeto', 'projeto-x'],
    ['Ferramenta', 'nao registrada'],
  ];

  const linhasDoBloco = async (forcarCor: boolean): Promise<string[]> => {
    const anterior = process.env.FORCE_COLOR;
    if (forcarCor) {
      process.env.FORCE_COLOR = '3';
    }
    try {
      const { deps, state } = fazerDeps({ projeto: 'projeto-x' });
      await runConfig(undefined, undefined, deps);
      return textoSaida(state).split('\n').slice(0, 7);
    } finally {
      if (anterior === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = anterior;
      }
    }
  };

  const semCor = await linhasDoBloco(false);
  const comCor = (await linhasDoBloco(true)).map((l) => l.replace(ANSI, ''));

  for (const bloco of [semCor, comCor]) {
    assert.match(bloco[0], /specifica-br\s+config/);
    assert.equal(bloco[1], '');
    for (const [i, [rotulo, valor]] of esperados.entries()) {
      const linha = bloco[i + 2];
      assert.ok(linha.startsWith(`  ${rotulo}`), `${rotulo} fora de posicao: ${linha}`);
      assert.equal(linha.slice(15, 17), '  ', `${rotulo} sem a calha: ${linha}`);
      assert.match(linha.slice(17), /^\S/, `${rotulo} desalinhado: ${linha}`);
    }
  }
});
