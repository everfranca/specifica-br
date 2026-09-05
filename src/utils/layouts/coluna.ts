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
import { renderCabecalho } from '../cabecalho/index.js';
import { formatarDuracao, formatarMilhar } from '../formatos.js';
import type { DadosDeAbertura, EstadoDeEspera } from '../../types/executar-tasks.js';
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

/** Contador nao reportado pela ferramenta sai como `n/d` (RF-004, RF-010). */
export function naoReportadoOuNumero(valor: number | null): string {
  return valor === null ? 'n/d' : String(valor);
}

/**
 * Contador nao reportado com separacao de milhar pt-BR: o raciocinio e
 * contado em milhares de tokens e le-se melhor agrupado (RF-009).
 */
export function naoReportadoOuMilhar(valor: number | null): string {
  return valor === null ? 'n/d' : formatarMilhar(valor);
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
 * Numeros de consumo, comuns aos quatro layouts, na ordem obrigatoria de
 * RF-009: tempo, tokens, custo, turnos, tokens de raciocinio e permissoes
 * negadas. Tempo em forma humana (RF-004); tokens e raciocinio com separacao
 * de milhar pt-BR. Campo que a ferramenta nao reporta sai como `n/d`, nunca
 * como `0`: sao afirmacoes diferentes (RF-004, RF-010).
 */
export function camposConsumo(info: TaskEndInfo): string {
  return [
    `tempo=${formatarDuracao(info.wallSeconds)}`,
    `tokens=${formatarMilhar(info.tokensDaTask)}`,
    `custo=$${info.custoDaTaskUsd.toFixed(4)}`,
    `turnos=${info.numTurns}`,
    `rac=${naoReportadoOuMilhar(info.reasoningTokens)}`,
    `neg=${naoReportadoOuNumero(info.permissionDenials)}`,
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

/** Horario absoluto `HH:MM`, local, da retomada prevista (RF-022). */
function horaAbsoluta(instante: Date): string {
  const hora = String(instante.getHours()).padStart(2, '0');
  const minuto = String(instante.getMinutes()).padStart(2, '0');
  return `${hora}:${minuto}`;
}

/**
 * Linha do indicador de espera (RF-022), nas duas formas da secao 4.1 da
 * techspec. As duas apresentam simultaneamente tempo e horario absoluto:
 * techspec. Renovacao conhecida mostra o tempo restante total; sondagem mostra
 * o tempo ate a proxima tentativa, com `retoma` apontando para a sondagem. Com
 * `task === null` (espera na construcao do Contexto de Execucao), o segmento
 * final nomeia o contexto em vez de uma task.
 */
export function linhaDeEspera(estado: EstadoDeEspera): string {
  const retomada = `retoma ${horaAbsoluta(estado.retomadaEm)}`;
  const alvo =
    estado.task === null
      ? 'contexto de execucao'
      : `${idDaTask(estado.task)} [${estado.posicao}/${estado.total}]`;
  const tempo =
    estado.natureza === 'sondagem'
      ? `proxima sondagem em ${formatarDuracao(estado.restanteSegundos)}`
      : `falta ${formatarDuracao(estado.restanteSegundos)}`;
  return `aguardando renovacao da cota - ${tempo} - ${retomada} - ${alvo}`;
}

/**
 * Linha de retomada escrita por `waitEnd` (RF-022): apresenta ao mesmo tempo o
 * horario absoluto da retomada e a duracao efetiva da espera, em forma humana.
 */
export function linhaDeRetomada(
  esperaEfetivaSegundos: number,
  agora: Date = new Date(),
): string {
  return `retomada as ${horaAbsoluta(agora)} - espera de ${formatarDuracao(esperaEfetivaSegundos)}`;
}

/**
 * Linha `rotulo`/`valor` do resumo, com a coluna de rotulo alinhada a das
 * linhas vigentes (`Motivo`, `Tasks executadas`, ...): 19 colunas.
 */
export function linhaDoResumo(rotulo: string, valor: string): string {
  return `  ${rotulo.padEnd(19)}${valor}`;
}

/**
 * Linhas de tempo do resumo final (RF-010): `Tempo total` esta presente em
 * todo resumo; `Tempo em espera` aparece se e somente se o acumulado for
 * maior que zero. Os numeros sao produzidos pelo runner — aqui e so a
 * montagem visual.
 */
export function linhasDeTempoDoResumo(
  tempoTotalSegundos: number,
  tempoEmEsperaSegundos: number,
): string[] {
  const linhas = [linhaDoResumo('Tempo total', formatarDuracao(tempoTotalSegundos))];
  if (tempoEmEsperaSegundos > 0) {
    linhas.push(
      linhaDoResumo('Tempo em espera', formatarDuracao(tempoEmEsperaSegundos)),
    );
  }
  return linhas;
}

/** Campos de uma linha de evidencia do resumo (RF-010). */
export interface CamposDeEvidencia {
  arquivo: string;
  tempoSegundos: number;
  sessionId: string;
  tokens: number;
  turnos: number;
  negacoes: number | null;
  usouContexto: boolean;
}

/**
 * Linha de evidencia de task do resumo (RF-010): o tempo daquela task vem em
 * PRIMEIRO lugar, antes dos campos ja existentes, com tokens em milhar pt-BR.
 */
export function linhaDeEvidencia(ev: CamposDeEvidencia): string {
  const ctx = ev.usouContexto ? 'sim' : 'nao';
  return `    ${idDaTask(ev.arquivo)}  tempo=${formatarDuracao(ev.tempoSegundos)}  sessao=${ev.sessionId}  tokens=${formatarMilhar(ev.tokens)}  turnos=${ev.turnos}  neg=${naoReportadoOuNumero(ev.negacoes)}  ctx=${ctx}`;
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
 * Base compartilhada: `header`, `summary`, `message`, `taskSkipped` e os tres
 * metodos de espera sao identicos nas quatro estrategias, porque nao dependem
 * da forma de apresentar inicio e fim de task (CT-046).
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
  private rotuloAtivo = '';

  constructor(contexto: LayoutContext) {
    this.contexto = contexto;
  }

  private garantirSpinner(): Spinner {
    if (!this.spinner) {
      this.spinner = new Spinner({
        painter: this.contexto.painter,
        glyphLevel: this.contexto.glyphLevel,
        stream: this.contexto.stream as unknown as StreamCompativel,
      });
    }
    return this.spinner;
  }

  /**
   * Ocupa a linha corrente com o indicador animado e o tempo decorrido. Sem TTY
   * nao faz nada: quem escreve a linha de inicio e a estrategia.
   */
  protected iniciarIndicador(rotulo: string): void {
    if (!this.contexto.isTTY) {
      return;
    }
    this.rotuloAtivo = rotulo;
    this.garantirSpinner().start(rotulo);
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

  /**
   * Cabecalho de abertura (RF-005): recebe dados e delega a forma a
   * `renderCabecalho`, no estilo configurado. Implementacao unica nesta base
   * porque o estilo nao depende da estrategia — trocar de layout nao altera o
   * cabecalho.
   */
  header(dados: DadosDeAbertura): void {
    const linhas = renderCabecalho(this.contexto.estiloCabecalho, dados, this.contexto);
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

  /**
   * Mensagem de estado pelo canal unico (RF-003): o rotulo e montado aqui pela
   * calha de sete colunas, e o indicador de progresso e encerrado ANTES da
   * escrita — a mensagem substitui o indicador em vez de se sobrepor a ele.
   * O rotulo congelado fica no lugar da animacao, preservando a informacao.
   */
  message(kind: StatusKind, texto: string): void {
    if (this.spinnerAtivo) {
      this.pararIndicador(this.rotuloAtivo);
    }
    escreverLinha(this.contexto, status(kind, texto, this.contexto.painter));
  }

  /**
   * Entra em espera (RF-022): troca o indicador de execucao pelo de espera na
   * mesma linha, ou o inicia quando nao havia task corrente (espera na
   * construcao do Contexto de Execucao). Fora de TTY nao ha animacao: a linha
   * de entrada sai como texto (RF-023).
   */
  waitStart(estado: EstadoDeEspera): void {
    const linha = linhaDeEspera(estado);
    this.rotuloAtivo = linha;
    if (!this.contexto.isTTY) {
      escreverLinha(this.contexto, linha);
      return;
    }
    this.garantirSpinner().aguardar(linha);
    this.spinnerAtivo = true;
  }

  /**
   * Atualiza a linha de espera a cada segundo (RF-022). Sem indicador ativo,
   * escreve a linha como texto (RF-023).
   */
  waitUpdate(estado: EstadoDeEspera): void {
    const linha = linhaDeEspera(estado);
    this.rotuloAtivo = linha;
    if (this.spinnerAtivo && this.spinner) {
      this.spinner.update(linha);
      return;
    }
    escreverLinha(this.contexto, linha);
  }

  /**
   * Encerra a espera e escreve a linha de retomada (RF-022), com tempo e
   * horario absoluto ao mesmo tempo. Fora de TTY, texto puro (RF-023).
   */
  waitEnd(esperaEfetivaSegundos: number): void {
    const linha = linhaDeRetomada(esperaEfetivaSegundos);
    if (!this.pararIndicador(linha)) {
      escreverLinha(this.contexto, linha);
    }
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
