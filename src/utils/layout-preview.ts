import type { HeaderStyle, LayoutName } from '../types/config.js';
import type { DadosDeAbertura } from '../types/executar-tasks.js';
import type { Painter, GlyphLevel } from './terminal/index.js';
import { QUADROS_SPINNER, GLYPH, visibleWidth } from './terminal/index.js';
import { renderCabecalho } from './cabecalho/index.js';
import { createLayout } from './layouts/index.js';
import type { LayoutContext } from './layouts/index.js';
import { linhasDoBloco } from './layouts/lote.js';
import type { ItemLote } from './layouts/lote.js';

const ANSI_M = /\x1b\[[0-9;]*m/g;

/**
 * Trunca em `max` colunas visiveis, marcando o corte com `...`. Diferente de
 * `truncar` (que opera sobre texto cru), aceita linhas ja pintadas: as
 * sequencias de escape nao entram na conta das colunas e um corte no meio de
 * um segmento pintado fecha a cor, para nao vazar marcacao para a linha
 * seguinte do cartao. Uso restrito as previas, cujo conteudo de exemplo pode
 * exceder a largura do terminal.
 */
function truncarVisivel(texto: string, max: number): string {
  if (visibleWidth(texto) <= max) {
    return texto;
  }
  const alvo = Math.max(0, max - 3);
  let largura = 0;
  let saida = '';
  let i = 0;
  let abertas = 0;
  while (i < texto.length && largura < alvo) {
    ANSI_M.lastIndex = i;
    const escape = ANSI_M.exec(texto);
    if (escape !== null && escape.index === i) {
      saida += escape[0];
      abertas += escape[0] === '\x1b[0m' ? -1 : 1;
      i += escape[0].length;
      continue;
    }
    saida += texto[i];
    largura += 1;
    i += 1;
  }
  const fechamento = abertas > 0 ? '\x1b[0m' : '';
  return `${saida}${fechamento}...`;
}

/**
 * Ambiente visual da pre-visualizacao. Cor e glifo chegam prontos da camada
 * `terminal/` (task-2); a pre-visualizacao nunca le variavel de ambiente.
 */
export interface PreviewBase {
  painter: Painter;
  glyphLevel: GlyphLevel;
  largura: number;
}

/**
 * Unica fonte de dados de exemplo das duas pre-visualizacoes de `config`
 * (RF-007): a de estilo de cabecalho e a de layout. Os valores sao os do
 * exemplo literal da secao 4.1 da techspec — duplicar esta constante, ou
 * inventar um segundo conjunto para uma das previas, e desvio.
 */
export const DADOS_DE_EXEMPLO: DadosDeAbertura = {
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

/**
 * Ambiente da previa de layout. Alem do ambiente visual, carrega o estilo de
 * cabecalho hoje configurado: a previa de layout mostra o cabecalho ANTES das
 * linhas de task, e o mostra na forma que o usuario ja escolheu (RF-007).
 */
export interface LayoutPreviewBase extends PreviewBase {
  cabecalho: HeaderStyle;
}

/**
 * Devolve APENAS o cabecalho de exemplo na forma pedida (RF-007). E a previa de
 * cada opcao da segunda selecao de `config`.
 */
export function buildHeaderPreview(estilo: HeaderStyle, base: PreviewBase): string[] {
  return renderCabecalho(estilo, DADOS_DE_EXEMPLO, {
    painter: base.painter,
    glyphLevel: base.glyphLevel,
    largura: base.largura,
  });
}

/** Task de exemplo em andamento e concluida com sucesso. */
const EXEMPLO_INICIO = {
  arquivo: 'task-1.md',
  numero: 1,
  posicao: 1,
  total: 3,
  model: 'sonnet',
  effort: 'medium',
  usouContextoExecucao: true,
};

const EXEMPLO_FIM_OK = {
  arquivo: 'task-1.md',
  numero: 1,
  posicao: 1,
  total: 3,
  estado: 'ok' as const,
  sessionId: 'exemplo',
  numTurns: 12,
  wallSeconds: 47,
  tokensDaTask: 82000,
  custoDaTaskUsd: 0.1234,
  reasoningTokens: null,
  permissionDenials: 0,
  semCertificacao: false,
};

const EXEMPLO_FIM_ERRO = {
  arquivo: 'task-2.md',
  numero: 2,
  posicao: 2,
  total: 3,
  estado: 'erro' as const,
  sessionId: 'exemplo',
  numTurns: 4,
  wallSeconds: 9,
  tokensDaTask: 15000,
  custoDaTaskUsd: 0.021,
  reasoningTokens: 1800,
  permissionDenials: 1,
  semCertificacao: false,
};

/**
 * Snapshot estatico do bloco de altura fixa do layout `lote`, com os mesmos
 * eventos de exemplo das demais previas (1 ok, 1 erro, 1 pulada). Montado pela
 * mesma funcao pura que o `LoteLayout` renderiza: a previa mostra a barra e os
 * marcadores de verdade, com o quadro da task ativa congelado no primeiro frame
 * do nivel de glifo corrente e o relogio em zero — nada de sequencia de cursor
 * dentro do cartao. E a correcao do achado A1: a fabrica degrada `lote` para
 * `coluna` fora de TTY, e a previa antiga mostrava a forma errada.
 */
function previaLote(base: LayoutPreviewBase): string[] {
  const itens: ItemLote[] = [
    { numero: 1, arquivo: EXEMPLO_INICIO.arquivo, estado: 'ok', inicioMs: 0 },
    { numero: 2, arquivo: EXEMPLO_FIM_ERRO.arquivo, estado: 'erro', inicioMs: 0 },
    { numero: 3, arquivo: 'task-3.md', estado: 'pulada', inicioMs: 0 },
  ];
  const conf = QUADROS_SPINNER[base.glyphLevel] ?? QUADROS_SPINNER[GLYPH.ASCII];
  return linhasDoBloco(
    itens,
    EXEMPLO_INICIO.total,
    conf.quadros[0],
    { painter: base.painter, largura: base.largura },
    0,
  );
}

/**
 * Linhas de exemplo de `coluna`, `moldura` e `regua`, sem executar nada
 * (RF-016). Usa `createLayout` com um `stream` que acumula as escritas em
 * memoria e um contexto sempre nao interativo, para saida deterministica (sem
 * animacao nem sequencias de cursor).
 */
function previaPorEventos(nome: LayoutName, base: LayoutPreviewBase): string[] {
  const linhas: string[] = [];
  const stream = {
    write(texto: string): boolean {
      linhas.push(String(texto));
      return true;
    },
  };

  const contexto: LayoutContext = {
    painter: base.painter,
    glyphLevel: base.glyphLevel,
    isTTY: false,
    largura: base.largura,
    stream: stream as unknown as NodeJS.WritableStream,
    estiloCabecalho: base.cabecalho,
  };

  const layout = createLayout(nome, contexto);
  layout.taskStart(EXEMPLO_INICIO);
  layout.taskEnd(EXEMPLO_FIM_OK);
  layout.taskEnd(EXEMPLO_FIM_ERRO);
  layout.taskSkipped('task-3.md', 'DONE', false);
  layout.dispose();

  return linhas
    .join('')
    .split('\n')
    .filter((linha) => linha.length > 0);
}

/**
 * Devolve as linhas de exemplo de um layout (RF-016): o cabecalho no estilo
 * configurado seguido das linhas de task. Para o `lote`, o snapshot vem do
 * bloco real de altura fixa (barra + marcadores), nao da forma degradada. As
 * linhas de task respeitam a largura recebida, com ou sem cor.
 */
export function buildPreview(nome: LayoutName, base: LayoutPreviewBase): string[] {
  const linhasDeTask = (nome === 'lote'
    ? previaLote(base)
    : previaPorEventos(nome, base)
  ).map((linha) => truncarVisivel(linha, base.largura));

  return [...buildHeaderPreview(base.cabecalho, base), ...linhasDeTask];
}
