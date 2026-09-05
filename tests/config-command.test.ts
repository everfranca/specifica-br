import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runConfig,
  type ConfigDeps,
  type SelectLayoutParams,
  type SelectHeaderStyleParams,
} from '../dist/commands/config.js';
import {
  validateChave,
  validateLayoutValor,
  validateCabecalhoValor,
  validateFerramentaValor,
} from '../dist/utils/config-command-validation.js';
import { buildPreview } from '../dist/utils/layout-preview.js';
import { createPainter, LEVEL, GLYPH } from '../dist/utils/terminal/index.js';
import type { HeaderStyle, LayoutName, ToolSlug } from '../dist/types/config.js';

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
}

interface DepsOpts {
  arquivo?: FakeConfig | Error;
  projeto?: string;
  isTTY?: boolean;
  escolha?: LayoutName | undefined;
  escolhaCabecalho?: HeaderStyle | undefined;
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
    async selectLayout(params: SelectLayoutParams): Promise<LayoutName | undefined> {
      state.selectParams.push(params);
      return opts.escolha;
    },
    async selectHeaderStyle(params: SelectHeaderStyleParams): Promise<HeaderStyle | undefined> {
      state.selectHeaderParams.push(params);
      return opts.escolhaCabecalho;
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

test('config sem argumentos e sem TTY exibe a vigente e encerra com codigo 0, sem abrir a selecao', async () => {
  const { deps, state } = fazerDeps({ isTTY: false });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.equal(state.selectParams.length, 0);
  assert.match(textoSaida(state), /Layout\s+coluna/);
});

test('config sem argumentos e com TTY apresenta os quatro layouts pre-visualizados, marcando o atual', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined, arquivo: { version: 1, layout: 'regua', projetos: {} } });
  await runConfig(undefined, undefined, deps);
  assert.equal(state.selectParams.length, 1);
  const params = state.selectParams[0];
  assert.equal(params.choices.length, 4);
  const atual = params.choices.find((c) => c.value === 'regua');
  assert.ok(atual && atual.title.includes('(atual)'));
  assert.ok(params.choices.every((c) => c.title.split('\n').length > 1));
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

test('selecao cancelada pelo usuario nao grava nada e encerra com 0', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.setLayoutCalls, []);
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

test('a saida do config exibe as quatro linhas Arquivo, Layout, Projeto e Ferramenta', async () => {
  const { deps, state } = fazerDeps({ projeto: 'projeto-x' });
  await runConfig(undefined, undefined, deps);
  const texto = textoSaida(state);
  assert.match(texto, /Arquivo\s+/);
  assert.match(texto, /Layout\s+coluna/);
  assert.match(texto, /Projeto\s+projeto-x/);
  assert.match(texto, /Ferramenta\s+/);
});

test('a saida exibe explicitamente a ausencia de ferramenta registrada', async () => {
  const { deps, state } = fazerDeps();
  await runConfig(undefined, undefined, deps);
  assert.match(textoSaida(state), /Ferramenta\s+nao registrada/);
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

test('config com TTY abre a selecao de cabecalho apos a de layout, marcando o atual', async () => {
  const { deps, state } = fazerDeps({
    isTTY: true,
    escolha: 'moldura',
    escolhaCabecalho: 'compacto',
    arquivo: { version: 1, layout: 'coluna', cabecalho: 'regua', projetos: {} },
  });
  const code = await runConfig(undefined, undefined, deps);
  assert.equal(code, 0);
  assert.equal(state.selectHeaderParams.length, 1);
  const params = state.selectHeaderParams[0];
  assert.equal(params.choices.length, 3);
  const atual = params.choices.find((c) => c.value === 'regua');
  assert.ok(atual && atual.title.includes('(atual)'));
  assert.equal(params.initial, params.choices.findIndex((c) => c.value === 'regua'));
  assert.ok(params.choices.every((c) => c.title.split('\n').length > 1));
  assert.deepEqual(state.setHeaderStyleCalls, ['compacto']);
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

test('cancelar a segunda selecao preserva o layout escolhido na mesma sessao e nao altera o cabecalho', async () => {
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
  const arquivo = state.arquivo as FakeConfig;
  assert.equal(arquivo.layout, 'moldura');
  assert.equal(arquivo.cabecalho, 'painel');
});

test('cancelar a primeira selecao nao abre a segunda e encerra com 0', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: undefined });
  assert.equal(await runConfig(undefined, undefined, deps), 0);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.deepEqual(state.setHeaderStyleCalls, []);
});

test('sem TTY nenhuma das duas selecoes e aberta e o codigo de saida e 0', async () => {
  const { deps, state } = fazerDeps({ isTTY: false, escolha: 'lote', escolhaCabecalho: 'regua' });
  assert.equal(await runConfig(undefined, undefined, deps), 0);
  assert.equal(state.selectParams.length, 0);
  assert.equal(state.selectHeaderParams.length, 0);
  assert.deepEqual(state.setLayoutCalls, []);
  assert.deepEqual(state.setHeaderStyleCalls, []);
});
