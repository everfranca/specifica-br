import fs from 'fs-extra';
import type {
  ExecutarTasksOptions,
  PackResult,
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
import { STATUS_DONE_PATTERN } from './task-discovery-patterns.js';
import { getExecutavel } from './tool-adapters/tool-registry.js';

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
    permissionDenials: 0,
    ferramentasNegadas: null,
    rawStdout: '',
    rawStderr: '',
  };
}

/**
 * Recusa, sem abortar, as opcoes que dependem de uma capacidade que a ferramenta
 * nao tem (RF-012). Cada recusa vira um `[ AVIS]` nominal e a funcionalidade e
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

  if (!capacidades.liberacaoDeDiretoriosDeLeitura && opcoes.skillDirs) {
    avisos.push(
      `diretorios extras de skills ignorados: ${nomeFerramenta} nao libera diretorios de leitura`
    );
    ajustado.skillDirs = false;
  }

  if (!capacidades.consultaAosMcps && opcoes.mcpCheck) {
    avisos.push(`verificacao de MCPs desligada: ${nomeFerramenta} nao consulta MCPs`);
    ajustado.mcpCheck = false;
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

export interface TaskRunnerDeps {
  adapter: RunnerToolAdapter;
  contextPack: RunnerContextPack;
  accounting: AccountingService;
  logger: RunnerLogger;
  layout: LayoutRenderer;
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
}

interface Evidencia {
  task: string;
  sessionId: string;
  tokens: number;
  turnos: number;
  negacoes: number;
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
export class TaskRunner {
  private encerrado = false;
  private resumoEmitido = false;
  private tasksExecutadas = 0;
  private tasksComErro = 0;
  private readonly evidencias: Evidencia[] = [];
  private taskCorrente: TaskInfo | null = null;
  private packPath: string | null;
  /** Cancelamento do filho da task corrente (RF-024, caso extremo 24). */
  private readonly cancelamento = new AbortController();

  constructor(private readonly deps: TaskRunnerDeps) {
    this.packPath = deps.packPathInicial;
  }

  /** Ajusta o caminho do destilado depois que o passo 11 decidiu reaproveitar ou construir. */
  public setPackPath(caminho: string | null): void {
    this.packPath = caminho;
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
          this.packPath = this.deps.contextPack.caminhoParaInjecao(novo);
        }
      }

      // c. Trava da janela ANTES de iniciar a task (RF-008).
      if (
        this.deps.windowBudgetTokens > 0 &&
        this.deps.accounting.excederiaJanela(this.deps.windowBudgetTokens)
      ) {
        await this.deps.logger.logEvent({
          event: 'budget_exhausted',
          ts: '',
          proxima_task: task.arquivo,
          tokens_gastos_acumulado: this.deps.accounting.total.tokensGastosAcumulado,
          window_budget_tokens: this.deps.windowBudgetTokens,
        });
        this.deps.layout.message(
          'aviso',
          `orcamento da janela esgotado antes de ${idDaTask(task.arquivo)}`
        );
        return 'orcamento_da_janela';
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

  private async executarTask(
    task: TaskInfo,
    posicao: number,
    total: number
  ): Promise<RunEndMotivo | null> {
    const { opcoes } = this.deps;
    const usouCtx = this.packPath !== null;
    const antes = this.deps.accounting.total.tokensGastosAcumulado;
    const disponivelAntes =
      this.deps.windowBudgetTokens > 0 ? this.deps.windowBudgetTokens - antes : null;

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

    const inicio = Date.now();
    const entrada: BuildTaskArgsInput = {
      taskPath: task.caminho,
      opcoes,
      extraDirs: this.deps.extraDirs,
      contextoExecucaoPath: this.packPath,
      contextoExecucaoConteudo: null,
    };

    let resultado: TaskResult;
    if (opcoes.dryRun) {
      const args = this.deps.adapter.buildTaskArgs(entrada);
      this.deps.layout.message(
        'info',
        `dry-run: ${getExecutavel(this.deps.ferramenta)} ${args.join(' ')}`
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
      return 'interrompido_pelo_usuario';
    }

    const wallSeconds = Math.round((Date.now() - inicio) / 1000);
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
      sem_certificacao: semCertificacao,
      tokens_gastos_task: tokensDaTask,
      tokens_gastos_acumulado_depois: depois,
      tokens_disponiveis_depois:
        this.deps.windowBudgetTokens > 0 ? this.deps.windowBudgetTokens - depois : null,
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

    if (resultado.permissionDenials > 0) {
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

    if (
      !opcoes.dryRun &&
      this.deps.adapter.detectRateLimit(`${resultado.rawStdout}\n${resultado.rawStderr}`)
    ) {
      await this.deps.logger.logEvent({ event: 'rate_limited', ts: '', task: task.arquivo });
      this.deps.layout.message('aviso', 'limite de uso atingido - interrompendo o loop');
      return 'limite_de_uso';
    }

    if (resultado.isError) {
      this.deps.layout.message('erro', `${idDaTask(task.arquivo)} terminou com erro`);
      if (opcoes.stopOnFailure) {
        return 'falha_na_task';
      }
    }

    return null;
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
    // Encerra o indicador antes de escrever: um `[ AVIS]` no meio da animacao
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
    });

    this.deps.layout.dispose();
    this.deps.layout.summary(this.montarResumo(motivo));
    await this.deps.logger.close();
  }

  private montarResumo(motivo: RunEndMotivo): string[] {
    const total = this.deps.accounting.total;
    const linhas = [
      '',
      'Resumo da execucao',
      `  Motivo             ${motivo}`,
      `  Tasks executadas   ${this.tasksExecutadas}`,
      `  Tasks com erro     ${this.tasksComErro}`,
      `  Tokens totais      ${this.deps.accounting.formatMilhar(total.tokensGastosAcumulado)}`,
      `  Custo acumulado    $${this.deps.accounting.formatCustoExibicao(total.custoAcumuladoUsd)}`,
    ];

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
        `    ${idDaTask(ev.task)}  sessao=${ev.sessionId}  tokens=${ev.tokens}  turnos=${ev.turnos}  neg=${ev.negacoes}  ctx=${ev.usouContexto ? 'sim' : 'nao'}`
      );
    }

    return linhas;
  }
}
