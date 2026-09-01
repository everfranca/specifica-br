import { TOOL_SLUGS } from '../types/config.js';
import type { ToolSlug } from '../types/config.js';
import type { EffortLevel, PermissionMode } from '../types/executar-tasks.js';
import { normalizeToolSlug } from './tool-adapters/tool-registry.js';

/**
 * Opcoes ja validadas e coeridas de `executar-tasks`. Difere de
 * `ExecutarTasksOptions` apenas em `tool`, que aqui pode ser `''` porque a
 * ferramenta so e resolvida depois (RF-011); o comando substitui pelo slug
 * definitivo antes de repassar aos servicos.
 */
export interface ValidatedOptions {
  tool: ToolSlug | '';
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

const EFFORT: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const PERMISSION: readonly string[] = [
  'acceptEdits',
  'auto',
  'dontAsk',
  'manual',
  'bypassPermissions',
];

interface RegrasNumericas {
  min?: number;
  minExclusivo?: number;
  inteiro?: boolean;
}

function textoNaoVazio(valor: unknown, padrao: string, nome: string): string {
  if (valor === undefined) {
    return padrao;
  }
  const texto = String(valor);
  if (texto.trim() === '') {
    throw new Error(`${nome} nao pode ser vazio`);
  }
  return texto;
}

function enumValido(
  valor: unknown,
  conjunto: readonly string[],
  padrao: string,
  nome: string
): string {
  if (valor === undefined || valor === '') {
    return padrao;
  }
  const texto = String(valor);
  if (!conjunto.includes(texto)) {
    throw new Error(`${nome} invalido: ${texto}. Use um de: ${conjunto.join('|')}`);
  }
  return texto;
}

function numero(
  valor: unknown,
  padrao: number,
  nome: string,
  regras: RegrasNumericas
): number {
  if (valor === undefined) {
    return padrao;
  }
  // `Number.isFinite` e a trava de RF-021 para os cinco numericos.
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());
  if (!Number.isFinite(n)) {
    throw new Error(`${nome} exige um valor numerico: ${String(valor)}`);
  }
  if (regras.inteiro && !Number.isInteger(n)) {
    throw new Error(`${nome} exige um numero inteiro`);
  }
  if (regras.minExclusivo !== undefined && !(n > regras.minExclusivo)) {
    throw new Error(`${nome} exige um valor maior que ${regras.minExclusivo}`);
  }
  if (regras.min !== undefined && n < regras.min) {
    throw new Error(`${nome} exige um valor maior ou igual a ${regras.min}`);
  }
  return n;
}

function listaNaoVazia(valor: unknown, nome: string): string[] {
  if (valor === undefined || !Array.isArray(valor)) {
    return [];
  }
  return valor.map((item) => {
    const texto = String(item);
    if (texto.trim() === '') {
      throw new Error(`${nome} nao pode ser vazio`);
    }
    return texto;
  });
}

/**
 * Aplica as validacoes literais da coluna "Validacao (RF-021)" da secao 4.1 do
 * techspec. Fica em arquivo proprio para ser testavel sem Commander e para
 * manter a acao do comando legivel. Cada falha lanca com a mensagem nominal.
 *
 * A existencia dos numeros de `--tasks` e verificada mais tarde, contra a lista
 * descoberta (RF-005); aqui so o conjunto de caracteres e conferido.
 */
export function validateOptions(brutas: Record<string, unknown>): ValidatedOptions {
  const b = brutas;
  const flag = (valor: unknown): boolean => valor === true;

  let tool: ToolSlug | '' = '';
  if (b.tool !== undefined && String(b.tool) !== '') {
    const slug = normalizeToolSlug(String(b.tool));
    if (!slug) {
      throw new Error(
        `ferramenta ${String(b.tool)} invalida. Use um de: ${TOOL_SLUGS.join(', ')}`
      );
    }
    tool = slug;
  }

  const model = textoNaoVazio(b.model, 'sonnet', '--model');
  const packModel = textoNaoVazio(b.packModel, 'sonnet', '--pack-model');
  const effort = enumValido(b.effort, EFFORT, 'medium', '--effort') as EffortLevel;
  const packEffort = enumValido(b.packEffort, EFFORT, 'low', '--pack-effort') as EffortLevel;
  const permissionMode = enumValido(
    b.permissionMode,
    PERMISSION,
    '',
    '--permission-mode'
  ) as PermissionMode | '';

  const fallbackModel = b.fallbackModel === undefined ? '' : String(b.fallbackModel);
  if (fallbackModel !== '' && fallbackModel.trim() === '') {
    throw new Error('--fallback-model nao pode ser vazio quando informado');
  }

  const maxBudgetUsd = numero(b.maxBudgetUsd, 0, '--max-budget-usd', { min: 0 });
  const windowBudgetTokens = numero(b.windowBudgetTokens, 0, '--window-budget-tokens', {
    min: 0,
    inteiro: true,
  });
  const sleep = numero(b.sleep, 0, '--sleep', { min: 0 });
  const packMaxTokens = numero(b.packMaxTokens, 8000, '--pack-max-tokens', {
    min: 0,
    inteiro: true,
  });
  const mcpTimeout = numero(b.mcpTimeout, 15, '--mcp-timeout', {
    minExclusivo: 0,
    inteiro: true,
  });

  const allow = listaNaoVazia(b.allow, '--allow');
  const requireCmd = listaNaoVazia(b.requireCmd, '--require-cmd');

  const tasks = b.tasks === undefined ? '' : String(b.tasks);
  if (tasks.trim() !== '' && !/^[0-9,\-\s]+$/.test(tasks)) {
    throw new Error('selecao invalida');
  }

  return {
    tool,
    model,
    effort,
    fallbackModel,
    autoApprove: flag(b.autoApprove),
    permissionMode,
    // As quatro opcoes negativas do Commander entregam `true` por padrao e
    // `false` quando informadas; `!== false` cobre ambos e o caso `undefined`.
    skillDirs: b.skillDirs !== false,
    maxBudgetUsd,
    windowBudgetTokens,
    stopOnFailure: flag(b.stopOnFailure),
    sleep,
    cacheTuning: b.cacheTuning !== false,
    contextPack: b.contextPack !== false,
    packModel,
    packEffort,
    packMaxTokens,
    tasks,
    allow,
    preflight: flag(b.preflight),
    skipPreflight: flag(b.skipPreflight),
    requireCmd,
    mcpTimeout,
    mcpCheck: b.mcpCheck !== false,
    dryRun: flag(b.dryRun),
  };
}
