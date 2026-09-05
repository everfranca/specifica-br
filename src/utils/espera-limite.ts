/**
 * Porta de tempo e politica de espera por limite de uso (CT-048, RF-016,
 * RF-020, RF-022, RF-023, RF-024, RF-025).
 *
 * Uma unica instancia de `EsperaPorLimiteDeUso` existe por lote: e ela que faz
 * o teto de `--max-wait` valer para o lote inteiro, somando as esperas das
 * tasks e as da construcao do Contexto de Execucao.
 */

import type {
  ContextoDeEspera,
  EstadoDeEspera,
  OrigemHorario,
  Relogio,
} from '../types/executar-tasks.js';
import type { LayoutRenderer } from './layouts/types.js';
import type { RunnerLogger } from './task-runner.js';
import { determinarRenovacao } from './renovacao-de-cota.js';
import { formatarDuracao } from './formatos.js';

/** Intervalo de sondagem com horario desconhecido: 5 minutos (RF-016). */
const SONDAGEM_SEGUNDOS = 300;

/** Folga somada ao horario informado antes de reexecutar (RF-016). */
const FOLGA_SEGUNDOS = 30;

/** Numero de execucoes admitidas com horario conhecido (RF-016, RF-020). */
const TENTATIVAS_COM_HORARIO_CONHECIDO = 3;

/** Passo de atualizacao da linha de espera em terminal interativo (RF-022). */
const PASSO_TTY_MS = 1000;

/** Passo do sinal periodico de vida fora de terminal interativo (RF-023). */
const PASSO_SEM_TTY_MS = 15 * 60 * 1000;

/** Horario absoluto `HH:MM`, local, usado nas mensagens de desistencia. */
function horaAbsoluta(instante: Date): string {
  const hora = String(instante.getHours()).padStart(2, '0');
  const minuto = String(instante.getMinutes()).padStart(2, '0');
  return `${hora}:${minuto}`;
}

/**
 * Adapter real da porta `Relogio` (CT-048). O `esperar` resolve imediatamente e
 * limpa o temporizador quando o `signal` aborta, que e o que atende RNF-003:
 * interrupcao servida em menos de 1 segundo, qualquer que seja o tempo restante.
 */
export const relogioDoSistema: Relogio = {
  agora(): number {
    return Date.now();
  },

  esperar(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const encerrar = (): void => {
        clearTimeout(temporizador);
        signal?.removeEventListener('abort', encerrar);
        resolve();
      };

      const temporizador = setTimeout(encerrar, ms);
      signal?.addEventListener('abort', encerrar, { once: true });
    });
  },
};

/** Dependencias da instancia unica do lote (CT-048). */
export interface EsperaPorLimiteDeUsoDeps {
  relogio: Relogio;
  layout: LayoutRenderer;
  logger: RunnerLogger;
  isTTY: boolean;
  /** `--max-wait`, ja validado pela camada de opcoes. */
  tetoAcumuladoSegundos: number;
  /** `!--no-wait-on-limit`. */
  ligada: boolean;
}

/** Entrada de uma decisao de espera (CT-048). */
export interface EntradaDeEspera {
  textoBruto: string;
  contexto: ContextoDeEspera;
  task: string | null;
  posicao: number;
  total: number;
  /** Numero da execucao corrente: 1 e a primeira. */
  tentativa: number;
  signal: AbortSignal;
}

/** Desfecho de uma decisao de espera (CT-048). */
export interface ResultadoDeEspera {
  retomar: boolean;
  motivoDaDesistencia: string | null;
}

/**
 * Decide e executa a espera pela renovacao da cota, mantem o teto acumulado do
 * lote, apresenta o estado ao usuario e registra os eventos `aguardando_limite`
 * e `retomada`.
 *
 * `aguardar` nunca lanca por desistencia: devolve `retomar: false` com o motivo
 * preenchido, e o chamador decide o codigo de saida.
 */
export class EsperaPorLimiteDeUso {
  private acumulado = 0;

  constructor(private readonly deps: EsperaPorLimiteDeUsoDeps) {}

  /** Total de espera ja consumido pelo lote, em segundos. */
  public get acumuladoSegundos(): number {
    return this.acumulado;
  }

  /**
   * Aplica o Passo 5 da secao 5.1 do techspec.
   *
   * @param entrada Texto bruto da ferramenta e identificacao da tentativa.
   * @returns Se o chamador deve reexecutar, e o motivo quando nao deve.
   */
  public async aguardar(entrada: EntradaDeEspera): Promise<ResultadoDeEspera> {
    if (!this.deps.ligada) {
      return desistir('espera desligada por --no-wait-on-limit');
    }

    const inicio = this.deps.relogio.agora();
    const renovacao = determinarRenovacao(entrada.textoBruto, inicio);
    const tetoTexto = formatarDuracao(this.deps.tetoAcumuladoSegundos);
    const restanteDoTeto = this.deps.tetoAcumuladoSegundos - this.acumulado;

    if (restanteDoTeto <= 0) {
      return desistir(`teto de espera de ${tetoTexto} esgotado sem renovacao da cota`);
    }

    let planejadaSegundos: number;
    let origem: OrigemHorario;

    if (renovacao !== null) {
      planejadaSegundos = (renovacao.getTime() - inicio) / 1000 + FOLGA_SEGUNDOS;

      if (planejadaSegundos > restanteDoTeto) {
        return desistir(
          `renovacao da cota prevista para ${horaAbsoluta(renovacao)}, alem do teto de ${tetoTexto} de --max-wait`,
        );
      }
      if (entrada.tentativa >= TENTATIVAS_COM_HORARIO_CONHECIDO) {
        return desistir('limite de uso persiste apos 3 tentativas');
      }

      origem = 'informado';
    } else {
      // Sem horario conhecido nao ha limite de tentativas: o unico freio e o
      // teto acumulado, e a ultima espera e truncada no que restar dele.
      planejadaSegundos = Math.min(SONDAGEM_SEGUNDOS, restanteDoTeto);
      origem = 'sondagem';
      this.deps.layout.message(
        'info',
        `limite de uso sem horario de renovacao informado - nova tentativa a cada 5min, ate o teto de ${tetoTexto}`,
      );
    }

    await this.deps.logger.logEvent({
      event: 'aguardando_limite',
      ts: '',
      task: entrada.task,
      tentativa: entrada.tentativa,
      origem_horario: origem,
      renovacao_prevista: renovacao === null ? null : renovacao.toISOString(),
      espera_planejada_segundos: Math.round(planejadaSegundos),
      espera_acumulada_segundos_antes: this.acumulado,
      teto_espera_segundos: this.deps.tetoAcumuladoSegundos,
    });

    const fimPrevisto = inicio + planejadaSegundos * 1000;
    const natureza = origem === 'informado' ? 'renovacao_conhecida' : 'sondagem';
    const estado = (agora: number): EstadoDeEspera => ({
      natureza,
      restanteSegundos: Math.max(0, Math.round((fimPrevisto - agora) / 1000)),
      retomadaEm: new Date(fimPrevisto),
      task: entrada.task,
      posicao: entrada.posicao,
      total: entrada.total,
      tentativa: entrada.tentativa + 1,
    });

    // O layout ja distingue TTY de nao-TTY (RF-022, RF-023): a animacao so
    // existe em terminal interativo, e fora dele os mesmos tres metodos
    // escrevem linhas. O que muda aqui e apenas o passo de atualizacao.
    const passoMs = this.deps.isTTY ? PASSO_TTY_MS : PASSO_SEM_TTY_MS;
    this.deps.layout.waitStart(estado(inicio));

    let abortada = false;

    for (;;) {
      if (entrada.signal.aborted) {
        abortada = true;
        break;
      }

      const restanteMs = fimPrevisto - this.deps.relogio.agora();
      if (restanteMs <= 0) {
        break;
      }

      await this.deps.relogio.esperar(Math.min(passoMs, restanteMs), entrada.signal);

      if (entrada.signal.aborted) {
        abortada = true;
        break;
      }

      const agora = this.deps.relogio.agora();
      if (agora >= fimPrevisto) {
        break;
      }

      this.deps.layout.waitUpdate(estado(agora));
    }

    const efetivo = Math.max(0, Math.round((this.deps.relogio.agora() - inicio) / 1000));
    this.acumulado += efetivo;
    this.deps.layout.waitEnd(efetivo);

    if (abortada) {
      // RF-024: a espera termina na hora e o lote segue o caminho de
      // encerramento por interrupcao ja existente. Nao houve retomada, entao o
      // evento `retomada` nao e gravado.
      return desistir('espera interrompida pelo usuario');
    }

    await this.deps.logger.logEvent({
      event: 'retomada',
      ts: '',
      task: entrada.task,
      tentativa: entrada.tentativa + 1,
      espera_efetiva_segundos: efetivo,
      espera_acumulada_segundos_depois: this.acumulado,
      janela_renovada: true,
    });

    return { retomar: true, motivoDaDesistencia: null };
  }
}

function desistir(motivo: string): ResultadoDeEspera {
  return { retomar: false, motivoDaDesistencia: motivo };
}
