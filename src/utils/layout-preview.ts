import type { HeaderStyle, LayoutName } from '../types/config.js';
import type { DadosDeAbertura } from '../types/executar-tasks.js';
import type { Painter, GlyphLevel } from './terminal/index.js';
import { renderCabecalho } from './cabecalho/index.js';
import { createLayout } from './layouts/index.js';
import type { LayoutContext } from './layouts/index.js';

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
 * Devolve as linhas de exemplo de um layout, sem executar nada (RF-016).
 *
 * Usa `createLayout` com um `stream` que acumula as escritas em memoria. O
 * contexto e sempre nao interativo: assim a saida e deterministica (sem
 * animacao nem sequencias de cursor) e o layout `lote` cai para `coluna`, que
 * e exatamente o que o usuario veria ao rodar o lote sem terminal interativo.
 */
export function buildPreview(nome: LayoutName, base: LayoutPreviewBase): string[] {
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

  const linhasDeTask = linhas
    .join('')
    .split('\n')
    .filter((linha) => linha.length > 0);

  return [...buildHeaderPreview(base.cabecalho, base), ...linhasDeTask];
}
