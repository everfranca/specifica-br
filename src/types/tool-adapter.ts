import type { ToolSlug } from './config.js';
import type { EffortLevel, ExecutarTasksOptions } from './executar-tasks.js';

export interface ToolCapabilities {
  execucaoNaoInterativa: boolean;
  modoSemPromptDePermissao: boolean;
  saidaEstruturadaComTokens: boolean;
  identificadorDeSessao: boolean;
  injecaoDeContextoNoSystemPrompt: boolean;
  liberacaoDeDiretoriosDeLeitura: boolean;
  consultaAosMcps: boolean;
  relatoDeCustoEmUSD: boolean;
  tetoDeCustoNativo: boolean;
  modeloDeFallback: boolean;
  otimizacaoDeCacheDePrompt: boolean;
  relatoDeNegacoesDePermissao: boolean;
  formaDeInjecaoSelecionavel: boolean;
  /**
   * CT-047: a ferramenta relata o modelo que de fato usou, e nao apenas o eco do
   * solicitado. Governa EXCLUSIVAMENTE o aviso de divergencia de RF-013; nao
   * desliga a gravacao de `pack_model_efetivo`, que e dado de auditoria.
   */
  relatoDeModeloEfetivo: boolean;
}

export interface TaskResult {
  sessionId: string;
  subtype: string;
  isError: boolean;
  exitCode: number;
  numTurns: number;
  durationMs: number;
  durationApiMs: number;
  costUsd: number;
  model: string;
  modelosReportados: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  reasoningTokens: number | null;
  permissionDenials: number | null;
  ferramentasNegadas: string | null;
  contabilidadeParcial: boolean;
  rawStdout: string;
  rawStderr: string;
  /**
   * CT-049: sinal que encerrou o processo filho, quando houve um. Ausente ou
   * `null` significa saida por codigo. Um filho morto por sinal NUNCA pode ser
   * lido como saida limpa, e este campo e o que torna os dois casos
   * distinguiveis na leitura posterior do registro.
   */
  signal?: NodeJS.Signals | null;
  /** CT-049: o filho foi morto por cancelamento explicito (`AbortSignal`). */
  aborted?: boolean;
  /** CT-049: o filho foi morto pelo teto de tempo do chamador. */
  timedOut?: boolean;
}

/**
 * Como o processo filho terminou, do ponto de vista do `ProcessRunner` (CT-049).
 * Chega a `parseResult` para que sinal, cancelamento e teto de tempo nao sejam
 * normalizados como uma saida limpa de codigo zero.
 */
export interface DesfechoDoFilho {
  signal?: NodeJS.Signals | null;
  aborted?: boolean;
  timedOut?: boolean;
}

export interface BuildTaskArgsInput {
  taskPath: string;
  opcoes: ExecutarTasksOptions;
  extraDirs: string[];
  contextoExecucaoPath: string | null;
  contextoExecucaoConteudo: string | null;
}

export interface McpCheckResult {
  nome: string;
  severidade: 'OK' | 'AVISO';
  linha: string | null;
}

export interface BuildContextPackArgsInput {
  featureDir: string;
  packModel: string;
  packEffort: EffortLevel;
  cacheTuning: boolean;
}

export interface ToolAdapter {
  readonly slug: ToolSlug;
  readonly contratoValidado: boolean;
  readonly capacidades: ToolCapabilities;

  buildTaskArgs(entrada: BuildTaskArgsInput): string[];
  buildContextPackArgs(prompt: string, entrada: BuildContextPackArgsInput): string[];
  buildEnv(cacheTuning: boolean, envBase?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  parseResult(
    exitCode: number,
    rawStdout: string,
    rawStderr: string,
    desfecho?: DesfechoDoFilho
  ): TaskResult;
  detectRateLimit(rawOutput: string): boolean;
  getVersion(): Promise<string>;
  listMcps(mcpsDeclarados: string[], timeoutSegundos: number): Promise<McpCheckResult[]>;

  modoDePermissaoEfetivo(
    opcoes: Pick<ExecutarTasksOptions, 'autoApprove' | 'permissionMode'>
  ): string;
  resolveExtraDirs(opcoes: ExecutarTasksOptions, home: string, cwd: string): Promise<string[]>;
  mcpListRaw(timeoutSegundos: number): Promise<string | null>;
  interpretMcpStatus(saida: string | null, nomes: string[]): Map<string, 'OK' | 'AVISO'>;
  runTask(
    entrada: BuildTaskArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult>;
  runPack(
    prompt: string,
    entrada: BuildContextPackArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<TaskResult>;
}
