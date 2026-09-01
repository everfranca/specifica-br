import type { LayoutName, ToolSlug } from './config.js';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type PermissionMode = 'acceptEdits' | 'auto' | 'dontAsk' | 'manual' | 'bypassPermissions';

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
  packModel: string;
  packEffort: EffortLevel;
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

export type PreflightSeveridade = 'OK' | 'AVISO' | 'ERRO';

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
  opcoes: {
    autoApprove: boolean;
    permissionMode: PermissionMode | '';
    requireCmd: string[];
    mcpCheck: boolean;
    mcpTimeout: number;
  };
}

export interface RunAccounting {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  tokensGastosAcumulado: number;
  custoAcumuladoUsd: number;
}

export type RunEndMotivo =
  | 'fim_da_lista'
  | 'orcamento_da_janela'
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
  permission_denials: number;
  ferramentas_negadas: string | null;
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
  proxima_task: string;
  tokens_gastos_acumulado: number;
  window_budget_tokens: number;
}

export interface RunEventRateLimited {
  event: 'rate_limited';
  ts: string;
  task: string;
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
  | RunEventInterrompido
  | RunEventRunEnd;
