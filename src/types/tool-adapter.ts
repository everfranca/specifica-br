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
  permissionDenials: number;
  ferramentasNegadas: string | null;
  rawStdout: string;
  rawStderr: string;
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
  parseResult(exitCode: number, rawStdout: string, rawStderr: string): TaskResult;
  detectRateLimit(rawOutput: string): boolean;
  getVersion(): Promise<string>;
  listMcps(mcpsDeclarados: string[], timeoutSegundos: number): Promise<McpCheckResult[]>;

  modoDePermissaoEfetivo(opcoes: ExecutarTasksOptions): string;
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
    signal?: AbortSignal
  ): Promise<TaskResult>;
}
