/**
 * Contratos da camada de layouts (RF-015). Padrao Strategy: quatro estrategias
 * de exibicao de inicio e fim de task que alteram APENAS a apresentacao das
 * mesmas informacoes de estado e de consumo, nunca o conteudo nem o momento em
 * que a execucao ocorre.
 *
 * Este arquivo declara somente tipos: se um dado nao esta em `TaskStartInfo` ou
 * em `TaskEndInfo`, nenhum layout pode inventa-lo; se esta, todos os quatro
 * devem exibi-lo.
 */

import type { Painter, GlyphLevel, StatusKind } from '../terminal/index.js';

/** Informacao entregue ao layout no inicio de uma task. */
export interface TaskStartInfo {
  arquivo: string;
  numero: number;
  posicao: number;
  total: number;
  model: string;
  effort: string;
  usouContextoExecucao: boolean;
}

/** Informacao entregue ao layout no fim de uma task. */
export interface TaskEndInfo {
  arquivo: string;
  numero: number;
  posicao: number;
  total: number;
  estado: StatusKind;
  sessionId: string;
  numTurns: number;
  wallSeconds: number;
  tokensDaTask: number;
  custoDaTaskUsd: number;
  permissionDenials: number;
  semCertificacao: boolean;
}

/**
 * Ambiente de renderizacao injetado no construtor de cada estrategia. Os niveis
 * de cor e de glifo e o estado de TTY chegam prontos (task-2): nenhum layout
 * reimplementa a deteccao nem le variavel de ambiente.
 */
export interface LayoutContext {
  painter: Painter;
  glyphLevel: GlyphLevel;
  isTTY: boolean;
  largura: number;
  stream: NodeJS.WritableStream;
}

/**
 * Interface comum das quatro estrategias. `dispose()` existe para que a task-10
 * garanta a restauracao do terminal em qualquer caminho de encerramento
 * (RNF-004): todo layout que use `Spinner` o para em `dispose()`.
 */
export interface LayoutRenderer {
  header(linhas: string[]): void;
  taskStart(info: TaskStartInfo): void;
  taskEnd(info: TaskEndInfo): void;
  taskSkipped(arquivo: string, motivo: string, selecionada: boolean): void;
  message(kind: StatusKind, texto: string): void;
  summary(linhas: string[]): void;
  dispose(): void;
}
