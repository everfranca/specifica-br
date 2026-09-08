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
 * trabalhando ou bloqueada por limite de uso. Executar e um scanner de pixels
 * em petroleo — ponta clara varrendo ida e volta com rastro que se desfaz — a
 * 100 ms; esperar e uma marca unica varrendo devagar, em cor de aviso, a
 * 500 ms. Nunca paprica: a paprica marca acao do usuario, e esperar nao e
 * acao do usuario (cli-movimento.md).
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

/** Largura visivel do quadro de execucao, nos tres niveis de glifo. */
const CELULAS = 8;
/** Celulas do rastro entre a ponta e o apagado total. */
const TAMANHO_DO_RASTRO = 6;
/** Quadros parado na celula final da ida, desfazendo o rastro. */
const PAUSA_NO_FIM = 9;
/** Quadros parado na celula inicial, desfazendo o rastro de volta. */
const PAUSA_NO_INICIO = 30;

/**
 * Brilho de cada celula do rastro, da ponta ao fim: 1.0 na ponta, 0.9 no
 * degrau seguinte e decaimento exponencial de base 0.65 adiante. Celulas
 * inativas ficam em 0.6. Os valores sao os fatores de alpha do scanner do
 * OpenCode (`packages/tui/src/ui/spinner.ts`), aqui viram escala de RGB
 * porque o terminal nao compoe alpha.
 */
const BRILHO_DO_RASTRO = Array.from({ length: TAMANHO_DO_RASTRO }, (_, indice) =>
  indice === 0 ? 1 : indice === 1 ? 0.9 : Math.pow(0.65, indice - 1),
);
const BRILHO_INATIVO = 0.6;

/**
 * Conjunto de quadros e intervalo de um estado, para um nivel de glifo.
 * `tons` e o indice de cor de cada celula de cada quadro (-1 inativo, 0 ponta,
 * 1..5 rastro) e so existe no conjunto de execucao, o unico pintado celula a
 * celula.
 */
export interface ConjuntoDeQuadros {
  quadros: string[];
  intervaloMs: number;
  tons?: number[][];
}

interface EstadoDoScanner {
  posicaoAtiva: number;
  segurando: boolean;
  progressoDaPausa: number;
  indoParaFrente: boolean;
}

/**
 * Posicao da ponta do scanner num quadro do ciclo. O ciclo e o do OpenCode:
 * ida (CELULAS quadros), pausa na celula final desfazendo o rastro
 * (PAUSA_NO_FIM), volta (CELULAS - 1) e pausa na celula inicial
 * (PAUSA_NO_INICIO) — 54 quadros no total.
 */
function estadoDoScanner(
  quadro: number,
  totalDeCelulas: number,
  pausaNoInicio: number,
  pausaNoFim: number,
): EstadoDoScanner {
  const quadrosDeIda = totalDeCelulas;
  const quadrosDeVolta = totalDeCelulas - 1;

  if (quadro < quadrosDeIda) {
    return { posicaoAtiva: quadro, segurando: false, progressoDaPausa: 0, indoParaFrente: true };
  }
  if (quadro < quadrosDeIda + pausaNoFim) {
    return {
      posicaoAtiva: totalDeCelulas - 1,
      segurando: true,
      progressoDaPausa: quadro - quadrosDeIda,
      indoParaFrente: true,
    };
  }
  if (quadro < quadrosDeIda + pausaNoFim + quadrosDeVolta) {
    const volta = quadro - quadrosDeIda - pausaNoFim;
    return { posicaoAtiva: totalDeCelulas - 2 - volta, segurando: false, progressoDaPausa: 0, indoParaFrente: false };
  }
  return {
    posicaoAtiva: 0,
    segurando: true,
    progressoDaPausa: quadro - quadrosDeIda - pausaNoFim - quadrosDeVolta,
    indoParaFrente: false,
  };
}

/**
 * Indice de cor de uma celula: 0 na ponta, 1..5 no rastro atras dela, -1
 * inativo. Durante as pausas o indice inteiro desloca pelo progresso — e isso
 * que faz o rastro escorrer e a ponta se desfazer pixel a pixel nas
 * extremidades, em vez de sumir de uma vez.
 */
function indiceDeCor(quadro: number, celula: number, estado: EstadoDoScanner): number {
  const distanciaDirecional = estado.indoParaFrente
    ? estado.posicaoAtiva - celula
    : celula - estado.posicaoAtiva;

  if (estado.segurando) {
    return distanciaDirecional + estado.progressoDaPausa;
  }
  if (distanciaDirecional > 0 && distanciaDirecional < TAMANHO_DO_RASTRO) {
    return distanciaDirecional;
  }
  if (distanciaDirecional === 0) {
    return 0;
  }
  return -1;
}

/**
 * Quadros do scanner de execucao: ponta, rastro e inativo aplicados celula a
 * celula. As posicoes sao geradas, e nao digitadas, porque e o que torna
 * estrutural a invariante de RNF-002 — todo quadro tem exatamente `CELULAS`
 * colunas visiveis. Sem cor, o decaimento vive no glifo: ponta cheia, rastro
 * medio, inativo apagado.
 */
function quadrosDoScanner(ponta: string, rastro: string, inativo: string): ConjuntoDeQuadros {
  const totalDeQuadros = CELULAS + PAUSA_NO_FIM + (CELULAS - 1) + PAUSA_NO_INICIO;
  const quadros: string[] = [];
  const tons: number[][] = [];

  for (let quadro = 0; quadro < totalDeQuadros; quadro += 1) {
    const estado = estadoDoScanner(quadro, CELULAS, PAUSA_NO_INICIO, PAUSA_NO_FIM);
    const glifos: string[] = [];
    const tonsDoQuadro: number[] = [];
    for (let celula = 0; celula < CELULAS; celula += 1) {
      const indice = indiceDeCor(quadro, celula, estado);
      const ativo = indice >= 0 && indice < TAMANHO_DO_RASTRO;
      glifos.push(ativo ? (indice === 0 ? ponta : rastro) : inativo);
      // Fora do rastro o indice bruto pode passar de 5 durante as pausas; e
      // armazenado ja em -1 para que a tabela so contenha -1 ou 0..5.
      tonsDoQuadro.push(ativo ? indice : -1);
    }
    quadros.push(glifos.join(''));
    tons.push(tonsDoQuadro);
  }

  return { quadros, tons, intervaloMs: 100 };
}

/** Varredura da espera: marca unica da esquerda para a direita, 6 quadros. */
function quadrosDeVarredura(trilho: string, marca: string): string[] {
  return Array.from({ length: 6 }, (_, posicao) =>
    Array.from({ length: 6 }, (_, celula) => (celula === posicao ? marca : trilho)).join(''),
  );
}

/**
 * Indicador de task em execucao (RF-008): scanner de 8 celulas no estilo do
 * OpenCode, 54 quadros a 100 ms — 10 fps exatos, que e o teto de RNF-002 e
 * nao um numero escolhido por estetica. O ciclo completo dura 5,4 s.
 */
export const QUADROS_SPINNER: Record<GlyphLevel, ConjuntoDeQuadros> = {
  [GLYPH.ASCII]: quadrosDoScanner('#', '=', '.'),
  [GLYPH.UNICODE_BOX]: quadrosDoScanner('■', '▪', '·'),
  [GLYPH.UNICODE_FULL]: quadrosDoScanner('■', '▪', '⬝'),
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
    const { quadros, tons } = this.conf;
    const indice = this.indice % quadros.length;
    const quadro = quadros[indice];
    this.indice += 1;

    if (this.estado === 'aguardando') {
      this.stream.write(LIMPAR_LINHA + this.painter.aviso(quadro) + ' ' + this.rotulo);
      return;
    }

    const segundos = Math.floor((Date.now() - this.inicioMs) / 1000);
    this.stream.write(
      LIMPAR_LINHA +
        this.pintarCelulaACelula(quadro, tons?.[indice]) +
        ' ' +
        this.rotulo +
        ' ' +
        this.painter.muted(formatarDuracao(segundos)),
    );
  }

  /**
   * O scanner e pintado celula a celula porque cada uma tem um brilho proprio:
   * ponta cheia, rastro em decaimento, inativos apagados. Sem a tabela de tons
   * o quadro e pintado inteiro em petroleo, como qualquer outra forma.
   */
  private pintarCelulaACelula(quadro: string, tons: number[] | undefined): string {
    if (!tons) {
      return this.painter.petroleo(quadro);
    }
    return [...quadro]
      .map((glifo, celula) => {
        const indice = tons[celula];
        const dentroDoRastro = indice >= 0 && indice < BRILHO_DO_RASTRO.length;
        return this.painter.petroleoAjustado(glifo, dentroDoRastro ? BRILHO_DO_RASTRO[indice] : BRILHO_INATIVO);
      })
      .join('');
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
