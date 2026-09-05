import type { HeaderStyle, LayoutName, ToolSlug } from './config.js';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type PermissionMode = 'acceptEdits' | 'auto' | 'dontAsk' | 'manual' | 'bypassPermissions';

/**
 * Forma de injecao do Contexto de Execucao na ferramenta (CT-030, RF-011).
 * Uniao literal, e nunca `string`, para que um valor fora do conjunto seja erro
 * de compilacao e todo `switch` sobre ela possa ser exaustivo por `never`.
 */
export type ContextInjection = 'prompt' | 'instructions';

/**
 * Desfecho da avaliacao do Contexto de Execucao numa execucao (task-8, CT-013/CT-021).
 * `desligado` = `--no-context-pack`; `falhou` = construcao nao satisfez as tres
 * condicoes de sucesso de CT-021, mas o lote prossegue sem o destilado.
 */
export type PackDecisao = 'reaproveitado' | 'construido' | 'falhou' | 'desligado';

/**
 * Resultado que o `ContextPackService` devolve ao orquestrador (task-10).
 * `caminho` so e preenchido quando o destilado pode ser injetado em `--append-system-prompt-file`.
 */
export interface PackResult {
  decisao: PackDecisao;
  caminho: string | null;
  bytes: number;
  estTokens: number;
  acimaDoTeto: boolean;
  motivo: string;
  fonteAlterada: string | null;
  tokensGastos: number;
}

export interface ExecutarTasksOptions {
  tool: ToolSlug;
  model: string;
  effort: EffortLevel;
  fallbackModel: string;
  autoApprove: boolean;
  permissionMode: PermissionMode | '';
  skillDirs: boolean;
  maxBudgetUsd: number;
  windowBudgetTokens: number;
  stopOnFailure: boolean;
  sleep: number;
  cacheTuning: boolean;
  contextPack: boolean;
  contextInjection: ContextInjection;
  maxWait: string;
  waitOnLimit: boolean;
  packMaxTokens: number;
  tasks: string;
  allow: string[];
  preflight: boolean;
  skipPreflight: boolean;
  requireCmd: string[];
  mcpTimeout: number;
  mcpCheck: boolean;
  dryRun: boolean;
}

export interface TaskInfo {
  arquivo: string;
  numero: number;
  caminho: string;
  done: boolean;
  selecionada: boolean;
}

export type PreflightSeveridade = 'OK' | 'INFO' | 'AVISO' | 'ERRO';

export interface PreflightItem {
  grupo: string;
  item: string;
  severidade: PreflightSeveridade;
  mensagem: string;
}

/**
 * Resultado consolidado do preflight (task-7, grupos A a F).
 *
 * O servico classifica e devolve; quem imprime, aborta e define o codigo de saida
 * e o comando (task-10). `temErro` e a invariante de RNF-001: verdadeiro sempre que
 * ha ao menos um item ERRO, e nesse caso nenhum token pode ser gasto.
 */
export interface PreflightResult {
  itens: PreflightItem[];
  erros: number;
  avisos: number;
  temErro: boolean;
}

/**
 * Capacidade (skill ou MCP) declarada na secao 9 de um arquivo de task (CT-014).
 * Resultado da extracao feita pelo grupo E do preflight.
 */
export interface DeclaredCapability {
  nome: string;
  tipo: 'SKILL' | 'MCP';
  taskArquivo: string;
}

/**
 * Entrada do `PreflightService.run`. Todos os caminhos ja chegam resolvidos pelo
 * chamador (task-10); o servico nao le `process.cwd()` nem monta caminhos globais
 * por conta propria, para permanecer deterministico e testavel sem tocar o ambiente
 * real (`projetoDir` e `home` sao injetados em vez de derivados de globais).
 */
export interface PreflightContexto {
  featureDir: string;
  projetoDir: string;
  home: string;
  ferramenta: ToolSlug;
  tasksSelecionadas: string[];
  logsDir: string;
  opcoes: Pick<
    ExecutarTasksOptions,
    'autoApprove' | 'permissionMode' | 'requireCmd' | 'mcpCheck' | 'mcpTimeout'
  >;
}

export interface RunAccounting {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  reasoningTokens: number;
  tokensGastosAcumulado: number;
  custoAcumuladoUsd: number;
}

export type RunEndMotivo =
  | 'fim_da_lista'
  | 'orcamento_da_janela'
  | 'orcamento_de_custo'
  | 'limite_de_uso'
  | 'falha_na_task'
  | 'preflight_reprovado'
  | 'interrompido_pelo_usuario';

interface TokenCounters {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface RunEventRunStart {
  event: 'run_start';
  ts: string;
  feature: string;
  tool: ToolSlug;
  cli_version: string;
  model: string;
  effort: EffortLevel;
  fallback_model: string;
  total_tasks: number;
  total_tasks_feature: number;
  task_selection: string;
  tasks_selecionadas: number[];
  window_budget_tokens: number;
  max_budget_usd: number;
  auto_approve: boolean;
  permission_mode: string;
  extra_dirs: string[];
  cache_tuning: boolean;
  context_pack: boolean;
  pack_model: string;
  pack_effort: EffortLevel;
  pack_max_tokens: number;
  dry_run: boolean;
  layout: LayoutName;
  capacidades_ausentes: string[];
  context_injection: ContextInjection | 'n/a';
  cli_version_abaixo_do_piso: boolean;
  max_wait_segundos: number;
  wait_on_limit: boolean;
  cabecalho: HeaderStyle;
}

export interface RunEventPreflightItem {
  grupo: string;
  item: string;
  severidade: PreflightSeveridade;
  mensagem: string;
}

export interface RunEventPreflight {
  event: 'preflight';
  ts: string;
  erros: number;
  avisos: number;
  itens: RunEventPreflightItem[];
}

export interface RunEventTasksNaoCertificadas {
  event: 'tasks_nao_certificadas';
  ts: string;
  tasks: string[];
  nesta_execucao: string[];
}

export interface RunEventPackReused {
  event: 'pack_reused';
  ts: string;
  arquivo: string;
}

export interface RunEventPackBuild extends TokenCounters {
  event: 'pack_build';
  ts: string;
  motivo: string;
  fonte_alterada: string | null;
  arquivo: string;
  session_id: string;
  pack_model: string;
  pack_effort: EffortLevel;
  /**
   * CT-043: modelo efetivamente reportado pela ferramenta, gravado SEMPRE, com o
   * valor devolvido - a capacidade `relatoDeModeloEfetivo` governa apenas o
   * aviso de divergencia (RF-013).
   */
  pack_model_efetivo: string;
  pack_model_divergente: boolean;
  duracao_segundos: number;
  num_turns: number;
  bytes_pack: number;
  est_tokens_pack: number;
  pack_max_tokens: number;
  pack_over_ceiling: boolean;
  tokens_gastos: number;
  tokens_gastos_acumulado_depois: number;
  custo_usd: string;
}

export interface RunEventPackBuildFailed {
  event: 'pack_build_failed';
  ts: string;
  motivo: string;
  subtype: string;
  exit_code: number;
  tokens_gastos: number;
}

export interface RunEventSkip {
  event: 'skip';
  ts: string;
  task: string;
  motivo: 'DONE';
  selecionada: boolean;
}

export interface RunEventStart {
  event: 'start';
  ts: string;
  task: string;
  tool: ToolSlug;
  model: string;
  effort: EffortLevel;
  usou_contexto_execucao: boolean;
  tokens_gastos_acumulado_antes: number;
  tokens_disponiveis_antes: number | null;
}

export interface RunEventEnd extends TokenCounters {
  event: 'end';
  ts: string;
  task: string;
  tool: ToolSlug;
  model_solicitado: string;
  modelos_reportados: string;
  effort: EffortLevel;
  session_id: string;
  subtype: string;
  is_error: boolean;
  exit_code: number;
  usou_contexto_execucao: boolean;
  permission_denials: number | null;
  ferramentas_negadas: string | null;
  reasoning_tokens: number | null;
  contabilidade_parcial: boolean;
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;
  wall_seconds: number;
  sem_certificacao: boolean;
  tokens_gastos_task: number;
  tokens_gastos_acumulado_depois: number;
  tokens_disponiveis_depois: number | null;
  custo_task_usd: string;
  custo_acumulado_usd: string;
}

export interface RunEventBudgetExhausted {
  event: 'budget_exhausted';
  ts: string;
  tipo: 'janela' | 'custo';
  proxima_task: string;
  tokens_gastos_acumulado: number;
  window_budget_tokens: number;
  custo_acumulado_usd: number;
  max_budget_usd: number;
}

/** Origem do horario de renovacao usado por uma espera (CT-043). */
export type OrigemHorario = 'informado' | 'sondagem';

/** Contexto em que o limite de uso foi detectado (CT-043). */
export type ContextoDeEspera = 'task' | 'context_pack';

export interface RunEventRateLimited {
  event: 'rate_limited';
  ts: string;
  task: string;
  /**
   * Campos acrescentados por CT-043. Opcionais apenas enquanto o loop de tasks
   * (task-9) e a construcao do destilado (task-10) nao os alimentam; nenhum
   * campo existente foi removido ou renomeado (RNF-005).
   */
  tentativa?: number;
  renovacao_prevista?: string | null;
  origem_horario?: OrigemHorario;
  contexto?: ContextoDeEspera;
}

/**
 * Entrada em espera por limite de uso (CT-043, RF-025). `task` e `null` durante
 * a construcao do Contexto de Execucao. Duracoes numericas e cruas, em segundos;
 * o texto bruto da ferramenta nunca e gravado aqui (techspec secao 7).
 */
export interface RunEventAguardandoLimite {
  event: 'aguardando_limite';
  ts: string;
  task: string | null;
  tentativa: number;
  origem_horario: OrigemHorario;
  renovacao_prevista: string | null;
  espera_planejada_segundos: number;
  espera_acumulada_segundos_antes: number;
  teto_espera_segundos: number;
}

/**
 * Retomada apos uma espera bem-sucedida (CT-043, RF-025). `janela_renovada`
 * registra a renovacao do contador da janela de RF-019, que por decisao da
 * secao 4.6 do techspec nao vira um terceiro tipo de evento.
 */
export interface RunEventRetomada {
  event: 'retomada';
  ts: string;
  task: string | null;
  tentativa: number;
  espera_efetiva_segundos: number;
  espera_acumulada_segundos_depois: number;
  janela_renovada: boolean;
}

export interface RunEventInterrompido {
  event: 'interrompido';
  ts: string;
  task: string;
  tasks_concluidas: number;
  total_tasks: number;
}

export interface RunEventRunEnd {
  event: 'run_end';
  ts: string;
  motivo: RunEndMotivo;
  tasks_executadas: number;
  tasks_com_erro: number;
  tokens_gastos_total: number;
  custo_total_usd: string;
  /**
   * Duracoes do lote inteiro, numericas e cruas, em segundos (CT-043, RF-010).
   * `tempo_em_espera_segundos` e o acumulado da instancia unica de
   * `EsperaPorLimiteDeUso`, e vale `0` quando nao houve espera. Nenhum campo
   * existente foi removido ou renomeado (RNF-005).
   */
  tempo_total_segundos: number;
  tempo_em_espera_segundos: number;
}

export type RunEvent =
  | RunEventRunStart
  | RunEventPreflight
  | RunEventTasksNaoCertificadas
  | RunEventPackReused
  | RunEventPackBuild
  | RunEventPackBuildFailed
  | RunEventSkip
  | RunEventStart
  | RunEventEnd
  | RunEventBudgetExhausted
  | RunEventRateLimited
  | RunEventAguardandoLimite
  | RunEventRetomada
  | RunEventInterrompido
  | RunEventRunEnd;

/** Endereco do schema publico da configuracao do OpenCode (CT-035). */
export const OPENCODE_CONFIG_SCHEMA = 'https://opencode.ai/config.json';

/** Nome obrigatorio do agente criado pelo specifica-br (CT-035). */
export const OPENCODE_AGENTE_EXECUTOR = 'specifica-executor';

/**
 * Agente nao-interativo declarado pelo arquivo de apoio de execucao (CT-035).
 *
 * `mode: 'primary'` e o que torna o agente selecionavel por `--agent`. O
 * `permission` comeca sempre por `{"*": "allow"}` (RF-007): a avaliacao do
 * OpenCode usa `findLast` sobre a concatenacao das regras, e a permissao do
 * agente entra depois da global e da do projeto.
 */
export interface ExecutorAgentConfig {
  description: string;
  mode: 'primary';
  permission: Record<string, unknown>;
}

/**
 * Conteudo do arquivo de apoio de execucao do OpenCode (CT-035), entregue ao
 * processo filho por `OPENCODE_CONFIG` (ENV-002).
 *
 * `instructions` e opcional por contrato: presente apenas com a forma de
 * injecao `instructions` e destilado disponivel, e entao com um unico caminho
 * absoluto. Nunca escrito como lista vazia.
 */
export interface ExecutorConfig {
  $schema: typeof OPENCODE_CONFIG_SCHEMA;
  instructions?: string[];
  agent: Record<typeof OPENCODE_AGENTE_EXECUTOR, ExecutorAgentConfig>;
}

/**
 * Conjunto unico de dados de abertura do lote entregue a camada de
 * apresentacao (RF-005, techspec secao 3.1).
 *
 * E a inversao de responsabilidade da feature: o comando entrega *dados*, e a
 * forma e decidida por `renderCabecalho`. Por isso a lista e fechada — as tres
 * formas exibem **todos** estes campos e nenhum campo fora deles.
 *
 * `contextoInjecao` e o unico dado condicional: `null` quando a ferramenta nao
 * oferece escolha de forma de injecao, caso em que a linha e omitida porque
 * anuncia-la onde nao ha escolha seria mentira (CT-030). Nenhum outro campo e
 * opcional, e nenhuma outra linha pode ser suprimida por qualquer forma.
 */
export interface DadosDeAbertura {
  /** Grupo `alvo`: diretorio da feature, como digitado. */
  feature: string;
  /** Grupo `alvo`: quantidade de tasks selecionadas. */
  tasksSelecionadas: number;
  /** Grupo `alvo`: total de tasks encontradas. */
  tasksTotal: number;
  /** Grupo `alvo`: criterio de selecao, ou `'todas'`. */
  criterioDeSelecao: string;
  /** Grupo `motor`: ferramenta resolvida. */
  ferramenta: ToolSlug;
  /** Grupo `motor`: nome do executavel da ferramenta. */
  executavel: string;
  /** Grupo `motor`: versao da CLI; vazia vira `'desconhecida'` na origem. */
  versao: string;
  /** Grupo `motor`: modelo do lote. */
  model: string;
  /** Grupo `motor`: nivel de esforco do lote. */
  effort: EffortLevel;
  /** Grupo `motor`: modelo de recurso alternativo, ou `'nenhum'`. */
  fallbackModel: string;
  /** Grupo `motor`: descricao do modo de permissao. */
  permissoes: string;
  /** Grupo `contexto`: mecanismo do Contexto de Execucao ligado. */
  contextoLigado: boolean;
  /** Grupo `contexto`: `--dry-run` — ligado, mas nada sera construido. */
  contextoSimulado: boolean;
  /** Grupo `contexto`: teto de tokens ja formatado, ou `'sem teto'`. */
  contextoTeto: string;
  /** Grupo `contexto`: forma de injecao, ou `null` quando nao ha escolha. */
  contextoInjecao: ContextInjection | null;
  /** Grupo `contexto`: otimizacao de cache ligada. */
  cacheTuning: boolean;
  /** Grupo `contexto`: diretorios extras, ja encurtados. */
  dirsExtras: string[];
  /** Grupo `limites`: teto de custo por task, ja formatado. */
  tetoCustoPorTask: string;
  /** Grupo `limites`: teto da janela de execucao, ou `'sem teto'`. */
  tetoJanela: string;
  /** Grupo `limites`: teto de espera ja em forma humana, ou `'desligada'`. */
  tetoEspera: string;
  /** Grupo `registro`: caminho do registro de execucao, ja encurtado. */
  registroPath: string;
}

/**
 * Estado da espera por limite de uso, entregue a apresentacao a cada segundo
 * (RF-022, techspec secao 3.1).
 *
 * A producao do estado e da politica de espera (`EsperaPorLimiteDeUso`); a
 * apresentacao apenas o consome. `restanteSegundos` ja vem na base correta
 * para a natureza: tempo restante total quando a renovacao e conhecida, tempo
 * ate a proxima sondagem quando nao e.
 */
export interface EstadoDeEspera {
  /** Decide se a linha mostra o tempo restante total ou o da proxima sondagem. */
  natureza: 'renovacao_conhecida' | 'sondagem';
  /** Tempo restante, ja na base correta para a natureza. */
  restanteSegundos: number;
  /** Horario absoluto previsto de retomada (ou da proxima sondagem). */
  retomadaEm: Date;
  /** `null` durante a construcao do Contexto de Execucao (RF-021). */
  task: string | null;
  /** Posicao da task no lote. */
  posicao: number;
  /** Total de tasks do lote. */
  total: number;
  /** Numero da proxima tentativa. */
  tentativa: number;
}

/**
 * Porta de tempo (CT-048). Existe para satisfazer RNF-006: nos testes um
 * relogio falso avanca o tempo sem esperar nada, e nenhum teste desta feature
 * aguarda tempo real. `relogioDoSistema`, em `utils/espera-limite.ts`, e o
 * adapter real.
 */
export interface Relogio {
  /** Instante corrente, em milissegundos epoch. */
  agora(): number;
  /** Aguarda `ms`, resolvendo imediatamente quando o `signal` aborta (RNF-003). */
  esperar(ms: number, signal?: AbortSignal): Promise<void>;
}
