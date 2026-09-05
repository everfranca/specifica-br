import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderCabecalho,
  cabecalhoPainel,
  cabecalhoRegua,
  cabecalhoCompacto,
  gruposDeAbertura,
  GRUPOS,
} from '../dist/utils/cabecalho/index.js';
import type { ContextoDeCabecalho } from '../dist/utils/cabecalho/index.js';
import { createPainter, LEVEL, GLYPH, visibleWidth } from '../dist/utils/terminal/index.js';
import type { GlyphLevel } from '../dist/utils/terminal/index.js';
import type { HeaderStyle } from '../dist/types/config.js';
import type { DadosDeAbertura } from '../dist/types/executar-tasks.js';

const ESTILOS: HeaderStyle[] = ['painel', 'regua', 'compacto'];

const DADOS: DadosDeAbertura = {
  feature: 'specs/features/melhorias-visuais-executar-tasks',
  tasksSelecionadas: 4,
  tasksTotal: 12,
  criterioDeSelecao: '1-3,7',
  ferramenta: 'claudecode',
  executavel: 'claude',
  versao: '2.1.0',
  model: 'opus',
  effort: 'high',
  fallbackModel: 'nenhum',
  permissoes: 'ACESSO TOTAL (bypassPermissions)',
  contextoLigado: true,
  contextoSimulado: false,
  contextoTeto: '8.000 tokens',
  contextoInjecao: 'prompt',
  cacheTuning: true,
  dirsExtras: ['~/.claude/skills', '.claude/skills'],
  tetoCustoPorTask: '$0',
  tetoJanela: '900.000 tokens',
  tetoEspera: '6h',
  registroPath: '~/.specifica-br/logs/specifica-br/run_20260904_140500.jsonl',
};

interface CtxOpts {
  largura?: number;
  glyphLevel?: GlyphLevel;
  cor?: boolean;
}

function fazerCtx(opts: CtxOpts = {}): ContextoDeCabecalho {
  return {
    painter: createPainter(opts.cor ? LEVEL.TRUECOLOR : LEVEL.NONE),
    glyphLevel: opts.glyphLevel ?? GLYPH.UNICODE_BOX,
    largura: opts.largura ?? 80,
  };
}

const ANSI = /\x1b\[[0-9;]*m/g;

function semCor(linhas: string[]): string {
  return linhas.join('\n').replace(ANSI, '');
}

/**
 * Cada dado de `DadosDeAbertura` na forma em que as tres formas o apresentam.
 * E a lista literal de RF-005: se um item some da saida, a forma deixou de
 * exibir um dado que deveria exibir.
 */
const DADOS_ESPERADOS: Array<[string, string]> = [
  ['funcionalidade alvo', DADOS.feature],
  ['tasks selecionadas', '4'],
  ['total de tasks', '12'],
  ['criterio de selecao', '1-3,7'],
  ['ferramenta', 'claudecode'],
  ['executavel', 'claude'],
  ['versao', '2.1.0'],
  ['modelo', 'opus'],
  ['esforco', 'high'],
  ['fallback', 'nenhum'],
  ['permissoes', 'ACESSO TOTAL (bypassPermissions)'],
  ['estado do contexto', 'on'],
  ['teto do contexto', '8.000 tokens'],
  ['injecao', 'prompt'],
  ['cache', 'cache'],
  ['dirs extras', '~/.claude/skills .claude/skills'],
  ['teto de custo por task', '$0'],
  ['teto da janela', '900.000 tokens'],
  ['teto de espera', '6h'],
  ['registro', DADOS.registroPath],
];

// (i) Cada dado da lista de RF-005 esta presente nas tres formas.
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: exibe todos os dados de DadosDeAbertura`, () => {
    const saida = semCor(renderCabecalho(estilo, DADOS, fazerCtx()));
    for (const [nome, trecho] of DADOS_ESPERADOS) {
      assert.ok(
        saida.toLowerCase().includes(trecho.toLowerCase()),
        `${estilo} nao exibe ${nome} (${trecho})`,
      );
    }
  });
}

// (iii) Os cinco grupos fixos aparecem nas tres formas.
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: apresenta os cinco grupos fixos`, () => {
    const saida = semCor(renderCabecalho(estilo, DADOS, fazerCtx()));
    for (const grupo of GRUPOS) {
      assert.ok(saida.includes(grupo), `${estilo} nao apresenta o grupo ${grupo}`);
    }
  });
}

// (ii) Nenhuma forma exibe rotulo ou valor fora da lista de RF-005.
test('nenhuma forma acrescenta dado fora de DadosDeAbertura', () => {
  const valores = new Set<string>([
    DADOS.feature,
    '4',
    '12',
    '1-3,7',
    DADOS.ferramenta,
    DADOS.executavel,
    DADOS.versao,
    DADOS.model,
    DADOS.effort,
    DADOS.fallbackModel,
    ...DADOS.permissoes.split(/\s+/),
    'on',
    ...DADOS.contextoTeto.split(/\s+/),
    String(DADOS.contextoInjecao),
    ...DADOS.dirsExtras,
    DADOS.tetoCustoPorTask,
    ...DADOS.tetoJanela.split(/\s+/),
    DADOS.tetoEspera,
    DADOS.registroPath,
  ]);
  // Rotulos e conectivos estruturais: nao sao dado, sao a forma.
  const estrutura = new Set<string>([
    ...GRUPOS,
    'feature',
    'tasks',
    'ferramenta',
    'modelo',
    'permissoes',
    'permissao',
    'contexto',
    'cache',
    'dirs',
    'extras',
    'orcamentos',
    'espera',
    'arquivo',
    'de',
    'selecionadas',
    'esforco:',
    'fallback:',
    'teto:',
    'injecao:',
    'cache:',
    'espera:',
    'ate',
    'por',
    'renovacao',
    'da',
    'cota',
  ]);

  for (const estilo of ESTILOS) {
    const bruto = semCor(renderCabecalho(estilo, DADOS, fazerCtx()));
    // Retira a moldura e a regua antes de olhar as palavras.
    const palavras = bruto
      .replace(/[─-╿+|]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const palavra of palavras) {
      const limpa = palavra.replace(/[()]/g, '');
      const conhecida =
        estrutura.has(palavra.toLowerCase()) ||
        estrutura.has(limpa.toLowerCase()) ||
        valores.has(palavra) ||
        valores.has(limpa) ||
        [...valores].some((v) => v.includes(palavra) || palavra.includes(v));
      assert.ok(conhecida, `${estilo} exibe token fora da lista de RF-005: "${palavra}"`);
    }
  }
});

// As tres formas expostas individualmente (CT-041), insumo da previa de `config`.
test('as tres formas sao exportadas individualmente com a mesma assinatura', () => {
  const contexto = fazerCtx();
  for (const forma of [cabecalhoPainel, cabecalhoRegua, cabecalhoCompacto]) {
    const linhas = forma(DADOS, contexto);
    assert.ok(Array.isArray(linhas) && linhas.length > 0);
  }
  assert.deepEqual(cabecalhoPainel(DADOS, contexto), renderCabecalho('painel', DADOS, contexto));
  assert.deepEqual(cabecalhoRegua(DADOS, contexto), renderCabecalho('regua', DADOS, contexto));
  assert.deepEqual(
    cabecalhoCompacto(DADOS, contexto),
    renderCabecalho('compacto', DADOS, contexto),
  );
});

test('gruposDeAbertura devolve os cinco grupos na ordem fixa', () => {
  assert.deepEqual(
    gruposDeAbertura(DADOS).map((g) => g.titulo),
    [...GRUPOS],
  );
});

// Nenhuma linha excede a largura util, em nenhuma das tres formas.
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: nenhuma linha excede a largura util`, () => {
    for (const largura of [60, 80, 100, 140]) {
      const linhas = renderCabecalho(estilo, DADOS, fazerCtx({ largura }));
      const teto = Math.min(largura, 100);
      for (const linha of linhas) {
        assert.ok(
          visibleWidth(linha) <= teto,
          `${estilo} em ${largura} colunas produziu linha de ${visibleWidth(linha)}`,
        );
      }
    }
  });
}

// (iv) RF-006: abaixo de 60 colunas as tres formas convergem para uma unica
// forma degradada, e nenhuma linha ultrapassa a largura do terminal.
test('abaixo de 60 colunas as tres formas produzem saida identica', () => {
  const contexto = fazerCtx({ largura: 50 });
  const painel = renderCabecalho('painel', DADOS, contexto);
  const regua = renderCabecalho('regua', DADOS, contexto);
  const compacto = renderCabecalho('compacto', DADOS, contexto);
  assert.deepEqual(regua, painel);
  assert.deepEqual(compacto, painel);
});

test('a forma degradada trunca em largura - 1 e nao excede a largura', () => {
  for (const largura of [30, 40, 50, 59]) {
    const linhas = renderCabecalho('painel', DADOS, fazerCtx({ largura }));
    for (const linha of linhas) {
      assert.ok(
        visibleWidth(linha) <= largura - 1,
        `linha de ${visibleWidth(linha)} colunas em terminal de ${largura}`,
      );
    }
    assert.ok(linhas.some((l) => l.includes('...')), 'nenhuma linha foi truncada');
  }
});

test('a forma degradada nao usa moldura nem regua', () => {
  const saida = semCor(renderCabecalho('regua', DADOS, fazerCtx({ largura: 50 })));
  for (const glifo of ['─', '│', '╭', '╰', '+', '|']) {
    assert.ok(!saida.includes(glifo), `forma degradada contem o glifo ${glifo}`);
  }
});

test('a forma degradada exibe uma linha por dado, sem omitir nenhum', () => {
  const linhas = renderCabecalho('painel', DADOS, fazerCtx({ largura: 50 }));
  const total = gruposDeAbertura(DADOS).reduce((soma, g) => soma + g.linhas.length, 0);
  assert.equal(linhas.length, total);
});

// (v) CT-042: estilo fora das tres formas cai para `painel`, em silencio.
test('estilo desconhecido cai para painel, sem mensagem', () => {
  const contexto = fazerCtx();
  const painel = renderCabecalho('painel', DADOS, contexto);
  for (const invalido of ['', 'PAINEL', 'moldura', 'lote', 'coluna']) {
    assert.deepEqual(
      renderCabecalho(invalido as HeaderStyle, DADOS, contexto),
      painel,
      `estilo "${invalido}" nao caiu para painel`,
    );
  }
});

test('renderCabecalho nao lanca em nenhum caminho', () => {
  const contexto = fazerCtx();
  assert.doesNotThrow(() => renderCabecalho('lote' as HeaderStyle, DADOS, contexto));
  assert.doesNotThrow(() =>
    renderCabecalho('painel', DADOS, fazerCtx({ largura: 1 })),
  );
});

// (vi) `contextoInjecao === null` omite APENAS a linha de injecao (CT-030).
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: contextoInjecao null omite apenas a injecao`, () => {
    const contexto = fazerCtx();
    const comEscolha = renderCabecalho(estilo, DADOS, contexto);
    const semEscolha = renderCabecalho(
      estilo,
      { ...DADOS, contextoInjecao: null },
      contexto,
    );
    assert.ok(!semCor(semEscolha).includes('injecao'), 'a injecao foi anunciada');
    assert.equal(semEscolha.length, comEscolha.length, 'linha inteira foi suprimida');
    for (const [nome, trecho] of DADOS_ESPERADOS) {
      if (nome === 'injecao') continue;
      assert.ok(
        semCor(semEscolha).toLowerCase().includes(trecho.toLowerCase()),
        `${estilo} deixou de exibir ${nome} ao omitir a injecao`,
      );
    }
  });
}

// (vii) Com `--dry-run`, a linha de contexto anuncia a simulacao.
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: com --dry-run a linha de contexto anuncia a simulacao`, () => {
    const saida = semCor(
      renderCabecalho(estilo, { ...DADOS, contextoSimulado: true }, fazerCtx({ largura: 140 })),
    );
    assert.ok(
      saida.includes('on (--dry-run: nao sera construido nem injetado)'),
      `${estilo} nao anuncia a simulacao`,
    );
    assert.ok(saida.includes('8.000 tokens'), 'o teto sumiu sob simulacao');
    assert.ok(saida.includes('prompt'), 'a injecao sumiu sob simulacao');
  });
}

// Valor ausente sai como marcador, nunca como linha omitida.
for (const estilo of ESTILOS) {
  test(`forma ${estilo}: dado ausente vira marcador, nunca linha omitida`, () => {
    const contexto = fazerCtx();
    const cheio = renderCabecalho(estilo, DADOS, contexto);
    const vazio = renderCabecalho(
      estilo,
      {
        ...DADOS,
        contextoLigado: false,
        cacheTuning: false,
        contextoTeto: 'sem teto',
        dirsExtras: [],
        tetoJanela: 'sem teto',
        tetoEspera: 'desligada',
      },
      contexto,
    );
    assert.equal(vazio.length, cheio.length, 'uma linha foi omitida');
    const saida = semCor(vazio);
    for (const marcador of ['off', 'nenhum', 'sem teto', 'desligada']) {
      assert.ok(saida.includes(marcador), `marcador "${marcador}" ausente`);
    }
  });
}

// (viii) RNF-001: toda hierarquia sobrevive a NO_COLOR.
test('sob NO_COLOR os cinco grupos continuam identificaveis nas tres formas', () => {
  for (const estilo of ESTILOS) {
    const linhas = renderCabecalho(estilo, DADOS, fazerCtx({ cor: false }));
    const bruto = linhas.join('\n');
    assert.ok(!ANSI.test(bruto), `${estilo} emitiu ANSI com o pintor sem cor`);
    ANSI.lastIndex = 0;
    for (const grupo of GRUPOS) {
      assert.ok(bruto.includes(grupo), `${estilo} perdeu o grupo ${grupo} sem cor`);
    }
  }
});

test('com cor, a saida sem marcacao e identica a saida sem cor', () => {
  for (const estilo of ESTILOS) {
    assert.equal(
      semCor(renderCabecalho(estilo, DADOS, fazerCtx({ cor: true }))),
      semCor(renderCabecalho(estilo, DADOS, fazerCtx({ cor: false }))),
      `${estilo}: a cor alterou o texto`,
    );
  }
});

// PRD secao 5: terminal sem glifo degrada moldura e regua para `+ - |`.
test('sem glifo Unicode a moldura e a regua degradam para + - |', () => {
  const contexto = fazerCtx({ glyphLevel: GLYPH.ASCII });
  for (const estilo of ESTILOS) {
    const saida = semCor(renderCabecalho(estilo, DADOS, contexto));
    for (const glifo of ['─', '│', '╭', '╮', '╰', '╯']) {
      assert.ok(!saida.includes(glifo), `${estilo} manteve o glifo Unicode ${glifo}`);
    }
    assert.ok(/^[\x20-\x7E\n]*$/.test(saida), `${estilo} emitiu caractere fora do ASCII`);
  }
  assert.ok(semCor(renderCabecalho('painel', DADOS, contexto)).includes('+-alvo'));
  assert.ok(semCor(renderCabecalho('regua', DADOS, contexto)).includes('alvo ---'));
});
