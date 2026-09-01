import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import type { ExecutarTasksOptions } from '../../types/executar-tasks.js';
import type {
  BuildContextPackArgsInput,
  BuildTaskArgsInput,
  McpCheckResult,
  TaskResult,
  ToolAdapter,
  ToolCapabilities,
} from '../../types/tool-adapter.js';
import type { ToolSlug } from '../../types/config.js';
import { ProcessRunner, processRunner } from '../process-runner.js';
import { detectRateLimit } from './rate-limit.js';
import { getExecutavel } from './tool-registry.js';

const CLI_VERSION_TIMEOUT_MS = 5000;

const CAPACIDADES_CLAUDECODE: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: true,
  consultaAosMcps: true,
};

interface RespostaClaudeCode {
  session_id?: unknown;
  subtype?: unknown;
  is_error?: unknown;
  num_turns?: unknown;
  duration_ms?: unknown;
  duration_api_ms?: unknown;
  total_cost_usd?: unknown;
  model?: unknown;
  usage?: Record<string, unknown>;
  modelUsage?: Record<string, Record<string, unknown>>;
  permission_denials?: unknown;
}

/**
 * Escapa os metacaracteres de expressao regular de um texto vindo de fonte externa
 * (aqui, o nome de um MCP declarado no arquivo da task), para que um nome com `.`
 * ou `*` seja buscado literalmente e nao como padrao.
 */
function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numeroOuZero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

/**
 * Adapter da CLI `claude` (ClaudeCode), o unico contrato de execucao validado nesta
 * versao. Monta o argv de CT-020 e CT-021, normaliza a resposta `--output-format json`
 * seguindo a regra de contabilidade de CT-020 e detecta o limite de uso de RF-019.
 */
export class ClaudeCodeAdapter implements ToolAdapter {
  public readonly slug: ToolSlug = 'claudecode';
  public readonly contratoValidado = true;
  public readonly capacidades: ToolCapabilities = CAPACIDADES_CLAUDECODE;

  constructor(private readonly runner: ProcessRunner = processRunner) {}

  /**
   * Modo de permissao efetivo de CT-020: `--permission-mode` informado vence; senao
   * `bypassPermissions` quando `--auto-approve`; senao vazio, e nenhuma flag e passada
   * (o preflight da task-7 classifica isso como ERRO).
   */
  public modoDePermissaoEfetivo(opcoes: ExecutarTasksOptions): string {
    if (opcoes.permissionMode) {
      return opcoes.permissionMode;
    }

    if (opcoes.autoApprove) {
      return 'bypassPermissions';
    }

    return '';
  }

  /**
   * Argv de CT-020 na ordem estavel. `extraDirs` ja chega resolvido (somente
   * diretorios existentes) por `resolveExtraDirs`, porque a montagem do argv e
   * sincrona e a verificacao de existencia nao e.
   */
  public buildTaskArgs(entrada: BuildTaskArgsInput): string[] {
    const { taskPath, opcoes, extraDirs, contextoExecucaoPath } = entrada;

    const args: string[] = [
      '-p',
      `/executar-task ${taskPath}`,
      '--output-format',
      'json',
      '--model',
      opcoes.model,
      '--effort',
      opcoes.effort,
    ];

    const modo = this.modoDePermissaoEfetivo(opcoes);
    if (modo) {
      args.push('--permission-mode', modo);
    }

    for (const dir of extraDirs) {
      args.push('--add-dir', dir);
    }

    if (opcoes.fallbackModel) {
      args.push('--fallback-model', opcoes.fallbackModel);
    }

    for (const regra of opcoes.allow) {
      args.push('--allowedTools', regra);
    }

    if (opcoes.maxBudgetUsd > 0) {
      args.push('--max-budget-usd', String(opcoes.maxBudgetUsd));
    }

    if (contextoExecucaoPath) {
      args.push('--append-system-prompt-file', contextoExecucaoPath);
    }

    if (opcoes.cacheTuning) {
      args.push('--exclude-dynamic-system-prompt-sections');
    }

    return args;
  }

  /**
   * Argv de CT-021. O `prompt` ja chega interpolado: a deriva por mtime, o teto de
   * tamanho e as mensagens sao orquestracao da task-8.
   */
  public buildContextPackArgs(prompt: string, entrada: BuildContextPackArgsInput): string[] {
    const args: string[] = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--model',
      entrada.packModel,
      '--effort',
      entrada.packEffort,
      '--permission-mode',
      'acceptEdits',
    ];

    if (entrada.cacheTuning) {
      args.push('--exclude-dynamic-system-prompt-sections');
    }

    return args;
  }

  /**
   * Ambiente do processo filho: `{ ...envBase }` mais `CLAUDE_CODE_PROMPT_CACHE_TTL=1h`
   * somente quando o cache tuning esta ligado e a variavel ainda nao esta definida
   * (ENV-001). Nenhuma outra variavel e criada, alterada ou removida.
   */
  public buildEnv(cacheTuning: boolean, envBase: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...envBase };

    if (cacheTuning && env.CLAUDE_CODE_PROMPT_CACHE_TTL === undefined) {
      env.CLAUDE_CODE_PROMPT_CACHE_TTL = '1h';
    }

    return env;
  }

  /**
   * Diretorios extras de leitura de CT-020: `<home>/.claude/skills` e
   * `<cwd>/.claude/skills`, cada um apenas se existir. Vazio quando `--no-skill-dirs`
   * foi informada (`opcoes.skillDirs === false`).
   */
  public async resolveExtraDirs(
    opcoes: ExecutarTasksOptions,
    home: string,
    cwd: string
  ): Promise<string[]> {
    if (!opcoes.skillDirs) {
      return [];
    }

    const candidatos = [
      path.join(home, '.claude', 'skills'),
      path.join(cwd, '.claude', 'skills'),
    ];

    const existentes: string[] = [];
    for (const candidato of candidatos) {
      if (await fs.pathExists(candidato)) {
        existentes.push(candidato);
      }
    }

    return existentes;
  }

  private resultadoDegradado(
    exitCode: number,
    rawStdout: string,
    rawStderr: string,
    sessionId = '?'
  ): TaskResult {
    return {
      sessionId,
      subtype: 'parse_error',
      isError: true,
      exitCode,
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
      rawStdout,
      rawStderr,
    };
  }

  /**
   * Normaliza a resposta de CT-020. A regra de contabilidade e excludente: quando
   * `modelUsage` existe e tem ao menos uma chave, os quatro contadores sao a soma de
   * todas as entradas (porque `usage` ignora subagentes); so na ausencia de
   * `modelUsage` se cai para `usage`, com `0` para campo faltante.
   */
  public parseResult(exitCode: number, rawStdout: string, rawStderr: string): TaskResult {
    if (exitCode !== 0) {
      return this.resultadoDegradado(exitCode, rawStdout, rawStderr);
    }

    let parsed: RespostaClaudeCode;
    try {
      parsed = JSON.parse(rawStdout) as RespostaClaudeCode;
    } catch {
      return this.resultadoDegradado(exitCode, rawStdout, rawStderr);
    }

    const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id : '?';

    if (parsed.is_error === true) {
      return this.resultadoDegradado(exitCode, rawStdout, rawStderr, sessionId);
    }

    const modelUsage = parsed.modelUsage;
    const temModelUsage =
      typeof modelUsage === 'object' &&
      modelUsage !== null &&
      Object.keys(modelUsage).length > 0;

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationInputTokens = 0;
    let cacheReadInputTokens = 0;

    if (temModelUsage) {
      for (const entrada of Object.values(modelUsage as Record<string, Record<string, unknown>>)) {
        inputTokens += numeroOuZero(entrada.inputTokens);
        outputTokens += numeroOuZero(entrada.outputTokens);
        cacheCreationInputTokens += numeroOuZero(entrada.cacheCreationInputTokens);
        cacheReadInputTokens += numeroOuZero(entrada.cacheReadInputTokens);
      }
    } else {
      const usage = (parsed.usage ?? {}) as Record<string, unknown>;
      inputTokens = numeroOuZero(usage.input_tokens);
      outputTokens = numeroOuZero(usage.output_tokens);
      cacheCreationInputTokens = numeroOuZero(usage.cache_creation_input_tokens);
      cacheReadInputTokens = numeroOuZero(usage.cache_read_input_tokens);
    }

    const model = typeof parsed.model === 'string' ? parsed.model : '';
    const modelosReportados = temModelUsage
      ? Object.keys(modelUsage as Record<string, unknown>).join(',')
      : model;

    const denials = Array.isArray(parsed.permission_denials) ? parsed.permission_denials : [];
    const ferramentas: string[] = [];
    for (const denial of denials) {
      const nome = (denial as Record<string, unknown>)?.tool_name;
      if (typeof nome === 'string' && !ferramentas.includes(nome)) {
        ferramentas.push(nome);
      }
    }

    return {
      sessionId,
      subtype: typeof parsed.subtype === 'string' ? parsed.subtype : 'success',
      isError: false,
      exitCode,
      numTurns: numeroOuZero(parsed.num_turns),
      durationMs: numeroOuZero(parsed.duration_ms),
      durationApiMs: numeroOuZero(parsed.duration_api_ms),
      costUsd: numeroOuZero(parsed.total_cost_usd),
      model,
      modelosReportados,
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      permissionDenials: denials.length,
      ferramentasNegadas: ferramentas.length > 0 ? ferramentas.join(',') : null,
      rawStdout,
      rawStderr,
    };
  }

  /**
   * Deteccao de limite de uso de RF-019, sobre o texto bruto da saida, insensivel a caixa.
   */
  public detectRateLimit(rawOutput: string): boolean {
    return detectRateLimit(rawOutput);
  }

  /**
   * CT-023: `claude --version`, primeira linha do stdout, timeout de 5 segundos,
   * string vazia em falha ou timeout.
   */
  public async getVersion(): Promise<string> {
    return this.runner.runCapturingFirstLine(getExecutavel(this.slug), ['--version'], {
      timeoutMs: CLI_VERSION_TIMEOUT_MS,
    });
  }

  /**
   * CT-022: `claude mcp list`, `stdin: 'ignore'`, timeout em segundos. Em timeout ou
   * falha de spawn devolve `null` — a saida parcial e integralmente descartada, porque
   * um cabecalho de health check sozinho faria todo MCP aparecer como nao configurado.
   */
  public async mcpListRaw(timeoutSegundos: number): Promise<string | null> {
    const resultado = await this.runner.run(getExecutavel(this.slug), ['mcp', 'list'], {
      timeoutMs: timeoutSegundos * 1000,
      stdin: 'ignore',
    });

    if (resultado.spawnFailed || resultado.timedOut) {
      return null;
    }

    return resultado.stdout;
  }

  /**
   * Interpreta a saida de `claude mcp list` por MCP declarado (CT-022): linha casando
   * `^<nome>:.*(Connected|✔)` -> `OK`; qualquer outro caso, incluindo `saida === null`
   * (leitura invalidada por timeout) -> `AVISO`.
   */
  public interpretMcpStatus(
    saida: string | null,
    nomes: string[]
  ): Map<string, 'OK' | 'AVISO'> {
    const mapa = new Map<string, 'OK' | 'AVISO'>();

    for (const nome of nomes) {
      if (saida === null) {
        mapa.set(nome, 'AVISO');
        continue;
      }

      const escapado = escaparRegExp(nome);
      const conectado = new RegExp(`^${escapado}:.*(Connected|✔)`, 'm');
      mapa.set(nome, conectado.test(saida) ? 'OK' : 'AVISO');
    }

    return mapa;
  }

  private linhaDoMcp(saida: string | null, nome: string): string | null {
    if (saida === null) {
      return null;
    }

    const escapado = escaparRegExp(nome);
    const linha = new RegExp(`^${escapado}:.*$`, 'm').exec(saida);
    return linha ? linha[0] : null;
  }

  public async listMcps(
    mcpsDeclarados: string[],
    timeoutSegundos: number
  ): Promise<McpCheckResult[]> {
    const raw = await this.mcpListRaw(timeoutSegundos);
    const status = this.interpretMcpStatus(raw, mcpsDeclarados);

    return mcpsDeclarados.map((nome) => ({
      nome,
      severidade: status.get(nome) ?? 'AVISO',
      linha: this.linhaDoMcp(raw, nome),
    }));
  }

  /**
   * Executa a task via CT-020, sem timeout e sem retry. O `stderr` do filho e
   * repassado por `onStderrChunk`, nunca impresso na tela. `signal` aborta o
   * filho explicitamente (RF-024): sem ele, uma interrupcao deixaria a CLI viva
   * no Windows, onde nao ha grupo de processo POSIX para receber o Ctrl+C.
   */
  public async runTask(
    entrada: BuildTaskArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult> {
    const args = this.buildTaskArgs(entrada);
    const env = this.buildEnv(entrada.opcoes.cacheTuning);

    const resultado = await this.runner.run(getExecutavel(this.slug), args, {
      cwd,
      env,
      stdin: 'ignore',
      onStderrChunk,
      signal,
    });

    return this.parseResult(resultado.exitCode, resultado.stdout, resultado.stderr);
  }

  /**
   * Executa a construcao do Contexto de Execucao via CT-021, com a mesma normalizacao
   * de resposta de CT-020.
   */
  public async runPack(
    prompt: string,
    entrada: BuildContextPackArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult> {
    const args = this.buildContextPackArgs(prompt, entrada);
    const env = this.buildEnv(entrada.cacheTuning);

    const resultado = await this.runner.run(getExecutavel(this.slug), args, {
      cwd,
      env,
      stdin: 'ignore',
      onStderrChunk,
      signal,
    });

    return this.parseResult(resultado.exitCode, resultado.stdout, resultado.stderr);
  }
}
