import fs from 'fs-extra';
import type {
  ExecutarTasksOptions,
  OrigemHorario,
  PackResult,
  Relogio,
  RunEndMotivo,
  RunEvent,
  RunEventEnd,
  TaskInfo,
} from '../types/executar-tasks.js';
import type { ToolSlug } from '../types/config.js';
import type {
  BuildTaskArgsInput,
  TaskResult,
  ToolCapabilities,
} from '../types/tool-adapter.js';
import type { StatusKind } from './terminal/index.js';
import type { LayoutRenderer } from './layouts/types.js';
import type { AccountingService } from './accounting.js';
import type { ContextPackContexto } from './context-pack-service.js';
import type { EntradaDeEspera, ResultadoDeEspera } from './espera-limite.js';
import { STATUS_DONE_PATTERN } from './task-discovery-patterns.js';
import { getExecutavel } from './tool-adapters/tool-registry.js';
import { determinarRenovacao } from './renovacao-de-cota.js';
import { formatarDuracao } from './formatos.js';

/** Identificador da task sem a extensao `.md`, para as mensagens ao usuario. */
function idDaTask(arquivo: string): string {
  return arquivo.replace(/\.md$/i, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resultado sintetico de `--dry-run`: nada foi gasto, nada foi invocado. Os
 * contadores em zero garantem que a contabilidade nao se mexe.
 */
function resultadoDryRun(): TaskResult {
  return {
    sessionId: 'dry-run',
    subtype: 'dry_run',
    isError: false,
    exitCode: 0,
    numTurns: 0,
    durationMs: 0,
    durationApiMs: 0,
    costUsd: 0,
    model: '',
    modelosReportados: '',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    reasoningTokens: null,
    permissionDenials: 0,
    ferramentasNegadas: null,
    contabilidadeParcial: false,
    rawStdout: '',
    rawStderr: '',
  };
}

/**
 * Substitui, na linha de `--dry-run`, o posicional que carrega o destilado pela
 * contagem de bytes dele (CT-030). Despejar o destilado inteiro na tela tornaria
 * a linha ilegivel sem acrescentar informacao: o arquivo esta no disco.
 */
function resumirArgs(args: string[], conteudo: string | null): string[] {
  if (conteudo === null || conteudo === '') {
    return args;
  }
  const sufixo = `\n\n${conteudo}`;
  return args.map((arg) =>
    arg.endsWith(sufixo)
      ? `${arg.slice(0, -sufixo.length)} + <contexto-execucao: ${Buffer.byteLength(
          conteudo,
          'utf-8'
        )} bytes>`
      : arg
  );
}

/**
 * Recusa, sem abortar, as opcoes que dependem de uma capacidade que a ferramenta
 * nao tem (RF-012). Cada recusa vira um aviso nominal e a funcionalidade e
 * desligada. Como so `claudecode` tem contrato validado nesta versao, na pratica
 * nenhuma capacidade falta; a funcao existe para o dia em que outra ferramenta
 * entrar com um contrato parcial.
 */
export function ajustarPorCapacidades(
  opcoes: ExecutarTasksOptions,
  capacidades: ToolCapabilities,
  nomeFerramenta: string
): { opcoes: ExecutarTasksOptions; avisos: string[] } {
  const avisos: string[] = [];
  const ajustado: ExecutarTasksOptions = { ...opcoes };

  if (!capacidades.saidaEstruturadaComTokens) {
    avisos.push(`${nomeFerramenta} nao reporta uso de tokens - trava de orcamento desativada`);
    if (opcoes.windowBudgetTokens > 0) {
      avisos.push(
        `--window-budget-tokens ignorada: ${nomeFerramenta} nao reporta uso de tokens`
      );
    }
    if (opcoes.maxBudgetUsd > 0) {
      avisos.push(`--max-budget-usd ignorada: ${nomeFerramenta} nao reporta uso de tokens`);
    }
    ajustado.windowBudgetTokens = 0;
    ajustado.maxBudgetUsd = 0;
  }

  if (!capacidades.injecaoDeContextoNoSystemPrompt && opcoes.contextPack) {
    avisos.push(
      `Contexto de Execucao desativado: ${nomeFerramenta} nao injeta o system prompt`
    );
    ajustado.contextPack = false;
  }

  if (!capacidades.liberacaoDeDiretoriosDeLeitura) {
    avisos.push(
      `diretorios extras de skills ignorados: ${nomeFerramenta} nao libera diretorios de leitura`
    );
    if (!opcoes.skillDirs) {
      avisos.push(`--no-skill-dirs ignorada: ${nomeFerramenta} nao oferece o recurso correspondente`);
    }
    ajustado.skillDirs = false;
  }

  if (!capacidades.consultaAosMcps && opcoes.mcpCheck) {
    avisos.push(`verificacao de MCPs desligada: ${nomeFerramenta} nao consulta MCPs`);
    ajustado.mcpCheck = false;
  }

  if (!capacidades.relatoDeCustoEmUSD) {
    ajustado.maxBudgetUsd = 0;
  }

  if (!capacidades.modeloDeFallback && opcoes.fallbackModel) {
    avisos.push(`--fallback-model ignorada: ${nomeFerramenta} nao oferece o recurso correspondente`);
    ajustado.fallbackModel = '';
  }

  // `--context-injection` so faz sentido onde ha mais de uma forma de entrega
  // (CT-030). O default `prompt` nao conta como informada: sem `getOptionValueSource`
  // aqui, e o unico criterio disponivel e ele nao muda o resultado observavel.
  if (!capacidades.formaDeInjecaoSelecionavel) {
    if (opcoes.contextInjection !== 'prompt') {
      avisos.push(
        `--context-injection ignorada: ${nomeFerramenta} nao oferece o recurso correspondente`
      );
    }
    ajustado.contextInjection = 'prompt';
  }

  if (!capacidades.otimizacaoDeCacheDePrompt) {
    if (!opcoes.cacheTuning) {
      avisos.push(
        `--no-cache-tuning ignorada: ${nomeFerramenta} nao oferece o recurso correspondente`
      );
    }
    ajustado.cacheTuning = false;
  }

  return { opcoes: ajustado, avisos };
}

/** Subconjunto do `ClaudeCodeAdapter` (task-5) consumido pelo loop. */
export interface RunnerToolAdapter {
  capacidades: ToolCapabilities;
  buildTaskArgs(entrada: BuildTaskArgsInput): string[];
  runTask(
    entrada: BuildTaskArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult>;
  detectRateLimit(rawOutput: string): boolean;
}

/** Subconjunto do `ContextPackService` (task-8) consumido pelo loop. */
export interface RunnerContextPack {
  /**
   * CT-050: duracao acumulada das tentativas de construcao mortas por SIGTERM,
   * cujo consumo real nao chega a contabilidade.
   */
  readonly consumoNaoContabilizadoSegundos: number;
  precisaReconstruir(
    featureDir: string,
    projectRoot: string
  ): Promise<{ reconstruir: boolean; motivo: string; fonteAlterada: string | null }>;
  ensure(contexto: ContextPackContexto): Promise<PackResult>;
  caminhoParaInjecao(resultado: PackResult): string | null;
  abort(): void;
}

/** Subconjunto do `RunLoggerService` (task-6) consumido pelo loop. */
export interface RunnerLogger {
  logEvent(evento: RunEvent): Promise<void>;
  appendStderr(texto: string): void;
  close(): Promise<void>;
}

/**
 * Parte do arquivo de apoio de execucao que o runner precisa conhecer (CT-035):
 * a reescrita da chave `instructions` a cada construcao do destilado e a remocao
 * no encerramento. A primeira escrita e do comando, antes do preflight.
 */
export interface RunnerExecutorConfig {
  /**
   * Regrava o arquivo de apoio com o destilado informado, de forma atomica.
   * `null` remove a chave `instructions`.
   */
  aplicarDestilado(destiladoPath: string | null): Promise<void>;
  remover(): Promise<void>;
}

/**
 * Subconjunto do `EsperaPorLimiteDeUso` (task-8) consumido pelo loop (CT-048).
 * A instancia e a MESMA injetada no `ContextPackService`: e o que faz o teto de
 * `--max-wait` valer para o lote inteiro.
 */
export interface RunnerEsperaPorLimite {
  readonly acumuladoSegundos: number;
  aguardar(entrada: EntradaDeEspera): Promise<ResultadoDeEspera>;
}

export interface TaskRunnerDeps {
  adapter: RunnerToolAdapter;
  contextPack: RunnerContextPack;
  accounting: AccountingService;
  logger: RunnerLogger;
  layout: LayoutRenderer;
  espera: RunnerEsperaPorLimite;
  /** Porta de tempo (CT-048): nos testes um relogio falso substitui o do sistema. */
  relogio: Relogio;
  opcoes: ExecutarTasksOptions;
  ferramenta: ToolSlug;
  featureDir: string;
  projectRoot: string;
  cwd: string;
  extraDirs: string[];
  packContexto: ContextPackContexto;
  windowBudgetTokens: number;
  packPathInicial: string | null;
  totalTasks: number;
  /** Arquivo de apoio do OpenCode a remover no encerramento; `null` nas demais ferramentas. */
  executorConfig: RunnerExecutorConfig | null;
}

interface Evidencia {
  task: string;
  /**
   * Tempo da tentativa que produziu o evento `end` - a que efetivamente
   * executou (RF-010). O tempo das tentativas barradas e o tempo em espera
   * entram apenas em `Tempo total` e em `Tempo em espera`.
   */
  wallSeconds: number;
  sessionId: string;
  tokens: number;
  turnos: number;
  negacoes: number | null;
  usouContexto: boolean;
}

/**
 * Passos 12 (loop das tasks) e 13 (encerramento) do fluxo 5.1. Nao reimplementa
 * nada das tasks 1 a 9: orquestra o adapter, o Contexto de Execucao, a
 * contabilidade, o registro e o layout.
 *
 * Tres invariantes governam este arquivo:
 * - a trava da janela e consultada ANTES de iniciar cada task, nunca no meio (RF-008);
 * - uma task DONE nunca e executada (RF-004);
 * - o resumo final e emitido em todos os encerramentos, como texto normal (RF-017).
 */
/**
 * Desfecho de UMA tentativa de execucao de task. O tipo discriminado e o que
 * torna impossivel contar uma tentativa barrada como executada (RF-017): so o
 * ramo `concluida` percorre contadores, evidencia e evento `end`.
 */
type DesfechoDaTentativa =
  | { kind: 'concluida'; motivo: RunEndMotivo | null }
  | { kind: 'barrada'; textoBruto: string };

export class TaskRunner {
  private encerrado = false;
  private resumoEmitido = false;
  private tasksExecutadas = 0;
  private tasksComErro = 0;
  private readonly evidencias: Evidencia[] = [];
  private taskCorrente: TaskInfo | null = null;
  private packPath: string | null;
  /** Conteudo do destilado na forma `prompt`; `null` nas demais formas. */
  private packConteudo: string | null = null;
  /** `false` enquanto a construcao corrente ainda nao foi entregue a ferramenta. */
  private packEntregue = false;
  /** Cancelamento do filho da task corrente (RF-024, caso extremo 24). */
  private readonly cancelamento = new AbortController();
  /** Marco do inicio do lote, para `Tempo total` do resumo e do `run_end` (RF-010). */
  private readonly inicioDoLote: number;

  private ultimoPack: PackResult | null = null;

  constructor(private readonly deps: TaskRunnerDeps) {
    this.packPath = deps.packPathInicial;
    this.inicioDoLote = deps.relogio.agora();
  }

  /**
   * Ajusta o caminho do destilado depois que o passo 11 decidiu reaproveitar ou
   * construir, e invalida a entrega anterior: a leitura do conteudo e a
   * reescrita do arquivo de apoio acontecem uma vez por construcao, nunca uma
   * vez por task.
   */
  public setPackPath(caminho: string | null): void {
    this.packPath = caminho;
    this.packConteudo = null;
    this.packEntregue = false;
  }

  /**
   * Registra o desfecho do Contexto de Execucao e ajusta o caminho do destilado
   * numa unica chamada. O desfecho e guardado porque o resumo precisa dizer
   * *por que* o lote rodou sem contexto: "por opcao (`--no-context-pack`)" e
   * "porque a construcao falhou" sao afirmacoes diferentes, e ate agora as duas
   * apareciam identicas - nada era dito.
   */
  public registrarPack(resultado: PackResult): void {
    this.ultimoPack = resultado;
    this.setPackPath(this.deps.contextPack.caminhoParaInjecao(resultado));
  }

  /**
   * Entrega o destilado a ferramenta na forma escolhida (CT-030, passo 11 da
   * secao 5.1). Roda no maximo uma vez por construcao:
   *
   * - ClaudeCode: o caminho basta, e ele ja viaja em `contextoExecucaoPath`;
   * - OpenCode/`instructions`: o arquivo de apoio recebe o caminho absoluto;
   * - OpenCode/`prompt`: o conteudo e lido uma vez e concatenado ao posicional.
   *
   * Falha de leitura ou de reescrita degrada para lote sem destilado, com
   * aviso, e nunca aborta.
   */
  private async entregarDestilado(): Promise<void> {
    if (this.packEntregue) {
      return;
    }
    this.packEntregue = true;
    this.packConteudo = null;

    const { adapter, opcoes, executorConfig } = this.deps;

    if (!adapter.capacidades.formaDeInjecaoSelecionavel) {
      return;
    }

    const caminho = this.packPath;

    switch (opcoes.contextInjection) {
      case 'instructions': {
        if (!executorConfig) {
          return;
        }
        try {
          await executorConfig.aplicarDestilado(caminho);
        } catch {
          this.packPath = null;
          this.deps.layout.message(
            'aviso',
            'nao foi possivel injetar o Contexto de Execucao - seguindo sem ele'
          );
        }
        return;
      }
      case 'prompt': {
        if (caminho === null) {
          return;
        }
        try {
          this.packConteudo = await fs.readFile(caminho, 'utf-8');
        } catch {
          this.packPath = null;
          this.deps.layout.message(
            'aviso',
            'nao foi possivel ler o Contexto de Execucao - seguindo sem ele'
          );
        }
        return;
      }
      default: {
        const _exaustivo: never = opcoes.contextInjection;
        return _exaustivo;
      }
    }
  }

  /**
   * Executa o lote na ordem numerica crescente e devolve o motivo do
   * encerramento. Nao imprime o resumo: quem o faz e `encerrar`, chamado pelo
   * comando em todos os caminhos de saida.
   */
  public async run(tasks: TaskInfo[]): Promise<RunEndMotivo> {
    const total = tasks.length;

    for (let i = 0; i < tasks.length; i += 1) {
      if (this.encerrado) {
        return 'interrompido_pelo_usuario';
      }

      const task = tasks[i];
      this.taskCorrente = task;
      const posicao = i + 1;

      if (task.done) {
        await this.deps.logger.logEvent({
          event: 'skip',
          ts: '',
          task: task.arquivo,
          motivo: 'DONE',
          selecionada: task.selecionada,
        });
        this.deps.layout.taskSkipped(task.arquivo, 'DONE', task.selecionada);
        continue;
      }

      // b. Deriva do destilado: verificada de novo antes de cada task (CT-013).
      // Em `--dry-run` nada e reconstruido: a construcao invoca a CLI de verdade
      // e a opcao promete nao invoca-la (RF-002).
      if (this.deps.opcoes.contextPack && !this.deps.opcoes.dryRun) {
        const deriva = await this.deps.contextPack.precisaReconstruir(
          this.deps.featureDir,
          this.deps.projectRoot
        );
        if (deriva.reconstruir) {
          const novo = await this.deps.contextPack.ensure(this.deps.packContexto);
          // `registrarPack` e o unico ponto que invalida a entrega anterior. A
          // atribuicao direta atualizaria o arquivo em disco e deixaria todas as
          // tasks seguintes recebendo o destilado antigo (CT-013).
          this.registrarPack(novo);

          // RF-021 vale aqui tambem: esgotada a espera durante a reconstrucao
          // entre tasks, o lote encerra com motivo de limite de uso, sem
          // reaproveitar destilado desatualizado. O passo 11 do comando ja
          // fazia essa verificacao; o mesmo `ensure()` dentro do laco nao, e o
          // lote seguia sem o destilado.
          if (novo.decisao === 'falhou' && novo.motivo === 'limite_de_uso') {
            return 'limite_de_uso';
          }
        }
      }

      const motivo = await this.executarTask(task, posicao, total);
      if (motivo) {
        return motivo;
      }

      if (this.deps.opcoes.sleep > 0 && i < tasks.length - 1) {
        await delay(this.deps.opcoes.sleep * 1000);
      }
    }

    return 'fim_da_lista';
  }

  /**
   * Trava da janela ANTES de iniciar a tentativa (RF-008), medida contra a linha
   * de base da janela (RF-019). Devolve o motivo de encerramento, ou `null`.
   */
  private async travaDaJanela(task: TaskInfo): Promise<RunEndMotivo | null> {
    if (
      this.deps.windowBudgetTokens <= 0 ||
      !this.deps.accounting.excederiaJanela(this.deps.windowBudgetTokens)
    ) {
      return null;
    }
    await this.deps.logger.logEvent({
      event: 'budget_exhausted',
      ts: '',
      tipo: 'janela',
      proxima_task: task.arquivo,
      tokens_gastos_acumulado: this.deps.accounting.total.tokensGastosAcumulado,
      window_budget_tokens: this.deps.windowBudgetTokens,
      custo_acumulado_usd: this.deps.accounting.total.custoAcumuladoUsd,
      max_budget_usd: this.deps.opcoes.maxBudgetUsd,
    });
    this.deps.layout.message(
      'aviso',
      `orcamento da janela esgotado antes de ${idDaTask(task.arquivo)}`
    );
    return 'orcamento_da_janela';
  }

  /**
   * Trava de custo ANTES de iniciar a tentativa (RF-008, passo 12c, inalterada).
   * Vale para toda ferramenta que reporte custo, inclusive as que ja tem teto
   * nativo: ali ela e rede de seguranca e so se manifesta quando o teto e de
   * fato ultrapassado, deixando intacta a execucao que nao o atinge.
   */
  private async travaDeCusto(task: TaskInfo): Promise<RunEndMotivo | null> {
    if (
      this.deps.opcoes.maxBudgetUsd <= 0 ||
      !this.deps.adapter.capacidades.relatoDeCustoEmUSD ||
      this.deps.accounting.total.custoAcumuladoUsd < this.deps.opcoes.maxBudgetUsd
    ) {
      return null;
    }
    await this.deps.logger.logEvent({
      event: 'budget_exhausted',
      ts: '',
      tipo: 'custo',
      proxima_task: task.arquivo,
      tokens_gastos_acumulado: this.deps.accounting.total.tokensGastosAcumulado,
      window_budget_tokens: this.deps.windowBudgetTokens,
      custo_acumulado_usd: this.deps.accounting.total.custoAcumuladoUsd,
      max_budget_usd: this.deps.opcoes.maxBudgetUsd,
    });
    this.deps.layout.message(
      'aviso',
      `teto de custo ultrapassado antes de ${idDaTask(task.arquivo)}`
    );
    return 'orcamento_de_custo';
  }

  /**
   * Passo 4 da secao 5.1: laco de tentativa e espera de uma unica task. A
   * tentativa barrada por limite de uso nao encerra o lote (RF-016): delega a
   * decisao ao `EsperaPorLimiteDeUso` e, na retomada, reexecuta a MESMA task do
   * inicio (RF-018), com a janela renovada (RF-019).
   */
  private async executarTask(
    task: TaskInfo,
    posicao: number,
    total: number
  ): Promise<RunEndMotivo | null> {
    let tentativa = 1;

    for (;;) {
      // a. e b. Travas de janela e de custo ANTES de iniciar cada tentativa.
      const janela = await this.travaDaJanela(task);
      if (janela) {
        return janela;
      }
      const custo = await this.travaDeCusto(task);
      if (custo) {
        return custo;
      }

      const desfecho = await this.tentarTask(task, posicao, total, tentativa);
      if (desfecho.kind === 'concluida') {
        return desfecho.motivo;
      }

      const decisao = await this.deps.espera.aguardar({
        textoBruto: desfecho.textoBruto,
        contexto: 'task',
        task: task.arquivo,
        posicao,
        total,
        tentativa,
        signal: this.cancelamento.signal,
      });

      // A interrupcao durante a espera segue o caminho de encerramento por
      // interrupcao ja existente (RF-024): o resumo parcial e o `run_end` sao
      // gravados por `encerrar`, chamado pelo comando.
      if (this.encerrado) {
        return 'interrompido_pelo_usuario';
      }

      if (!decisao.retomar) {
        this.deps.layout.message(
          'aviso',
          `${decisao.motivoDaDesistencia ?? 'limite de uso'} - encerrando o lote`
        );
        return 'limite_de_uso';
      }

      // RF-019: a espera bem-sucedida significa que a janela do provedor
      // renovou. Os totais do resumo nao sao tocados (D7).
      this.deps.accounting.renovarJanelaDeExecucao();
      tentativa += 1;
    }
  }

  /**
   * Uma unica tentativa de execucao. Devolve `barrada` quando, e somente quando,
   * a execucao FALHOU e o texto dos dois fluxos anuncia limite de uso (CT-044).
   */
  private async tentarTask(
    task: TaskInfo,
    posicao: number,
    total: number,
    tentativa: number
  ): Promise<DesfechoDaTentativa> {
    const { adapter, opcoes } = this.deps;
    await this.entregarDestilado();
    // A evidencia acompanha o que de fato foi entregue: na forma `prompt` o que
    // viaja e o conteudo, e um caminho conhecido cujo conteudo nao pode ser lido
    // nao e contexto nenhum.
    const usouCtx =
      adapter.capacidades.formaDeInjecaoSelecionavel && opcoes.contextInjection === 'prompt'
        ? this.packConteudo !== null
        : this.packPath !== null;
    const antes = this.deps.accounting.total.tokensGastosAcumulado;
    // `tokens_disponiveis_*` usam a MESMA base da trava da janela (RF-019).
    const disponivelAntes =
      this.deps.windowBudgetTokens > 0
        ? this.deps.windowBudgetTokens - this.deps.accounting.tokensDaJanela
        : null;

    await this.deps.logger.logEvent({
      event: 'start',
      ts: '',
      task: task.arquivo,
      tool: this.deps.ferramenta,
      model: opcoes.model,
      effort: opcoes.effort,
      usou_contexto_execucao: usouCtx,
      tokens_gastos_acumulado_antes: antes,
      tokens_disponiveis_antes: disponivelAntes,
    });
    this.deps.layout.taskStart({
      arquivo: task.arquivo,
      numero: task.numero,
      posicao,
      total,
      model: opcoes.model,
      effort: opcoes.effort,
      usouContextoExecucao: usouCtx,
    });

    // d. RF-018: a reexecucao e integral, do inicio, e a tentativa anterior pode
    // ter deixado arquivos alterados. O aviso sai pelo canal unico, sem rotulo
    // literal (RF-003).
    if (tentativa > 1) {
      this.deps.layout.message(
        'aviso',
        `${idDaTask(task.arquivo)} [${posicao}/${total}]: tentativa ${tentativa} - a tentativa anterior foi interrompida por limite de uso e pode ter deixado trabalho parcial no diretorio`
      );
    }

    const inicio = this.deps.relogio.agora();
    const entrada: BuildTaskArgsInput = {
      taskPath: task.caminho,
      opcoes,
      extraDirs: this.deps.extraDirs,
      contextoExecucaoPath: this.packPath,
      contextoExecucaoConteudo: this.packConteudo,
    };

    let resultado: TaskResult;
    if (opcoes.dryRun) {
      const args = this.deps.adapter.buildTaskArgs(entrada);
      this.deps.layout.message(
        'info',
        `dry-run: ${getExecutavel(this.deps.ferramenta)} ${resumirArgs(
          args,
          this.packConteudo
        ).join(' ')}`
      );
      resultado = resultadoDryRun();
    } else {
      resultado = await this.deps.adapter.runTask(
        entrada,
        this.deps.cwd,
        (chunk) => this.deps.logger.appendStderr(chunk),
        this.cancelamento.signal
      );
    }

    // A task morta pela interrupcao nao vira concluida (RF-024): nao entra na
    // contabilidade, nao gera `end` e nao aparece nas evidencias do resumo.
    if (this.encerrado) {
      return { kind: 'concluida', motivo: 'interrompido_pelo_usuario' };
    }

    const wallSeconds = Math.round((this.deps.relogio.agora() - inicio) / 1000);

    // g. Gatilho de CT-044. O conteudo do fluxo de erro NAO classifica a
    // execucao como falha: CLIs escrevem aviso e diagnostico no `stderr` de
    // execucoes bem-sucedidas, e usa-lo como criterio reintroduziria o falso
    // positivo que RF-014 existe para eliminar.
    const falhou = resultado.isError || resultado.exitCode !== 0;
    const textoBruto = `${resultado.rawStdout}\n${resultado.rawStderr}`;

    if (falhou && !opcoes.dryRun && adapter.detectRateLimit(textoBruto)) {
      // RF-017: os tokens gastos SAO contabilizados - foram gastos de fato -,
      // mas a tentativa nao gera `end`, nao incrementa contador algum, nao
      // produz evidencia e nao chama `layout.taskEnd`.
      this.deps.accounting.accumulate(resultado);
      const renovacao = determinarRenovacao(textoBruto, this.deps.relogio.agora());
      const origem: OrigemHorario = renovacao === null ? 'sondagem' : 'informado';
      await this.deps.logger.logEvent({
        event: 'rate_limited',
        ts: '',
        task: task.arquivo,
        tentativa,
        renovacao_prevista: renovacao === null ? null : renovacao.toISOString(),
        origem_horario: origem,
        contexto: 'task',
      });
      return { kind: 'barrada', textoBruto };
    }

    const { tokensDaTask, custoDaTask } = this.deps.accounting.accumulate(resultado);

    // RF-018: uma task que terminou sem erro mas ainda nao esta DONE nao esta
    // certificada. O arquivo e relido porque a propria task pode te-lo marcado.
    let doneAgora = false;
    if (!opcoes.dryRun) {
      try {
        doneAgora = STATUS_DONE_PATTERN.test(await fs.readFile(task.caminho, 'utf-8'));
      } catch {
        doneAgora = false;
      }
    }
    const semCertificacao = !opcoes.dryRun && !resultado.isError && !doneAgora;

    const estado: StatusKind = resultado.isError ? 'erro' : semCertificacao ? 'aviso' : 'ok';
    this.deps.layout.taskEnd({
      arquivo: task.arquivo,
      numero: task.numero,
      posicao,
      total,
      estado,
      sessionId: resultado.sessionId,
      numTurns: resultado.numTurns,
      wallSeconds,
      tokensDaTask,
      custoDaTaskUsd: custoDaTask,
      reasoningTokens: resultado.reasoningTokens,
      permissionDenials: resultado.permissionDenials,
      semCertificacao,
    });

    const depois = this.deps.accounting.total.tokensGastosAcumulado;
    const endEvent: RunEventEnd = {
      event: 'end',
      ts: '',
      task: task.arquivo,
      tool: this.deps.ferramenta,
      model_solicitado: opcoes.model,
      modelos_reportados: resultado.modelosReportados,
      effort: opcoes.effort,
      session_id: resultado.sessionId,
      subtype: resultado.subtype,
      is_error: resultado.isError,
      exit_code: resultado.exitCode,
      usou_contexto_execucao: usouCtx,
      permission_denials: resultado.permissionDenials,
      ferramentas_negadas: resultado.ferramentasNegadas,
      num_turns: resultado.numTurns,
      duration_ms: resultado.durationMs,
      duration_api_ms: resultado.durationApiMs,
      wall_seconds: wallSeconds,
      input_tokens: resultado.inputTokens,
      output_tokens: resultado.outputTokens,
      cache_creation_input_tokens: resultado.cacheCreationInputTokens,
      cache_read_input_tokens: resultado.cacheReadInputTokens,
      reasoning_tokens: resultado.reasoningTokens,
      contabilidade_parcial: resultado.contabilidadeParcial,
      sem_certificacao: semCertificacao,
      tokens_gastos_task: tokensDaTask,
      tokens_gastos_acumulado_depois: depois,
      tokens_disponiveis_depois:
        this.deps.windowBudgetTokens > 0
          ? this.deps.windowBudgetTokens - this.deps.accounting.tokensDaJanela
          : null,
      custo_task_usd: this.deps.accounting.formatCustoExibicao(custoDaTask),
      custo_acumulado_usd: this.deps.accounting.formatCustoRegistro(
        this.deps.accounting.total.custoAcumuladoUsd
      ),
    };
    if (opcoes.dryRun) {
      // `dry_run` nao esta no schema de `end` de CT-011, mas a guarda de
      // tasks nao certificadas precisa distinguir estas linhas (RF-018).
      await this.deps.logger.logEvent(
        Object.assign({}, endEvent, { dry_run: true }) as unknown as RunEvent
      );
    } else {
      await this.deps.logger.logEvent(endEvent);
    }

    this.evidencias.push({
      task: task.arquivo,
      wallSeconds,
      sessionId: resultado.sessionId,
      tokens: tokensDaTask,
      turnos: resultado.numTurns,
      negacoes: resultado.permissionDenials,
      usouContexto: usouCtx,
    });
    this.tasksExecutadas += 1;
    if (resultado.isError) {
      this.tasksComErro += 1;
    }

    // Passo 12f: o aviso depende da CAPACIDADE, nao do valor. Ferramenta que nao
    // reporta o dado nao pode produzir silencio indistinguivel de "nenhum
    // problema" (RF-010).
    if (
      this.deps.adapter.capacidades.relatoDeNegacoesDePermissao &&
      resultado.permissionDenials !== null &&
      resultado.permissionDenials > 0
    ) {
      this.deps.layout.message(
        'aviso',
        `${resultado.permissionDenials} permissao(oes) negada(s) - a task pode ter escrito codigo sem valida-lo`
      );
    }
    if (semCertificacao) {
      this.deps.layout.message(
        'aviso',
        `${idDaTask(task.arquivo)} nao certificada: terminou com sucesso mas nao esta DONE`
      );
    }

    // Falha real de task: caminho inalterado, `--stop-on-failure` decide.
    if (resultado.isError) {
      this.deps.layout.message('erro', `${idDaTask(task.arquivo)} terminou com erro`);
      if (opcoes.stopOnFailure) {
        return { kind: 'concluida', motivo: 'falha_na_task' };
      }
    }

    return { kind: 'concluida', motivo: null };
  }

  /**
   * SIGINT/SIGTERM (RF-024). Mata o filho da task corrente e a construcao do
   * destilado, marca o lote como encerrado, grava `interrompido` e anuncia o
   * motivo. NAO grava `run_end` nem imprime o resumo: quem faz isso e `encerrar`,
   * chamado pelo comando depois que `run()` devolve o controle — foi justamente
   * o `process.exit` disparado aqui dentro que fazia o resumo parcial e o
   * `run_end` se perderem.
   *
   * A ordem e deliberada: primeiro o motivo (`interrompido pelo usuario`),
   * depois o resumo, que e a leitura natural.
   */
  public async interromper(): Promise<void> {
    this.encerrado = true;
    this.deps.contextPack.abort();
    this.cancelamento.abort();
    await this.deps.logger.logEvent({
      event: 'interrompido',
      ts: '',
      task: this.taskCorrente?.arquivo ?? '',
      tasks_concluidas: this.tasksExecutadas,
      total_tasks: this.deps.totalTasks,
    });
    // Encerra o indicador antes de escrever: um aviso no meio da animacao
    // seria sobrescrito pelo proximo quadro (RNF-004).
    this.deps.layout.dispose();
    this.deps.layout.message('aviso', 'interrompido pelo usuario');
    this.deps.layout.message(
      'info',
      `${this.tasksExecutadas} de ${this.deps.totalTasks} concluidas`
    );
  }

  /**
   * Passo 13. Grava `run_end`, restaura o terminal via `layout.dispose()`,
   * imprime o resumo como texto normal e fecha o registro. Idempotente: so a
   * primeira chamada tem efeito.
   */
  public async encerrar(motivo: RunEndMotivo): Promise<void> {
    if (this.resumoEmitido) {
      return;
    }
    this.resumoEmitido = true;

    const total = this.deps.accounting.total;
    await this.deps.logger.logEvent({
      event: 'run_end',
      ts: '',
      motivo,
      tasks_executadas: this.tasksExecutadas,
      tasks_com_erro: this.tasksComErro,
      tokens_gastos_total: total.tokensGastosAcumulado,
      custo_total_usd: this.deps.accounting.formatCustoRegistro(total.custoAcumuladoUsd),
      // Numericas e cruas, em segundos (CT-043, RF-010).
      tempo_total_segundos: this.tempoTotalSegundos(),
      tempo_em_espera_segundos: this.deps.espera.acumuladoSegundos,
      // CT-050: uma construcao morta por SIGTERM gastou tokens que nenhum JSON
      // final relata. Sem estes dois campos, o registro afirma custo zero para
      // um run que custou dinheiro.
      consumo_nao_contabilizado: this.consumoNaoContabilizado() > 0,
      duracao_nao_contabilizada_segundos: this.consumoNaoContabilizado(),
    });

    // Remocao em melhor esforco do arquivo de apoio de execucao (CT-035): ela
    // vem antes do resumo para que uma falha silenciosa nao atrase a saida.
    if (this.deps.executorConfig) {
      await this.deps.executorConfig.remover().catch(() => undefined);
    }

    // Provedor por assinatura reporta custo zero em todos os passos: sem este
    // aviso o usuario que informou `--max-budget-usd` acreditaria estar protegido
    // por uma trava que jamais poderia disparar. Nenhuma estimativa de preco e
    // calculada. `encerrar` e idempotente, entao o aviso sai uma unica vez.
    if (
      this.deps.adapter.capacidades.relatoDeCustoEmUSD &&
      this.deps.accounting.custoZeroNaoReportado
    ) {
      this.deps.layout.message(
        'aviso',
        'o provedor configurado nao reportou custo - o teto de custo nao teve efeito neste lote'
      );
    }

    this.deps.layout.dispose();
    // RF-025: um lote cancelado na confirmacao nao comecou - nao gera resumo,
    // gera uma linha, escrita pelo comando. O fechamento do registro continua
    // obrigatorio, que e o que `encerrar` guarda num lugar so.
    if (motivo !== 'cancelado_na_confirmacao') {
      this.deps.layout.summary(this.montarResumo(motivo));
    }
    await this.deps.logger.close();
  }

  /** Duracao das tentativas de construcao mortas por SIGTERM (CT-050). */
  private consumoNaoContabilizado(): number {
    return this.deps.contextPack.consumoNaoContabilizadoSegundos;
  }

  /**
   * Linha de contexto do resumo (RF-010). Existe porque `sem contexto` tinha
   * duas causas indistinguiveis na tela: a opcao `--no-context-pack` e a falha
   * da construcao.
   */
  private linhaDeContexto(): string | null {
    const pack = this.ultimoPack;
    if (pack === null) {
      return null;
    }
    switch (pack.decisao) {
      case 'desligado':
        return '  Contexto           sem contexto por opcao (--no-context-pack)';
      case 'falhou':
        return `  Contexto           sem contexto por falha na construcao (${pack.motivo})`;
      case 'interrompido':
        return '  Contexto           sem contexto: construcao interrompida';
      case 'reaproveitado':
        return '  Contexto           destilado reaproveitado';
      case 'construido':
        return '  Contexto           destilado construido nesta execucao';
      default:
        return null;
    }
  }

  /** Duracao do lote inteiro, do inicio ate o encerramento (RF-010). */
  private tempoTotalSegundos(): number {
    return Math.max(0, Math.round((this.deps.relogio.agora() - this.inicioDoLote) / 1000));
  }

  private montarResumo(motivo: RunEndMotivo): string[] {
    const total = this.deps.accounting.total;
    const emEspera = this.deps.espera.acumuladoSegundos;
    const linhas = [
      '',
      'Resumo da execucao',
      `  Motivo             ${motivo}`,
      `  Tempo total        ${formatarDuracao(this.tempoTotalSegundos())}`,
    ];

    // RF-010: a linha de espera aparece se, e somente se, houve espera.
    if (emEspera > 0) {
      linhas.push(`  Tempo em espera    ${formatarDuracao(emEspera)}`);
    }

    linhas.push(
      `  Tasks executadas   ${this.tasksExecutadas}`,
      `  Tasks com erro     ${this.tasksComErro}`,
      `  Tokens totais      ${this.deps.accounting.formatMilhar(total.tokensGastosAcumulado)}`,
      `  Raciocinio         ${
        this.deps.accounting.raciocinioReportado
          ? this.deps.accounting.formatMilhar(total.reasoningTokens)
          : 'nao reportado'
      }`,
      `  Custo acumulado    $${this.deps.accounting.formatCustoExibicao(total.custoAcumuladoUsd)}`
    );

    // CT-050: o consumo de uma construcao morta nao esta em `Tokens totais` nem
    // em `Custo acumulado`, e nao ha como estima-lo. A linha existe para que o
    // resumo nao afirme, por omissao, que o lote nao custou nada.
    const naoContabilizado = this.consumoNaoContabilizado();
    if (naoContabilizado > 0) {
      linhas.push(
        `  Nao contabilizado  ${formatarDuracao(naoContabilizado)} de construcao do Contexto de Execucao nao concluida`
      );
    }

    const contexto = this.linhaDeContexto();
    if (contexto !== null) {
      linhas.push(contexto);
    }

    if (this.deps.windowBudgetTokens > 0) {
      linhas.push(
        `  Orcamento janela   ${this.deps.accounting.formatMilhar(
          total.tokensGastosAcumulado
        )} / ${this.deps.accounting.formatMilhar(this.deps.windowBudgetTokens)} tokens`
      );
    }

    linhas.push('  Evidencias:');
    if (this.evidencias.length === 0) {
      linhas.push('    (nenhuma task executada)');
    }
    for (const ev of this.evidencias) {
      linhas.push(
        `    ${idDaTask(ev.task)}  tempo=${formatarDuracao(ev.wallSeconds)}  sessao=${ev.sessionId}  tokens=${ev.tokens}  turnos=${ev.turnos}  neg=${ev.negacoes === null ? 'n/d' : ev.negacoes}  ctx=${ev.usouContexto ? 'sim' : 'nao'}`
      );
    }

    return linhas;
  }
}
