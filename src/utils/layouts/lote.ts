/**
 * Layout `lote` (RF-015).
 *
 * Bloco de altura fixa redesenhado no lugar, exibindo o lote inteiro e uma
 * barra de progresso. Acima de quinze tasks, exibe uma janela das ativas mais o
 * contador das concluidas, o que mantem a altura fixa.
 *
 * O redesenho usa apenas movimentacao de cursor dentro do bloco corrente: sobe
 * `n` linhas, limpa cada uma e reescreve. Nunca limpa a tela nem descarta o
 * historico de rolagem anterior (RNF-004). A taxa de redesenho respeita o teto
 * de dez quadros por segundo (RNF-005).
 *
 * Enquanto ha task ativa, um temporizador redesenha o bloco no mesmo intervalo,
 * animando o marcador e atualizando o tempo decorrido de cada task em execucao
 * (RF-014). Sem isso, uma task de minutos deixaria o bloco congelado — o exato
 * problema que a feature resolve.
 *
 * Este layout so opera com TTY. Sem TTY a fabrica ja o substituiu por
 * `ColumnLayout`; ainda assim, instanciado sem TTY, degrada defensivamente para
 * escrita linha a linha (uma ao comecar, uma ao terminar).
 */

import process from 'node:process';

import {
  LayoutBase,
  camposInicio,
  linhaFim,
  idDaTask,
  escreverLinha,
} from './coluna.js';
import type {
  LayoutContext,
  TaskStartInfo,
  TaskEndInfo,
} from './types.js';
import type {
  DadosDeAbertura,
  EstadoDeEspera,
  EtapaInfo,
} from '../../types/executar-tasks.js';
import { formatarDuracao } from '../formatos.js';
import { QUADROS_SPINNER, GLYPH, larguraUtil } from '../terminal/index.js';
import type { Painter, StatusKind } from '../terminal/index.js';

const OCULTAR_CURSOR = '\x1b[?25l';
const RESTAURAR_CURSOR = '\x1b[?25h';
const LIMPAR_LINHA = '\x1b[2K';
const INTERVALO_MIN_MS = 100;
const JANELA_MAX = 15;

/**
 * Estado de um item do bloco. `pulada` nunca ocorre no fluxo real (o
 * `taskSkipped` encerra o bloco antes de escrever); existe para o snapshot
 * estatico da pre-visualizacao de `config`, que apresenta a task pulada com o
 * marcador de aviso.
 */
export type EstadoItemLote = 'pendente' | 'ativa' | StatusKind | 'pulada';

export interface ItemLote {
  numero: number;
  arquivo: string;
  estado: EstadoItemLote;
  /** Instante em que a task passou a `ativa`, base do tempo decorrido. */
  inicioMs: number;
}

/**
 * Recorte do contexto de que a montagem do bloco precisa: cor e largura. A
 * funcao pura nao toca em stream, relogio nem sequencia de escape.
 */
export interface ContextoDoBloco {
  painter: Painter;
  largura: number;
}

const marcadorDe = (estado: EstadoItemLote, quadro: string): string => {
  switch (estado) {
    case 'ativa':
      return quadro;
    case 'ok':
      return '+';
    case 'aviso':
    case 'pulada':
      return '!';
    case 'erro':
      return 'x';
    case 'info':
      return 'i';
    default:
      return ' ';
  }
};

const concluidasDe = (itens: ItemLote[]): number =>
  itens.filter(
    (i) => i.estado !== 'pendente' && i.estado !== 'ativa' && i.estado !== 'pulada',
  ).length;

const barraDoBloco = (itens: ItemLote[], total: number, contexto: ContextoDoBloco): string => {
  const largura = Math.max(10, Math.min(larguraUtil(contexto.largura) - 12, 40));
  const totalSeguro = Math.max(1, total);
  const feitas = concluidasDe(itens);
  const cheio = Math.round((feitas / totalSeguro) * largura);
  const barra = '#'.repeat(cheio) + '-'.repeat(Math.max(0, largura - cheio));
  return contexto.painter.petroleo(`[${barra}] ${feitas}/${totalSeguro}`);
};

const linhaDoItem = (
  item: ItemLote,
  quadro: string,
  contexto: ContextoDoBloco,
  agora: number,
): string => {
  const base = `${marcadorDe(item.estado, quadro)} ${idDaTask(item.arquivo)}`;
  if (item.estado !== 'ativa') {
    return base;
  }
  const segundos = Math.floor((agora - item.inicioMs) / 1000);
  return `${contexto.painter.petroleo(base)} ${contexto.painter.muted(formatarDuracao(segundos))}`;
};

/**
 * Montagem pura das linhas do bloco de altura fixa: a barra de progresso e as
 * linhas de task, com a janela das ativas acima de quinze. Sem I/O e sem
 * sequencia de cursor; `LoteLayout.render` acrescenta o redesenho, e a previa
 * de `config` consome a saida direto. O `quadro` e o caractere congelado da
 * task ativa (quem anima e o temporizador trocando-o); `agora` separa o relogio
 * da montagem para a saida ser deterministica sob teste.
 */
export function linhasDoBloco(
  itens: ItemLote[],
  total: number,
  quadro: string,
  contexto: ContextoDoBloco,
  agora: number = Date.now(),
): string[] {
  const linhas = [barraDoBloco(itens, total, contexto)];
  if (itens.length <= JANELA_MAX) {
    for (const item of itens) {
      linhas.push(linhaDoItem(item, quadro, contexto, agora));
    }
    return linhas;
  }
  const ativas = itens.filter((i) => i.estado === 'ativa');
  for (const item of ativas.slice(0, JANELA_MAX)) {
    linhas.push(linhaDoItem(item, quadro, contexto, agora));
  }
  linhas.push(
    contexto.painter.muted(
      `concluidas: ${concluidasDe(itens)}/${Math.max(1, total)}`,
    ),
  );
  return linhas;
}

export class LoteLayout extends LayoutBase {
  private readonly itens: ItemLote[] = [];
  private readonly indice = new Map<number, ItemLote>();
  private total = 0;
  private linhasAnteriores = 0;
  private ultimoRenderMs = 0;
  private cursorOculto = false;
  private handlersRegistrados = false;
  private quadroIndice = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly quadros: string[];
  private readonly intervaloMs: number;

  constructor(contexto: LayoutContext) {
    super(contexto);
    const conf = QUADROS_SPINNER[contexto.glyphLevel] ?? QUADROS_SPINNER[GLYPH.ASCII];
    this.quadros = conf.quadros;
    this.intervaloMs = conf.intervaloMs;
  }

  private registrar(info: TaskStartInfo): void {
    if (!this.indice.has(info.numero)) {
      const item: ItemLote = {
        numero: info.numero,
        arquivo: info.arquivo,
        estado: 'pendente',
        inicioMs: Date.now(),
      };
      this.itens.push(item);
      this.indice.set(info.numero, item);
    }
    this.total = Math.max(this.total, info.total, this.itens.length);
  }

  taskStart(info: TaskStartInfo): void {
    if (!this.contexto.isTTY) {
      escreverLinha(this.contexto, camposInicio(info));
      return;
    }
    this.registrar(info);
    const item = this.indice.get(info.numero);
    if (item) {
      item.estado = 'ativa';
      item.inicioMs = Date.now();
    }
    this.render(true);
    this.garantirTemporizador();
  }

  taskEnd(info: TaskEndInfo): void {
    if (!this.contexto.isTTY) {
      escreverLinha(this.contexto, linhaFim(info, this.contexto.painter));
      return;
    }
    const item = this.indice.get(info.numero);
    if (item) {
      item.estado = info.estado;
    }
    this.render(true);
    this.garantirTemporizador();
  }

  /**
   * Temporizador de animacao: existe enquanto ha task ativa e some quando nao
   * ha. `unref` garante que ele nunca segura o event loop aberto.
   */
  private garantirTemporizador(): void {
    const temAtiva = this.itens.some((i) => i.estado === 'ativa');

    if (!temAtiva) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      return;
    }

    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.quadroIndice += 1;
      this.render(false);
    }, this.intervaloMs);
    if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
      (this.timer as { unref: () => void }).unref();
    }
  }

  private montarBloco(): string[] {
    return linhasDoBloco(
      this.itens,
      this.total,
      this.quadros[this.quadroIndice % this.quadros.length],
      { painter: this.contexto.painter, largura: this.contexto.largura },
    );
  }

  private garantirHandlers(): void {
    if (this.handlersRegistrados) {
      return;
    }
    process.on('exit', this.restaurar);
    process.on('SIGINT', this.aoSigint);
    this.handlersRegistrados = true;
  }

  private readonly restaurar = (): void => {
    if (this.cursorOculto) {
      this.contexto.stream.write(RESTAURAR_CURSOR);
      this.cursorOculto = false;
    }
  };

  // Apenas restaura o cursor, sem encerrar o processo: ver a nota em
  // `Spinner.aoSigint`. O encerramento e do comando (RF-024).
  private readonly aoSigint = (): void => {
    this.restaurar();
  };

  private render(forcado: boolean): void {
    const agora = Date.now();
    if (!forcado && agora - this.ultimoRenderMs < INTERVALO_MIN_MS) {
      return;
    }
    this.ultimoRenderMs = agora;

    if (!this.cursorOculto) {
      this.contexto.stream.write(OCULTAR_CURSOR);
      this.cursorOculto = true;
      this.garantirHandlers();
    }

    const linhas = this.montarBloco();
    let saida = '';
    if (this.linhasAnteriores > 0) {
      saida += `\x1b[${this.linhasAnteriores}A`;
    }
    saida += '\r';
    for (const linha of linhas) {
      saida += `${LIMPAR_LINHA}${linha}\n`;
    }
    // Limpa sobras quando o bloco encolheu (janela deixou de exibir uma task).
    for (let i = linhas.length; i < this.linhasAnteriores; i += 1) {
      saida += `${LIMPAR_LINHA}\n`;
    }
    this.linhasAnteriores = Math.max(linhas.length, this.linhasAnteriores);
    this.contexto.stream.write(saida);
  }

  private encerrarBloco(): void {
    if (this.linhasAnteriores > 0) {
      this.contexto.stream.write('\n');
      this.linhasAnteriores = 0;
    }
  }

  header(dados: DadosDeAbertura): void {
    this.encerrarBloco();
    super.header(dados);
  }

  // Os tres metodos de espera apenas encerram o bloco de altura fixa antes de
  // escrever, exatamente como `message` e `summary` (CT-046): o comportamento
  // de espera em si e o da base, unico para as quatro estrategias.

  // A etapa longa fora de task segue a mesma regra dos metodos de espera:
  // encerra o bloco de altura fixa antes de escrever, e o comportamento em si
  // e o da base, unico para as quatro estrategias (CT-046).

  etapaStart(info: EtapaInfo): void {
    this.encerrarBloco();
    super.etapaStart(info);
  }

  etapaEnd(kind: StatusKind, texto: string): void {
    this.encerrarBloco();
    super.etapaEnd(kind, texto);
  }

  waitStart(estado: EstadoDeEspera): void {
    this.encerrarBloco();
    super.waitStart(estado);
  }

  waitUpdate(estado: EstadoDeEspera): void {
    this.encerrarBloco();
    super.waitUpdate(estado);
  }

  waitEnd(esperaEfetivaSegundos: number): void {
    this.encerrarBloco();
    super.waitEnd(esperaEfetivaSegundos);
  }

  summary(linhas: string[]): void {
    this.encerrarBloco();
    super.summary(linhas);
  }

  message(kind: StatusKind, texto: string): void {
    this.encerrarBloco();
    super.message(kind, texto);
  }

  taskSkipped(arquivo: string, motivo: string, selecionada: boolean): void {
    this.encerrarBloco();
    super.taskSkipped(arquivo, motivo, selecionada);
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.contexto.isTTY) {
      if (this.linhasAnteriores > 0) {
        this.contexto.stream.write('\n');
        this.linhasAnteriores = 0;
      }
      this.restaurar();
      if (this.handlersRegistrados) {
        process.removeListener('exit', this.restaurar);
        process.removeListener('SIGINT', this.aoSigint);
        this.handlersRegistrados = false;
      }
    }
  }
}
