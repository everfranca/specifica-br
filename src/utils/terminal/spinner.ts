/**
 * Indicador de andamento (RF-014, RNF-004, RNF-005). Arquivo novo, sem
 * equivalente no repositorio de identidade visual.
 *
 * A regra que governa este arquivo: movimento exige um TTY. Fora dele, toda
 * animacao vira lixo num arquivo de log — `\r` nao apaga nada, e o log vira
 * uma linha unica com todos os quadros concatenados. O `specifica-br` roda em
 * CI o tempo todo, entao `start()` e `stop()` tem dois modos, decididos por
 * `stream.isTTY` e pela ausencia de `CI`.
 *
 * Cor petroleo, nunca paprica: a paprica marca acao do usuario, e esperar nao
 * e acao do usuario (cli-movimento.md).
 */

import { GLYPH } from './types.js';
import type { GlyphLevel, Painter } from './types.js';

interface StreamDeSaida {
  isTTY?: boolean;
  write(texto: string): unknown;
}

const OCULTAR_CURSOR = '\x1b[?25l';
const RESTAURAR_CURSOR = '\x1b[?25h';
const LIMPAR_LINHA = '\r\x1b[2K';

/**
 * Quadros e intervalo por nivel de glifo.
 *
 * A secao 5.1 da techspec descreve o braille a 80 ms em `UNICODE_FULL`, mas
 * RNF-005 impoe teto de dez quadros por segundo e a secao 4 desta task proibe
 * explicitamente intervalo abaixo de 100 ms. Resolucao adotada: o braille roda
 * a 100 ms (10 fps exatos), nao 80 ms. Ver "Notas de Execucao" da task.
 */
export const QUADROS_SPINNER: Record<GlyphLevel, { quadros: string[]; intervaloMs: number }> = {
  [GLYPH.ASCII]: { quadros: ['-', '\\', '|', '/'], intervaloMs: 120 },
  [GLYPH.UNICODE_BOX]: {
    quadros: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'],
    intervaloMs: 100,
  },
  [GLYPH.UNICODE_FULL]: {
    quadros: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    intervaloMs: 100,
  },
};

export interface SpinnerOpcoes {
  painter: Painter;
  glyphLevel: GlyphLevel;
  stream?: StreamDeSaida;
}

export class Spinner {
  private readonly painter: Painter;
  private readonly stream: StreamDeSaida;
  private readonly quadros: string[];
  private readonly intervaloMs: number;
  private readonly animado: boolean;

  private rotulo = '';
  private inicioMs = 0;
  private indice = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursorOculto = false;
  private handlersRegistrados = false;

  constructor(opcoes: SpinnerOpcoes) {
    this.painter = opcoes.painter;
    this.stream = opcoes.stream ?? process.stdout;
    const conf = QUADROS_SPINNER[opcoes.glyphLevel] ?? QUADROS_SPINNER[GLYPH.ASCII];
    this.quadros = conf.quadros;
    this.intervaloMs = conf.intervaloMs;
    // CI entra na condicao junto com isTTY porque alguns runners fornecem um
    // TTY e ainda assim capturam a saida em arquivo (cli-movimento.md).
    this.animado = Boolean(this.stream.isTTY) && !process.env.CI;
  }

  /** Inicia o indicador para a task `rotulo`. */
  start(rotulo: string): void {
    this.rotulo = rotulo;
    this.inicioMs = Date.now();
    this.indice = 0;

    if (!this.animado) {
      // Sem TTY: uma unica linha ao comecar, sem `\r` e sem reescrita.
      this.stream.write(`${rotulo}\n`);
      return;
    }

    this.ocultarCursor();
    this.registrarHandlers();
    this.render();
    this.timer = setInterval(() => this.render(), this.intervaloMs);
    // Nao segurar o event loop so por causa da animacao.
    if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
      (this.timer as { unref: () => void }).unref();
    }
  }

  /** Atualiza o rotulo exibido. Sem TTY nao escreve nada (uma linha em start,
   *  uma em stop). */
  update(rotulo: string): void {
    this.rotulo = rotulo;
    if (this.animado) {
      this.render();
    }
  }

  /**
   * Encerra o indicador. Com TTY, substitui a animacao por `linhaFinal` na
   * mesma linha e restaura o cursor. Sem TTY, escreve `linhaFinal` numa linha
   * nova.
   */
  stop(linhaFinal: string): void {
    if (!this.animado) {
      this.stream.write(`${linhaFinal}\n`);
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stream.write(`${LIMPAR_LINHA}${linhaFinal}\n`);
    this.restaurarCursor();
    this.removerHandlers();
  }

  private render(): void {
    const segundos = Math.floor((Date.now() - this.inicioMs) / 1000);
    const quadro = this.quadros[this.indice % this.quadros.length];
    this.indice += 1;
    const linha =
      LIMPAR_LINHA +
      this.painter.petroleo(quadro) +
      ' ' +
      this.rotulo +
      ' ' +
      this.painter.muted(`${segundos}s`);
    this.stream.write(linha);
  }

  private ocultarCursor(): void {
    if (!this.cursorOculto) {
      this.stream.write(OCULTAR_CURSOR);
      this.cursorOculto = true;
    }
  }

  // Idempotente: um Ctrl-C que deixa o terminal sem cursor e o pior bug de UI
  // de uma CLI, porque persiste depois que o processo morreu (RNF-004).
  private readonly restaurarCursor = (): void => {
    if (this.cursorOculto) {
      this.stream.write(RESTAURAR_CURSOR);
      this.cursorOculto = false;
    }
  };

  private readonly aoSair = (): void => {
    this.restaurarCursor();
  };

  // Os handlers de sinal APENAS restauram o cursor. Nao encerram o processo:
  // `process.exit()` forca o termino imediato mesmo havendo operacoes
  // assincronas pendentes, e era exatamente isso que atropelava o encerramento
  // do comando (gravacao de `run_end` e resumo parcial) num Ctrl+C. Quem decide
  // o codigo de saida e o dono da execucao (RF-024).
  private readonly aoSigint = (): void => {
    this.restaurarCursor();
  };

  private readonly aoSigterm = (): void => {
    this.restaurarCursor();
  };

  private readonly aoErroNaoTratado = (erro: unknown): void => {
    this.restaurarCursor();
    // Repropaga: o handler restaura o cursor mas nao engole a falha nem
    // impede o encerramento do processo.
    throw erro;
  };

  private registrarHandlers(): void {
    if (this.handlersRegistrados) {
      return;
    }
    process.on('exit', this.aoSair);
    process.on('SIGINT', this.aoSigint);
    process.on('SIGTERM', this.aoSigterm);
    process.on('uncaughtException', this.aoErroNaoTratado);
    this.handlersRegistrados = true;
  }

  private removerHandlers(): void {
    if (!this.handlersRegistrados) {
      return;
    }
    process.removeListener('exit', this.aoSair);
    process.removeListener('SIGINT', this.aoSigint);
    process.removeListener('SIGTERM', this.aoSigterm);
    process.removeListener('uncaughtException', this.aoErroNaoTratado);
    this.handlersRegistrados = false;
  }
}
