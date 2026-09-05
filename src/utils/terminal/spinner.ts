/**
 * Indicador de andamento nos dois estados (RF-008, RF-022, RNF-002).
 *
 * A regra que governa este arquivo: movimento exige um TTY. Fora dele, toda
 * animacao vira lixo num arquivo de log — `\r` nao apaga nada, e o log vira
 * uma linha unica com todos os quadros concatenados. O `specifica-br` roda em
 * CI o tempo todo, entao `start()` e `stop()` tem dois modos, decididos por
 * `stream.isTTY` e pela ausencia de `CI`.
 *
 * Executar e esperar sao dois estados visualmente distintos, e essa distincao e
 * o produto: olhando o terminal, o usuario precisa saber se a ferramenta esta
 * trabalhando ou bloqueada por limite de uso. Executar e uma barra pulsante em
 * petroleo a 100 ms; esperar e uma marca unica varrendo devagar, em cor de
 * aviso, a 500 ms. Nunca paprica: a paprica marca acao do usuario, e esperar
 * nao e acao do usuario (cli-movimento.md).
 */

import { GLYPH } from './types.js';
import type { GlyphLevel, Painter, SpinnerEstado } from './types.js';
import { formatarDuracao } from '../formatos.js';

interface StreamDeSaida {
  isTTY?: boolean;
  write(texto: string): unknown;
}

const OCULTAR_CURSOR = '\x1b[?25l';
const RESTAURAR_CURSOR = '\x1b[?25h';
const LIMPAR_LINHA = '\r\x1b[2K';

/** Largura visivel de todo quadro, nos dois conjuntos e nos tres niveis. */
const CELULAS = 6;
/** Largura do pulso da barra de execucao, em celulas. */
const PULSO = 2;

/**
 * Conjunto de quadros e intervalo de um estado, para um nivel de glifo.
 */
export interface ConjuntoDeQuadros {
  quadros: string[];
  intervaloMs: number;
}

/**
 * Barra pulsante: o pulso percorre ida e volta, gerando 8 quadros. As posicoes
 * sao geradas, e nao digitadas, porque e o que torna estrutural a invariante de
 * RNF-002 — todo quadro tem exatamente `CELULAS` colunas visiveis.
 */
function quadrosPulsantes(trilho: string, pulso: string): string[] {
  const posicoes = [0, 1, 2, 3, 4, 3, 2, 1];
  return posicoes.map((inicio) =>
    Array.from({ length: CELULAS }, (_, celula) =>
      celula >= inicio && celula < inicio + PULSO ? pulso : trilho,
    ).join(''),
  );
}

/** Varredura da espera: marca unica da esquerda para a direita, 6 quadros. */
function quadrosDeVarredura(trilho: string, marca: string): string[] {
  return Array.from({ length: CELULAS }, (_, posicao) =>
    Array.from({ length: CELULAS }, (_, celula) => (celula === posicao ? marca : trilho)).join(''),
  );
}

/**
 * Indicador de task em execucao (RF-008): barra pulsante de 6 celulas, pulso de
 * 2 celulas em ida e volta, 8 quadros a 100 ms — 10 fps exatos, que e o teto de
 * RNF-002 e nao um numero escolhido por estetica.
 */
export const QUADROS_SPINNER: Record<GlyphLevel, ConjuntoDeQuadros> = {
  [GLYPH.ASCII]: { quadros: quadrosPulsantes('-', '='), intervaloMs: 100 },
  [GLYPH.UNICODE_BOX]: { quadros: quadrosPulsantes('─', '━'), intervaloMs: 100 },
  [GLYPH.UNICODE_FULL]: { quadros: quadrosPulsantes('░', '█'), intervaloMs: 100 },
};

/**
 * Indicador de espera (RF-022): marca unica varrendo da esquerda para a
 * direita, 6 quadros a 500 ms. O intervalo lento e deliberado e e metade da
 * informacao — uma barra que anda devagar le como espera, nao como trabalho.
 * Nao reduzir "para ficar mais fluido".
 */
export const QUADROS_ESPERA: Record<GlyphLevel, ConjuntoDeQuadros> = {
  [GLYPH.ASCII]: { quadros: quadrosDeVarredura('-', '*'), intervaloMs: 500 },
  [GLYPH.UNICODE_BOX]: { quadros: quadrosDeVarredura('─', '┼'), intervaloMs: 500 },
  [GLYPH.UNICODE_FULL]: { quadros: quadrosDeVarredura('░', '▒'), intervaloMs: 500 },
};

export interface SpinnerOpcoes {
  painter: Painter;
  glyphLevel: GlyphLevel;
  stream?: StreamDeSaida;
}

export class Spinner {
  private readonly painter: Painter;
  private readonly stream: StreamDeSaida;
  private readonly confExecucao: ConjuntoDeQuadros;
  private readonly confEspera: ConjuntoDeQuadros;
  private readonly animado: boolean;

  private estado: SpinnerEstado = 'executando';
  private rotulo = '';
  private inicioMs = 0;
  private indice = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursorOculto = false;
  private handlersRegistrados = false;

  constructor(opcoes: SpinnerOpcoes) {
    this.painter = opcoes.painter;
    this.stream = opcoes.stream ?? process.stdout;
    this.confExecucao = QUADROS_SPINNER[opcoes.glyphLevel] ?? QUADROS_SPINNER[GLYPH.ASCII];
    this.confEspera = QUADROS_ESPERA[opcoes.glyphLevel] ?? QUADROS_ESPERA[GLYPH.ASCII];
    // CI entra na condicao junto com isTTY porque alguns runners fornecem um
    // TTY e ainda assim capturam a saida em arquivo (cli-movimento.md).
    this.animado = Boolean(this.stream.isTTY) && !process.env.CI;
  }

  /** O estado corrente do indicador. */
  get estadoAtual(): SpinnerEstado {
    return this.estado;
  }

  /** Inicia o indicador para a task `rotulo`, no estado `executando`. */
  start(rotulo: string): void {
    this.estado = 'executando';
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
    this.iniciarTimer();
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
   * Passa ao estado `aguardando` (RF-022): conjunto de quadros proprio, cor de
   * aviso, 500 ms e ausencia do cronometro crescente da task. A `linha` vem
   * pronta do chamador — quem decide *quando* esperar e a politica de espera,
   * nao a primitiva de terminal.
   */
  aguardar(linha: string): void {
    this.estado = 'aguardando';
    this.rotulo = linha;
    this.indice = 0;

    if (!this.animado) {
      this.stream.write(`${linha}\n`);
      return;
    }

    this.ocultarCursor();
    this.registrarHandlers();
    this.reiniciarAnimacao();
  }

  /**
   * Metodo simetrico de `aguardar`: devolve o indicador ao estado `executando`,
   * com o rotulo da task e o cronometro medido desde `start`. O relogio da task
   * nao e zerado — a espera nao apaga o tempo ja gasto nela.
   */
  retomar(rotulo: string): void {
    this.estado = 'executando';
    this.rotulo = rotulo;
    this.indice = 0;

    if (!this.animado) {
      this.stream.write(`${rotulo}\n`);
      return;
    }

    this.ocultarCursor();
    this.registrarHandlers();
    this.reiniciarAnimacao();
  }

  /**
   * Encerra o indicador, em qualquer um dos dois estados. Com TTY, substitui a
   * animacao por `linhaFinal` na mesma linha e restaura o cursor. Sem TTY,
   * escreve `linhaFinal` numa linha nova.
   */
  stop(linhaFinal: string): void {
    if (!this.animado) {
      this.stream.write(`${linhaFinal}\n`);
      return;
    }

    this.pararTimer();
    this.stream.write(`${LIMPAR_LINHA}${linhaFinal}\n`);
    this.restaurarCursor();
    this.removerHandlers();
    this.estado = 'executando';
  }

  /** Conjunto vigente para o estado corrente. */
  private get conf(): ConjuntoDeQuadros {
    return this.estado === 'aguardando' ? this.confEspera : this.confExecucao;
  }

  /**
   * Troca o intervalo do timer junto com o conjunto de quadros. `LIMPAR_LINHA`
   * no inicio de todo `render` e o que garante que a troca de estado nao deixa
   * residuo do quadro anterior, que tem outros caracteres.
   */
  private reiniciarAnimacao(): void {
    this.pararTimer();
    this.render();
    this.iniciarTimer();
  }

  private iniciarTimer(): void {
    this.timer = setInterval(() => this.render(), this.conf.intervaloMs);
    // Nao segurar o event loop so por causa da animacao.
    if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
      (this.timer as { unref: () => void }).unref();
    }
  }

  private pararTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Ordem obrigatoria de RF-008: `barra  rotulo  duracao`, com a duracao em
   * `muted` e em ULTIMO lugar. E o unico campo que muda de largura ao longo da
   * execucao (`59s` -> `1m 00s`), e mante-lo na ponta impede que qualquer campo
   * a esquerda se desloque. No estado `aguardando` nao ha cronometro: a linha
   * ja vem pronta e o tempo que importa e o que falta, nao o que passou.
   */
  private render(): void {
    const { quadros } = this.conf;
    const quadro = quadros[this.indice % quadros.length];
    this.indice += 1;

    if (this.estado === 'aguardando') {
      this.stream.write(LIMPAR_LINHA + this.painter.aviso(quadro) + ' ' + this.rotulo);
      return;
    }

    const segundos = Math.floor((Date.now() - this.inicioMs) / 1000);
    this.stream.write(
      LIMPAR_LINHA +
        this.painter.petroleo(quadro) +
        ' ' +
        this.rotulo +
        ' ' +
        this.painter.muted(formatarDuracao(segundos)),
    );
  }

  private ocultarCursor(): void {
    if (!this.cursorOculto) {
      this.stream.write(OCULTAR_CURSOR);
      this.cursorOculto = true;
    }
  }

  // Idempotente: um Ctrl-C que deixa o terminal sem cursor e o pior bug de UI
  // de uma CLI, porque persiste depois que o processo morreu (RNF-002). Vale
  // igualmente nos dois estados: os handlers sao registrados por instancia e
  // nao consultam `this.estado`.
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
