/**
 * Layout `moldura` (RF-015).
 *
 * Cada task ocupa uma moldura fechada com seus parametros, seguida do rotulo de
 * estado e dos numeros de consumo. Em TTY, a linha logo abaixo da moldura
 * recebe o indicador animado com o tempo decorrido enquanto a task roda
 * (RF-014), e e substituida pela linha de fim quando ela termina. Abaixo de 60
 * colunas a moldura desmonta para linha simples (caso extremo 29). Fora de TTY,
 * uma escrita ao comecar e uma ao terminar.
 */

import { box } from '../terminal/index.js';
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

export class MolduraLayout extends LayoutBase {
  taskStart(info: TaskStartInfo): void {
    const conteudo = camposInicio(info);
    if (deveDesmontar(this.contexto)) {
      escreverLinha(this.contexto, conteudo);
    } else {
      const linhas = box([conteudo], {
        painter: this.contexto.painter,
        glyphLevel: this.contexto.glyphLevel,
        colunas: utilDoContexto(this.contexto),
      });
      this.contexto.stream.write(`${linhas.join('\n')}\n`);
    }
    this.iniciarIndicador(`${idDaTask(info.arquivo)} [${info.posicao}/${info.total}]`);
  }

  taskEnd(info: TaskEndInfo): void {
    const final = linhaFim(info, this.contexto.painter);
    if (!this.pararIndicador(final)) {
      escreverLinha(this.contexto, final);
    }
  }
}
