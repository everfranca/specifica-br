/**
 * Layout `regua` (RF-015).
 *
 * Um separador horizontal abre e fecha cada task, com o identificador a
 * esquerda e a posicao da task no lote a direita. Em TTY, a linha entre os dois
 * separadores recebe o indicador animado com o tempo decorrido enquanto a task
 * roda (RF-014), e e substituida pelo separador de fecho quando ela termina.
 * Abaixo de 60 colunas o separador desmonta para linha simples (caso extremo
 * 29). Fora de TTY, uma escrita ao comecar e uma ao terminar.
 */

import { GLYPH, visibleWidth, status } from '../terminal/index.js';
import {
  LayoutBase,
  camposInicio,
  linhaFim,
  idDaTask,
  deveDesmontar,
  utilDoContexto,
  escreverLinha,
} from './coluna.js';
import type { TaskStartInfo, TaskEndInfo } from './types.js';

export class ReguaLayout extends LayoutBase {
  /**
   * Monta um separador com texto a esquerda e a direita, preenchido no meio
   * pelo traco de regua. O traco cai para `-` sem glifo Unicode (caso 29).
   */
  private separador(esquerda: string, direita: string): string {
    const util = utilDoContexto(this.contexto);
    const larg = Math.max(1, Math.min(util, 100));
    const traco =
      this.contexto.glyphLevel >= GLYPH.UNICODE_BOX && util >= 60 ? '─' : '-';
    const meio = Math.max(
      1,
      larg - visibleWidth(esquerda) - visibleWidth(direita) - 2,
    );
    return this.contexto.painter.petroleo(
      `${esquerda} ${traco.repeat(meio)} ${direita}`,
    );
  }

  taskStart(info: TaskStartInfo): void {
    const posicao = `[${info.posicao}/${info.total}]`;
    if (deveDesmontar(this.contexto)) {
      escreverLinha(this.contexto, `${camposInicio(info)} ${posicao}`);
    } else {
      escreverLinha(this.contexto, this.separador(camposInicio(info), posicao));
    }
    // Rotulo completo de RF-008: a duracao humana vem em ultimo, acrescida
    // pelo indicador (task-2).
    this.iniciarIndicador(camposInicio(info));
  }

  taskEnd(info: TaskEndInfo): void {
    const final = linhaFim(info, this.contexto.painter);
    if (deveDesmontar(this.contexto)) {
      if (!this.pararIndicador(final)) {
        escreverLinha(this.contexto, final);
      }
      return;
    }
    const rotulo = status(info.estado, '', this.contexto.painter);
    const fecho = this.separador(
      `${idDaTask(info.arquivo)} ${rotulo}`,
      `[${info.posicao}/${info.total}]`,
    );
    // O indicador ocupa a linha entre os separadores: o fecho o substitui ali
    // mesmo, e a linha de fim vem logo abaixo. Sem indicador, as duas linhas
    // saem numa unica escrita, preservando a invariante de uma escrita por
    // taskStart e uma por taskEnd fora de TTY.
    if (this.pararIndicador(fecho)) {
      escreverLinha(this.contexto, final);
      return;
    }
    this.contexto.stream.write(`${fecho}\n${final}\n`);
  }
}
