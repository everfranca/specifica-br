/**
 * Layout `coluna` (RF-015, padrao de RF-016).
 *
 * Uma linha por task: o indicador de andamento ocupa a linha da task corrente e
 * e substituido, na mesma linha, pelo rotulo de estado e pelos numeros de
 * consumo quando ela termina. Fora de TTY nao ha animacao nem `\r`: uma linha
 * ao comecar e uma ao terminar (RF-014).
 *
 * Este arquivo tambem hospeda os formatadores compartilhados pelos quatro
 * layouts. Concentrar aqui a montagem dos campos de inicio e de fim e o que
 * garante, na pratica, que trocar de layout nao faca um dado aparecer ou
 * sumir (RF-015): as quatro estrategias formatam o mesmo texto.
 */

import { status, larguraUtil, Spinner } from '../terminal/index.js';
import type { Painter, StatusKind } from '../terminal/index.js';
import type {
  LayoutContext,
  LayoutRenderer,
  TaskStartInfo,
  TaskEndInfo,
} from './types.js';

const RESTAURAR_CURSOR = '\x1b[?25h';

interface StreamCompativel {
  isTTY?: boolean;
  write(texto: string): unknown;
}

/** Identificador da task sem a extensao `.md`. */
export function idDaTask(arquivo: string): string {
  return arquivo.replace(/\.md$/i, '');
}

/**
 * Campos de inicio, comuns aos quatro layouts: identificador, posicao no lote,
 * modelo, esforco e uso do Contexto de Execucao.
 */
export function camposInicio(info: TaskStartInfo): string {
  const ctx = info.usouContextoExecucao ? 'ctx:sim' : 'ctx:nao';
  return `${idDaTask(info.arquivo)} [${info.posicao}/${info.total}] ${info.model}/${info.effort} ${ctx}`;
}

/**
 * Numeros de consumo, comuns aos quatro layouts: tokens da task, custo da task,
 * turnos, duracao de parede e permissoes negadas.
 */
export function camposConsumo(info: TaskEndInfo): string {
  return [
    `tokens=${info.tokensDaTask}`,
    `custo=$${info.custoDaTaskUsd.toFixed(4)}`,
    `turnos=${info.numTurns}`,
    `dur=${info.wallSeconds}s`,
    `neg=${info.permissionDenials}`,
  ].join(' ');
}

/**
 * Linha de fim completa: rotulo de estado de sete colunas, identificador,
 * posicao e os numeros de consumo. `painter` vem do contexto; nenhum layout
 * define cor propria (RF-013).
 */
export function linhaFim(info: TaskEndInfo, painter: Painter): string {
  const cert = info.semCertificacao ? ' nao-certificada' : '';
  const texto = `${idDaTask(info.arquivo)} [${info.posicao}/${info.total}]${cert} ${camposConsumo(info)}`;
  return status(info.estado, texto, painter);
}

/**
 * Largura util do contexto, entre 60 e 100 colunas. Abaixo de 60 devolve o
 * valor cru (< 60), que sinaliza o desmonte de moldura e regua (caso 29).
 */
export function utilDoContexto(contexto: LayoutContext): number {
  return larguraUtil(contexto.largura);
}

/** Verdadeiro quando o terminal e estreito demais para moldura ou regua. */
export function deveDesmontar(contexto: LayoutContext): boolean {
  return utilDoContexto(contexto) < 60;
}

/** Escreve `texto` seguido de uma quebra de linha, numa unica escrita. */
export function escreverLinha(contexto: LayoutContext, texto: string): void {
  contexto.stream.write(`${texto}\n`);
}

/**
 * Base compartilhada: `header`, `summary`, `message` e `taskSkipped` sao
 * identicos nas quatro estrategias, porque nao dependem da forma de apresentar
 * inicio e fim de task.
 *
 * O indicador de andamento tambem vive aqui. RF-014 e um requisito do comando,
 * nao do layout `coluna`: em qualquer estrategia de linha, uma task de minutos
 * precisa mostrar que o processo esta vivo e ha quanto tempo (US-003). Cada
 * estrategia decide apenas o que escreve antes e depois dele.
 */
export abstract class LayoutBase implements LayoutRenderer {
  protected readonly contexto: LayoutContext;
  private spinner: Spinner | null = null;
  private spinnerAtivo = false;

  constructor(contexto: LayoutContext) {
    this.contexto = contexto;
  }

  /**
   * Ocupa a linha corrente com o indicador animado e o tempo decorrido. Sem TTY
   * nao faz nada: quem escreve a linha de inicio e a estrategia.
   */
  protected iniciarIndicador(rotulo: string): void {
    if (!this.contexto.isTTY) {
      return;
    }
    if (!this.spinner) {
      this.spinner = new Spinner({
        painter: this.contexto.painter,
        glyphLevel: this.contexto.glyphLevel,
        stream: this.contexto.stream as unknown as StreamCompativel,
      });
    }
    this.spinner.start(rotulo);
    this.spinnerAtivo = true;
  }

  /**
   * Substitui o indicador por `linhaFinal`, na mesma linha. Devolve `false`
   * quando nao havia indicador ativo — nesse caso a estrategia escreve a linha
   * ela mesma.
   */
  protected pararIndicador(linhaFinal: string): boolean {
    if (!this.spinnerAtivo || !this.spinner) {
      return false;
    }
    this.spinner.stop(linhaFinal);
    this.spinnerAtivo = false;
    return true;
  }

  header(linhas: string[]): void {
    if (linhas.length === 0) {
      return;
    }
    this.contexto.stream.write(`${linhas.join('\n')}\n`);
  }

  summary(linhas: string[]): void {
    if (linhas.length === 0) {
      return;
    }
    this.contexto.stream.write(`${linhas.join('\n')}\n`);
  }

  message(kind: StatusKind, texto: string): void {
    escreverLinha(this.contexto, status(kind, texto, this.contexto.painter));
  }

  taskSkipped(arquivo: string, motivo: string, selecionada: boolean): void {
    const linhas = [
      status('info', `${idDaTask(arquivo)} pulada: ${motivo}`, this.contexto.painter),
    ];
    if (selecionada) {
      linhas.push(
        status(
          'aviso',
          `${idDaTask(arquivo)} estava selecionada mas nao foi executada. Altere o Status no arquivo para reexecutar de proposito.`,
          this.contexto.painter,
        ),
      );
    }
    this.contexto.stream.write(`${linhas.join('\n')}\n`);
  }

  abstract taskStart(info: TaskStartInfo): void;
  abstract taskEnd(info: TaskEndInfo): void;

  dispose(): void {
    if (this.pararIndicador('')) {
      return;
    }
    if (this.contexto.isTTY) {
      this.contexto.stream.write(RESTAURAR_CURSOR);
    }
  }
}

/**
 * Layout `coluna`. Em TTY usa `Spinner` para ocupar a linha da task e o
 * substitui na mesma linha ao terminar; fora de TTY escreve duas linhas.
 */
export class ColumnLayout extends LayoutBase {
  taskStart(info: TaskStartInfo): void {
    const linha = camposInicio(info);
    if (!this.contexto.isTTY) {
      escreverLinha(this.contexto, linha);
      return;
    }
    this.iniciarIndicador(linha);
  }

  taskEnd(info: TaskEndInfo): void {
    const final = linhaFim(info, this.contexto.painter);
    if (!this.pararIndicador(final)) {
      escreverLinha(this.contexto, final);
    }
  }
}
