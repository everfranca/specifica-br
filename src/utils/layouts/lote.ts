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
  utilDoContexto,
  escreverLinha,
} from './coluna.js';
import type { LayoutContext, TaskStartInfo, TaskEndInfo } from './types.js';
import { QUADROS_SPINNER, GLYPH } from '../terminal/index.js';
import type { StatusKind } from '../terminal/index.js';

const OCULTAR_CURSOR = '\x1b[?25l';
const RESTAURAR_CURSOR = '\x1b[?25h';
const LIMPAR_LINHA = '\x1b[2K';
const INTERVALO_MIN_MS = 100;
const JANELA_MAX = 15;

type EstadoTask = 'pendente' | 'ativa' | StatusKind;

interface ItemLote {
  numero: number;
  arquivo: string;
  estado: EstadoTask;
  /** Instante em que a task passou a `ativa`, base do tempo decorrido. */
  inicioMs: number;
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

  private marcador(estado: EstadoTask): string {
    switch (estado) {
      case 'ativa':
        return this.quadros[this.quadroIndice % this.quadros.length];
      case 'ok':
        return '+';
      case 'aviso':
        return '!';
      case 'erro':
        return 'x';
      case 'info':
        return 'i';
      default:
        return ' ';
    }
  }

  private concluidas(): number {
    return this.itens.filter(
      (i) => i.estado !== 'pendente' && i.estado !== 'ativa',
    ).length;
  }

  private barra(): string {
    const util = utilDoContexto(this.contexto);
    const largura = Math.max(10, Math.min(util - 12, 40));
    const total = Math.max(1, this.total);
    const cheio = Math.round((this.concluidas() / total) * largura);
    const barra = '#'.repeat(cheio) + '-'.repeat(Math.max(0, largura - cheio));
    return this.contexto.painter.petroleo(
      `[${barra}] ${this.concluidas()}/${total}`,
    );
  }

  /**
   * Linha de um item. A task ativa carrega o quadro animado e o tempo decorrido
   * (RF-014); as demais, apenas o marcador de estado.
   */
  private linhaDoItem(item: ItemLote): string {
    const base = `${this.marcador(item.estado)} ${idDaTask(item.arquivo)}`;
    if (item.estado !== 'ativa') {
      return base;
    }
    const segundos = Math.floor((Date.now() - item.inicioMs) / 1000);
    return `${this.contexto.painter.petroleo(base)} ${this.contexto.painter.muted(`${segundos}s`)}`;
  }

  private linhasDoBloco(): string[] {
    const linhas = [this.barra()];
    if (this.itens.length <= JANELA_MAX) {
      for (const item of this.itens) {
        linhas.push(this.linhaDoItem(item));
      }
      return linhas;
    }
    const ativas = this.itens.filter((i) => i.estado === 'ativa');
    for (const item of ativas.slice(0, JANELA_MAX)) {
      linhas.push(this.linhaDoItem(item));
    }
    linhas.push(
      this.contexto.painter.muted(
        `concluidas: ${this.concluidas()}/${Math.max(1, this.total)}`,
      ),
    );
    return linhas;
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

    const linhas = this.linhasDoBloco();
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

  header(linhas: string[]): void {
    this.encerrarBloco();
    super.header(linhas);
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
