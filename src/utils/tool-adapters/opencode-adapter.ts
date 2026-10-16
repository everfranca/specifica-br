import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type { EffortLevel, ExecutarTasksOptions } from '../../types/executar-tasks.js';
import type {
  BuildContextPackArgsInput,
  BuildTaskArgsInput,
  DesfechoDoFilho,
  McpCheckResult,
  TaskResult,
  ToolAdapter,
  ToolCapabilities,
} from '../../types/tool-adapter.js';
import type { ToolSlug } from '../../types/config.js';
import { OPENCODE_AGENTE_EXECUTOR } from '../../types/executar-tasks.js';
import { OpenCodeExecutorConfigService } from '../opencode-executor-config.js';
import { resolverTemplateDoComando } from '../opencode-command-template.js';
import type { TemplateResolvido } from '../opencode-command-template.js';
import { ProcessRunner, processRunner } from '../process-runner.js';
import { detectRateLimit } from './rate-limit.js';
import { escaparRegExp, numeroOuZero } from './parse-helpers.js';
import { getExecutavel } from './tool-registry.js';

const CLI_VERSION_TIMEOUT_MS = 5000;

const SEMVER_NA_PRIMEIRA_LINHA = /v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/** Modo de permissao relatado pelo preflight: com o agente allow-all, e sempre total (RF-007). */
const MODO_PERMISSAO_TOTAL = 'permissao total';

/** Sequencias de cor do terminal, removidas antes de qualquer casamento (CT-033). */
const ANSI = /\x1b\[[0-9;]*m/g;

/** Os dois padroes que, juntos, caracterizam variante recusada pelo provedor (RF-009). */
const VARIANTE_CITADA = /variant/i;
const VARIANTE_RECUSADA = /not supported|unsupported|invalid|unknown|unavailable/i;

const CAPACIDADES_OPENCODE: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: false,
  consultaAosMcps: true,
  relatoDeCustoEmUSD: true,
  tetoDeCustoNativo: false,
  modeloDeFallback: false,
  otimizacaoDeCacheDePrompt: false,
  relatoDeNegacoesDePermissao: false,
  formaDeInjecaoSelecionavel: true,
  relatoDeModeloEfetivo: false,
};

/**
 * Evento do NDJSON de CT-031, ja reduzido a um tipo de dominio. Todo campo e
 * anulavel porque a origem e texto externo: a leitura estreita por verificacao de
 * campo, nunca por `as`.
 */
interface EventoOpenCode {
  tipo: string;
  timestamp: number | null;
  sessionId: string | null;
  custo: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheWrite: number;
  cacheRead: number;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Mapeamento de `--effort` para o sufixo `#variante` de `--model` (CT-031).
 * `medium` devolve `null`: nenhum sufixo e anexado e o provedor aplica o
 * proprio padrao.
 */
function mapearEsforco(effort: EffortLevel): string | null {
  switch (effort) {
    case 'low':
      return 'minimal';
    case 'medium':
      return null;
    case 'high':
      return 'high';
    case 'xhigh':
      return 'high';
    case 'max':
      return 'max';
    default: {
      const _exaustivo: never = effort;
      return _exaustivo;
    }
  }
}

function modeloComSufixo(modelo: string, effort: EffortLevel, varianteDesabilitada: boolean): string {
  const variante = varianteDesabilitada ? null : mapearEsforco(effort);
  return variante === null ? modelo : `${modelo}#${variante}`;
}

/**
 * Le uma linha do NDJSON. Devolve `null` quando a linha nao e JSON valido ou nao
 * tem a forma de envelope de evento: quem chama a conta como descartada.
 */
function lerEvento(linha: string): EventoOpenCode | null {
  let bruto: unknown;

  try {
    bruto = JSON.parse(linha);
  } catch {
    return null;
  }

  if (!ehObjeto(bruto) || typeof bruto.type !== 'string') {
    return null;
  }

  const part = ehObjeto(bruto.part) ? bruto.part : {};
  const tokens = ehObjeto(part.tokens) ? part.tokens : {};
  const cache = ehObjeto(tokens.cache) ? tokens.cache : {};

  return {
    tipo: bruto.type,
    timestamp: numeroOuNulo(bruto.timestamp),
    sessionId: textoOuNulo(bruto.sessionID),
    custo: numeroOuZero(part.cost),
    inputTokens: numeroOuZero(tokens.input),
    outputTokens: numeroOuZero(tokens.output),
    reasoningTokens: numeroOuZero(tokens.reasoning),
    cacheWrite: numeroOuZero(cache.write),
    cacheRead: numeroOuZero(cache.read),
  };
}

/**
 * Adapter da CLI `opencode`, segundo contrato de execucao validado do produto.
 * Monta o argv de CT-031 e CT-032, exporta `OPENCODE_CONFIG` (ENV-002), agrega o
 * NDJSON de CT-031 e interpreta CT-033 e CT-034.
 *
 * `CLAUDE_CODE_PROMPT_CACHE_TTL` nunca e definida, lida ou repassada aqui (RNF-007).
 */
export interface OpenCodeAdapterOrigens {
  projetoDir?: string;
  home?: string;
  resolvedorDeTemplate?: (projetoDir: string, home: string) => Promise<TemplateResolvido | null>;
}

export class OpenCodeAdapter implements ToolAdapter {
  public readonly slug: ToolSlug = 'opencode';
  public readonly contratoValidado = true;
  public readonly capacidades: ToolCapabilities = CAPACIDADES_OPENCODE;
  public readonly modoDeExecucao: string = 'processo_privado';

  private readonly avisosEmitidos = new Set<string>();
  private varianteDesabilitada = false;
  private reexecutouPorVariante = false;
  private modeloEmUso = '';
  private corpoDoTemplate: string | null = null;
  private arquivoDaTaskCorrente = '';
  private readonly projetoDir: string;
  private readonly home: string;
  private readonly resolvedorDeTemplate: (
    projetoDir: string,
    home: string
  ) => Promise<TemplateResolvido | null>;

  constructor(
    private readonly runner: ProcessRunner = processRunner,
    private readonly configService: OpenCodeExecutorConfigService = new OpenCodeExecutorConfigService(),
    private readonly onAviso: (mensagem: string) => void = () => undefined,
    origens: OpenCodeAdapterOrigens = {}
  ) {
    this.projetoDir = origens.projetoDir ?? process.cwd();
    this.home = origens.home ?? os.homedir();
    this.resolvedorDeTemplate = origens.resolvedorDeTemplate ?? resolverTemplateDoComando;
  }

  public async preparar(): Promise<void> {
    const resolvido = await this.resolvedorDeTemplate(this.projetoDir, this.home);

    if (resolvido === null) {
      throw new Error('nao foi possivel ler o template do comando executar-task para OpenCode');
    }

    this.corpoDoTemplate = resolvido.corpo;
  }

  /** Emite um aviso nominal no maximo uma vez por execucao. */
  private avisar(mensagem: string): void {
    if (this.avisosEmitidos.has(mensagem)) {
      return;
    }

    this.avisosEmitidos.add(mensagem);
    this.onAviso(mensagem);
  }

  /**
   * Modo de permissao efetivo (RF-007). Com o agente `specifica-executor` allow-all
   * entregue por `OPENCODE_CONFIG`, a permissao e sempre total, e nenhuma flag de
   * modo e enviada a CLI. Modo sem equivalente e recusado com aviso nominal, e o
   * lote prossegue com permissao total.
   */
  public modoDePermissaoEfetivo(
    opcoes: Pick<ExecutarTasksOptions, 'autoApprove' | 'permissionMode'>
  ): string {
    switch (opcoes.permissionMode) {
      case '':
      case 'acceptEdits':
      case 'auto':
      case 'bypassPermissions':
        break;
      case 'dontAsk':
      case 'manual':
        this.avisar(
          `--permission-mode ${opcoes.permissionMode} nao tem equivalente no OpenCode - ignorado`
        );
        break;
      default: {
        const _exaustivo: never = opcoes.permissionMode;
        return _exaustivo;
      }
    }

    return MODO_PERMISSAO_TOTAL;
  }

  public buildTaskArgs(entrada: BuildTaskArgsInput): string[] {
    const { taskPath, opcoes, contextoExecucaoConteudo } = entrada;

    if (this.corpoDoTemplate === null) {
      throw new Error(
        'template do comando executar-task nao carregado - preparar() precisa ser executado antes do lote'
      );
    }

    const args: string[] = [
      'run',
      '--standalone',
      '--format',
      'json',
      '--model',
      modeloComSufixo(opcoes.model, opcoes.effort, this.varianteDesabilitada),
      '--agent',
      OPENCODE_AGENTE_EXECUTOR,
      '--auto',
    ];

    const partes: string[] = [this.corpoDoTemplate, taskPath];

    if (contextoExecucaoConteudo !== null && contextoExecucaoConteudo !== '') {
      partes.push(contextoExecucaoConteudo);
    }

    args.push(partes.join('\n\n'));

    return args;
  }

  public buildContextPackArgs(prompt: string, entrada: BuildContextPackArgsInput): string[] {
    return [
      'run',
      '--standalone',
      '--format',
      'json',
      '--model',
      modeloComSufixo(entrada.packModel, entrada.packEffort, this.varianteDesabilitada),
      '--agent',
      OPENCODE_AGENTE_EXECUTOR,
      '--auto',
      prompt,
    ];
  }

  /**
   * Ambiente do processo filho: `{ ...envBase }` mais `OPENCODE_CONFIG` (ENV-002),
   * e **nada** alem disso. `cacheTuning` e ignorado: a capacidade
   * `otimizacaoDeCacheDePrompt` esta ausente nesta ferramenta.
   */
  public buildEnv(cacheTuning: boolean, envBase: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...envBase };
    const caminho = this.configService.caminho;

    if (caminho !== null) {
      env.OPENCODE_CONFIG = caminho;
    }

    return env;
  }

  /**
   * Sempre vazio: a capacidade `liberacaoDeDiretoriosDeLeitura` esta ausente e
   * nenhum `--add-dir` equivalente existe na ferramenta.
   */
  public async resolveExtraDirs(
    _opcoes: ExecutarTasksOptions,
    _home: string,
    _cwd: string
  ): Promise<string[]> {
    return [];
  }

  private resultadoDegradado(
    exitCode: number,
    rawStdout: string,
    rawStderr: string,
    contabilidadeParcial: boolean,
    subtype = 'parse_error',
    desfecho: DesfechoDoFilho = {}
  ): TaskResult {
    return {
      sessionId: '?',
      subtype,
      isError: true,
      exitCode,
      numTurns: 0,
      durationMs: 0,
      durationApiMs: 0,
      costUsd: 0,
      model: this.modeloEmUso,
      modelosReportados: this.modeloEmUso,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      reasoningTokens: 0,
      permissionDenials: null,
      ferramentasNegadas: null,
      contabilidadeParcial,
      rawStdout,
      rawStderr,
      signal: desfecho.signal ?? null,
      aborted: desfecho.aborted === true,
      timedOut: desfecho.timedOut === true,
    };
  }

  /**
   * Agrega o NDJSON de eventos de CT-031. Cada linha passa por `JSON.parse` em
   * `try/catch` **individual**: a linha ilegivel e descartada, assinala
   * `contabilidadeParcial` e o restante e somado normalmente (RF-018, RNF-004).
   *
   * `part.tokens.total` nao e usado: o campo e opcional na ferramenta e um valor
   * ausente zeraria a task. Somam-se os cinco componentes.
   */
  public parseResult(
    exitCode: number,
    rawStdout: string,
    rawStderr: string,
    desfecho: DesfechoDoFilho = {}
  ): TaskResult {
    // CT-049: mesma guarda do adapter de ClaudeCode. Filho morto por sinal, por
    // cancelamento ou por teto de tempo nunca e normalizado como saida limpa.
    const morto =
      desfecho.aborted === true ||
      desfecho.timedOut === true ||
      (desfecho.signal ?? null) !== null;

    if (morto) {
      const subtype =
        desfecho.aborted === true
          ? 'interrompido'
          : desfecho.timedOut === true
            ? 'timeout'
            : 'sinal';
      return this.resultadoDegradado(
        exitCode === 0 ? -1 : exitCode,
        rawStdout,
        rawStderr,
        false,
        subtype,
        desfecho
      );
    }

    if (exitCode !== 0 && rawStdout.trim() === '') {
      return this.resultadoDegradado(exitCode, rawStdout, rawStderr, false);
    }

    let descartadas = 0;
    let lidas = 0;
    let houveErro = false;
    let numTurns = 0;
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationInputTokens = 0;
    let cacheReadInputTokens = 0;
    let reasoningTokens = 0;
    let sessionId: string | null = null;
    let primeiroTimestamp: number | null = null;
    let ultimoTimestamp: number | null = null;

    for (const linha of rawStdout.split(/\r?\n/)) {
      if (linha.trim() === '') {
        continue;
      }

      const evento = lerEvento(linha);

      if (evento === null) {
        descartadas += 1;
        continue;
      }

      lidas += 1;

      if (evento.timestamp !== null) {
        if (primeiroTimestamp === null) {
          primeiroTimestamp = evento.timestamp;
        }
        ultimoTimestamp = evento.timestamp;
      }

      if (sessionId === null && evento.sessionId !== null) {
        sessionId = evento.sessionId;
      }

      if (evento.tipo === 'error') {
        houveErro = true;
        continue;
      }

      if (evento.tipo === 'step_finish') {
        numTurns += 1;
        costUsd += evento.custo;
        inputTokens += evento.inputTokens;
        outputTokens += evento.outputTokens;
        cacheCreationInputTokens += evento.cacheWrite;
        cacheReadInputTokens += evento.cacheRead;
        reasoningTokens += evento.reasoningTokens;
      }
    }

    if (lidas === 0) {
      return this.resultadoDegradado(exitCode, rawStdout, rawStderr, descartadas > 0);
    }

    const durationMs =
      primeiroTimestamp !== null && ultimoTimestamp !== null && lidas > 1
        ? ultimoTimestamp - primeiroTimestamp
        : 0;

    return {
      sessionId: sessionId ?? '?',
      subtype: houveErro ? 'error' : 'success',
      isError: exitCode !== 0 || houveErro,
      exitCode,
      numTurns,
      durationMs,
      durationApiMs: 0,
      costUsd,
      model: this.modeloEmUso,
      modelosReportados: this.modeloEmUso,
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      reasoningTokens,
      permissionDenials: null,
      ferramentasNegadas: null,
      contabilidadeParcial: descartadas > 0,
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

  public async getVersion(): Promise<string> {
    const primeiraLinha = await this.runner.runCapturingFirstLine(
      getExecutavel(this.slug),
      ['--version'],
      {
        timeoutMs: CLI_VERSION_TIMEOUT_MS,
      }
    );
    const casamento = SEMVER_NA_PRIMEIRA_LINHA.exec(primeiraLinha.trim());
    return casamento === null ? '' : casamento[1];
  }

  /**
   * CT-033: `opencode mcp list`, `stdin: 'ignore'`, timeout em segundos. Em timeout
   * ou falha de spawn devolve `null` — a saida parcial e descartada integralmente,
   * porque um cabecalho sozinho faria todo MCP aparecer como nao conectado.
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

  private estadoDoMcp(saida: string | null, nome: string): 'conectado' | 'falhou' | 'desconhecido' {
    if (saida === null) {
      return 'desconhecido';
    }

    const limpa = saida.replace(ANSI, '');
    const escapado = escaparRegExp(nome);

    if (new RegExp(`^\\s*(✓|✗)?\\s*${escapado}\\s+connected\\b`, 'm').test(limpa)) {
      return 'conectado';
    }

    if (new RegExp(`^\\s*(✓|✗)?\\s*${escapado}\\s+failed\\b`, 'm').test(limpa)) {
      return 'falhou';
    }

    return 'desconhecido';
  }

  public interpretMcpStatus(saida: string | null, nomes: string[]): Map<string, 'OK' | 'AVISO'> {
    const mapa = new Map<string, 'OK' | 'AVISO'>();

    for (const nome of nomes) {
      mapa.set(nome, this.estadoDoMcp(saida, nome) === 'conectado' ? 'OK' : 'AVISO');
    }

    return mapa;
  }

  private linhaDoMcp(saida: string | null, nome: string): string | null {
    if (saida === null) {
      return null;
    }

    const limpa = saida.replace(ANSI, '');
    const linha = new RegExp(`^\\s*(✓|✗)?\\s*${escaparRegExp(nome)}\\b.*$`, 'm').exec(limpa);
    return linha ? linha[0].trim() : null;
  }

  public async listMcps(
    mcpsDeclarados: string[],
    timeoutSegundos: number
  ): Promise<McpCheckResult[]> {
    const raw = await this.mcpListRaw(timeoutSegundos);

    return mcpsDeclarados.map((nome) => {
      const estado = this.estadoDoMcp(raw, nome);
      return {
        nome,
        severidade: estado === 'conectado' ? 'OK' : 'AVISO',
        linha: this.linhaDoMcp(raw, nome),
        estado,
      };
    });
  }

  private async executar(
    args: string[],
    modelo: string,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<TaskResult> {
    this.modeloEmUso = modelo;

    const resultado = await this.runner.run(getExecutavel(this.slug), args, {
      cwd,
      env: this.buildEnv(false),
      stdin: 'ignore',
      onStderrChunk,
      signal,
      timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : undefined,
    });

    return this.parseResult(resultado.exitCode, resultado.stdout, resultado.stderr, {
      signal: resultado.signal,
      aborted: resultado.aborted,
      timedOut: resultado.timedOut,
    });
  }

  /**
   * Verdadeiro apenas quando a tentativa reune os tres eixos de RF-009: a variante
   * chegou a ser enviada, a tentativa falhou **sem consumir token algum**, e o texto
   * bruto cita a variante e a recusa. A reexecucao ocorre no maximo uma vez por
   * execucao e nunca sobre tentativa que consumiu tokens.
   */
  private deveReexecutarSemVariante(resultado: TaskResult, variante: string | null): boolean {
    if (variante === null || this.reexecutouPorVariante || this.varianteDesabilitada) {
      return false;
    }

    if (!resultado.isError) {
      return false;
    }

    const tokens =
      resultado.inputTokens +
      resultado.outputTokens +
      resultado.cacheCreationInputTokens +
      resultado.cacheReadInputTokens +
      (resultado.reasoningTokens ?? 0);

    if (tokens !== 0) {
      return false;
    }

    const texto = `${resultado.rawStdout}\n${resultado.rawStderr}`;
    return VARIANTE_CITADA.test(texto) && VARIANTE_RECUSADA.test(texto);
  }

  /**
   * Executa a task via CT-031, sem timeout. O unico retry admitido e a reexecucao
   * unica por variante nao suportada (RF-009), que nunca aborta o lote.
   */
  public async runTask(
    entrada: BuildTaskArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult> {
    this.arquivoDaTaskCorrente = path.basename(entrada.taskPath);
    const variante = this.varianteDesabilitada ? null : mapearEsforco(entrada.opcoes.effort);

    const resultado = await this.executar(
      this.buildTaskArgs(entrada),
      entrada.opcoes.model,
      cwd,
      onStderrChunk,
      signal
    );

    if (!this.deveReexecutarSemVariante(resultado, variante)) {
      return resultado;
    }

    this.reexecutouPorVariante = true;
    this.varianteDesabilitada = true;
    this.avisar(
      `esforco ${entrada.opcoes.effort} recusado pelo provedor - repetindo ${this.arquivoDaTaskCorrente} sem esforco`
    );

    return this.executar(
      this.buildTaskArgs(entrada),
      entrada.opcoes.model,
      cwd,
      onStderrChunk,
      signal
    );
  }

  /**
   * Executa a construcao do Contexto de Execucao via CT-032, com a mesma agregacao
   * de CT-031 e a mesma reexecucao unica por variante nao suportada.
   */
  public async runPack(
    prompt: string,
    entrada: BuildContextPackArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<TaskResult> {
    this.arquivoDaTaskCorrente = path.basename(entrada.featureDir);
    const variante = this.varianteDesabilitada ? null : mapearEsforco(entrada.packEffort);

    const resultado = await this.executar(
      this.buildContextPackArgs(prompt, entrada),
      entrada.packModel,
      cwd,
      onStderrChunk,
      signal,
      timeoutMs
    );

    if (!this.deveReexecutarSemVariante(resultado, variante)) {
      return resultado;
    }

    this.reexecutouPorVariante = true;
    this.varianteDesabilitada = true;
    this.avisar(
      `esforco ${entrada.packEffort} recusado pelo provedor - repetindo ${this.arquivoDaTaskCorrente} sem esforco`
    );

    return this.executar(
      this.buildContextPackArgs(prompt, entrada),
      entrada.packModel,
      cwd,
      onStderrChunk,
      signal
    );
  }
}
