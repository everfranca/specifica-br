/**
 * Tipos de invocacao de processo filho consumidos pelas tasks 5, 7 e 8.
 *
 * Arquivo sem codigo executavel: apenas contratos. A implementacao vive em
 * `src/utils/process-runner.ts` e `src/utils/project-identity.ts`.
 */

/**
 * Opcoes de uma invocacao via `ProcessRunner.run`.
 */
export interface RunOptions {
  /** Diretorio de trabalho do processo filho. Default: herda do processo atual. */
  cwd?: string;
  /**
   * Timeout em milissegundos. Quando ausente ou zero, nao ha timeout: e o caso
   * da execucao de task (CT-020), cuja duracao e por natureza desconhecida.
   */
  timeoutMs?: number;
  /** Ambiente do processo filho. Default: `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Modo do stdin do filho. Default `'ignore'` (fixado pela techspec em CT-022). */
  stdin?: 'ignore' | 'inherit';
  /**
   * Recebe cada pedaco de `stderr` assim que chega. Existe para a task-6 anexar
   * o `stderr` do filho a `run_<RUN_ID>.stderr` (CT-012) sem que o
   * `ProcessRunner` conheca o logger.
   */
  onStderrChunk?: (chunk: string) => void;
  /**
   * Cancelamento explicito do filho (RF-024, RNF-007). Ao abortar, o filho recebe
   * `SIGTERM` e, se sobreviver ao periodo de cortesia, `SIGKILL` — a mesma
   * disciplina do timeout. Existe porque no Windows nao ha grupo de processo
   * POSIX: sem esta via, um Ctrl+C deixaria a CLI da IA rodando orfa.
   */
  signal?: AbortSignal;
}

/**
 * Resultado normalizado de uma invocacao via `ProcessRunner.run`.
 */
export interface RunResult {
  /** Codigo de saida do processo, ou `-1` quando `spawnFailed` e verdadeiro. */
  exitCode: number;
  /** Sinal que encerrou o processo, ou `null`. */
  signal: NodeJS.Signals | null;
  /** `stdout` acumulado como UTF-8. */
  stdout: string;
  /** `stderr` acumulado como UTF-8. */
  stderr: string;
  /** Verdadeiro quando o processo foi encerrado por timeout (SIGTERM/SIGKILL). */
  timedOut: boolean;
  /** Verdadeiro quando o processo foi morto por cancelamento explicito (`signal`). */
  aborted: boolean;
  /** Verdadeiro quando o executavel nao foi resolvido ou o `spawn` falhou. */
  spawnFailed: boolean;
}

/**
 * Identificador de projeto resolvido por `ProjectIdentityService.resolve` (CT-024).
 */
export interface ProjectIdentity {
  /** Nome ja sanitizado, seguro como nome de diretorio. */
  nome: string;
  /** Nivel de resolucao que produziu o nome. */
  origem: 'git-remote' | 'git-toplevel' | 'cwd';
  /** Nome antes da sanitizacao, util para diagnostico e para o cabecalho. */
  bruto: string;
}
