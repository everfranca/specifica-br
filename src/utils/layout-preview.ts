import type { LayoutName } from '../types/config.js';
import type { Painter, GlyphLevel } from './terminal/index.js';
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
export function buildPreview(nome: LayoutName, base: PreviewBase): string[] {
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
