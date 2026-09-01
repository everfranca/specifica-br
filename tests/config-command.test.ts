import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runConfig,
  type ConfigDeps,
  type SelectLayoutParams,
} from '../dist/commands/config.js';
import {
  validateChave,
  validateLayoutValor,
  validateFerramentaValor,
} from '../dist/utils/config-command-validation.js';
import { buildPreview } from '../dist/utils/layout-preview.js';
import { createPainter, LEVEL, GLYPH } from '../dist/utils/terminal/index.js';
import type { LayoutName, ToolSlug } from '../dist/types/config.js';

interface FakeConfig {
  version: number;
  layout?: LayoutName;
  projetos?: Record<string, { ferramenta: ToolSlug; atualizadoEm: string }>;
}

interface FakeState {
  arquivo: FakeConfig | Error;
  setLayoutCalls: LayoutName[];
  setToolCalls: Array<{ projeto: string; slug: ToolSlug }>;
  saida: string[];
  erros: string[];
  selectParams: SelectLayoutParams[];
}

interface DepsOpts {
  arquivo?: FakeConfig | Error;
  projeto?: string;
  isTTY?: boolean;
  escolha?: LayoutName | undefined;
}

function fazerDeps(opts: DepsOpts = {}): { deps: ConfigDeps; state: FakeState } {
  const state: FakeState = {
    arquivo: opts.arquivo ?? { version: 1, layout: 'coluna', projetos: {} },
    setLayoutCalls: [],
    setToolCalls: [],
    saida: [],
    erros: [],
    selectParams: [],
  };

  const configService = {
    configPath: '/home/tester/.specifica-br/config.json',
    async load(): Promise<FakeConfig> {
      if (state.arquivo instanceof Error) {
        throw state.arquivo;
      }
      return JSON.parse(JSON.stringify(state.arquivo)) as FakeConfig;
    },
    async setLayout(layout: LayoutName): Promise<void> {
      state.setLayoutCalls.push(layout);
      if (!(state.arquivo instanceof Error)) {
        state.arquivo.layout = layout;
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
  assert.ok(state.erros.join('').includes('[ ERRO]'));
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
    });
    assert.doesNotMatch(linhas.join(''), /[^\x20-\x7E]/);
  }
});

test('config nao cria nem altera nenhum arquivo dentro do projeto', async () => {
  const { deps, state } = fazerDeps({ isTTY: true, escolha: 'moldura' });
  await runConfig(undefined, undefined, deps);
  await runConfig('ferramenta', 'kiro', deps);
  assert.equal(state.setLayoutCalls.length, 1);
  assert.equal(state.setToolCalls.length, 1);
});
