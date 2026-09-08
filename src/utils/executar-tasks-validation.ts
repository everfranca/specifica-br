import { TOOL_SLUGS } from '../types/config.js';
import type { ToolSlug } from '../types/config.js';
import type {
  ContextInjection,
  EffortLevel,
  PermissionMode,
} from '../types/executar-tasks.js';
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
  contextInjection: ContextInjection;
  maxWait: string;
  maxWaitSegundos: number;
  waitOnLimit: boolean;
  packMaxTokens: number;
  packTimeout: number;
  tasks: string;
  allow: string[];
  preflight: boolean;
  skipPreflight: boolean;
  requireCmd: string[];
  mcpTimeout: number;
  mcpCheck: boolean;
  dryRun: boolean;
  yes: boolean;
}

const EFFORT: readonly EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const CONTEXT_INJECTION: readonly ContextInjection[] = ['prompt', 'instructions'];
const PERMISSION: readonly PermissionMode[] = [
  'acceptEdits',
  'auto',
  'dontAsk',
  'manual',
  'bypassPermissions',
];

const TETO_MAX_WAIT_SEGUNDOS = 43200;
/**
 * Teto padrao da construcao do Contexto de Execucao, em segundos. Quinze
 * minutos e generoso para um destilado com opus/high e ainda assim finito: sem
 * teto, um filho travado nunca e morto e o unico recurso do usuario e o `Ctrl+C`.
 */
const PACK_TIMEOUT_PADRAO = 900;
const MAX_WAIT_PADRAO = '6h';
const RE_SEGUNDOS = /^\d+$/;
const RE_MINUTOS = /^\d+m$/;
const RE_HORAS = /^\d+h$/;
const RE_HORAS_E_MINUTOS = /^\d+h\d+m$/;

const EXEMPLO_DE_INVOCACAO =
  'Exemplo: specifica-br executar-tasks specs/features/minha-feature --model sonnet --effort medium';

/**
 * Obrigatoriedade de `--model` (RF-011) verificada aqui, e nao via
 * `requiredOption`, porque a mensagem padrao do Commander nao traz o exemplo
 * de invocacao exigido pelo PRD. Ausente ou vazia lanca a mensagem literal.
 */
function modeloObrigatorio(valor: unknown): string {
  if (valor === undefined || String(valor).trim() === '') {
    throw new Error(
      `--model é obrigatória. Informe o modelo que a ferramenta deve usar no lote. ${EXEMPLO_DE_INVOCACAO}`
    );
  }
  return String(valor);
}

/**
 * Obrigatoriedade e conjunto fechado de `--effort` (RF-011), com a mesma
 * justificativa de `modeloObrigatorio`: ausente lanca a mensagem literal de
 * obrigatoriedade; presente e fora do conjunto, a de valor invalido.
 */
function esforcoObrigatorio(valor: unknown): EffortLevel {
  if (valor === undefined || valor === '') {
    throw new Error(
      `--effort é obrigatória. Valores aceitos: low, medium, high, xhigh, max. ${EXEMPLO_DE_INVOCACAO}`
    );
  }
  const texto = String(valor);
  for (const item of EFFORT) {
    if (item === texto) {
      return item;
    }
  }
  throw new Error(
    `Valor inválido para --effort: ${texto}. Valores aceitos: low, medium, high, xhigh, max.`
  );
}

/**
 * Converte `--max-wait` (RF-026) para segundos segundo a gramatica de quatro
 * formas da secao 4.1 do techspec. O sinal negativo nao casa com nenhuma das
 * regexes, o que recusa valor negativo sem verificacao adicional.
 */
function converterMaxWait(valor: string): number {
  if (RE_SEGUNDOS.test(valor)) {
    return Number(valor);
  }
  if (RE_MINUTOS.test(valor)) {
    return Number(valor.slice(0, -1)) * 60;
  }
  if (RE_HORAS_E_MINUTOS.test(valor)) {
    const separador = valor.indexOf('h');
    return (
      Number(valor.slice(0, separador)) * 3600 +
      Number(valor.slice(separador + 1, -1)) * 60
    );
  }
  if (RE_HORAS.test(valor)) {
    return Number(valor.slice(0, -1)) * 3600;
  }
  throw new Error(
    `Valor inválido para --max-wait: ${valor}. Formas aceitas: 90 (segundos), 30m, 6h, 1h30m.`
  );
}

/**
 * Valida `--max-wait` e devolve os segundos. Padrao `6h`; acima de 12h e
 * recusado com a mensagem de teto, nunca reduzido em silencio (D11). O valor
 * `0` e aceito e significa espera desligada por teto.
 */
function validarMaxWait(valor: unknown): number {
  const texto = valor === undefined ? MAX_WAIT_PADRAO : String(valor);
  const segundos = converterMaxWait(texto);
  if (segundos > TETO_MAX_WAIT_SEGUNDOS) {
    throw new Error(`--max-wait aceita no máximo 12h. Valor recebido: ${texto}.`);
  }
  return segundos;
}

interface RegrasNumericas {
  min?: number;
  minExclusivo?: number;
  inteiro?: boolean;
}

/**
 * Valida `valor` contra um conjunto fechado, devolvendo `padrao` quando ausente.
 * O generico faz o tipo de retorno derivar do conjunto informado, provando no
 * compilador o que um `as` apenas afirmaria.
 */
function enumValido<T extends string, P extends T | ''>(
  valor: unknown,
  conjunto: readonly T[],
  padrao: P,
  nome: string
): T | P {
  if (valor === undefined || valor === '') {
    return padrao;
  }
  const texto = String(valor);
  for (const item of conjunto) {
    if (item === texto) {
      return item;
    }
  }
  throw new Error(`${nome} invalido: ${texto}. Use um de: ${conjunto.join('|')}`);
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

  // Ordem obrigatoria do Passo 0 da secao 5.1 (RNF-004): modelo, esforco,
  // teto de espera e so entao as demais validacoes, inalteradas.
  const model = modeloObrigatorio(b.model);
  const effort = esforcoObrigatorio(b.effort);
  const maxWait = b.maxWait === undefined ? MAX_WAIT_PADRAO : String(b.maxWait);
  const maxWaitSegundos = validarMaxWait(maxWait);
  const contextInjection = enumValido(
    b.contextInjection,
    CONTEXT_INJECTION,
    'prompt',
    '--context-injection'
  );
  const permissionMode = enumValido(
    b.permissionMode,
    PERMISSION,
    '',
    '--permission-mode'
  );

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
  // Teto de tempo da construcao do Contexto de Execucao (P1-3). `0` desliga o
  // teto e restaura o comportamento anterior, sem limite algum.
  const packTimeout = numero(b.packTimeout, PACK_TIMEOUT_PADRAO, '--pack-timeout', {
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
    contextInjection,
    maxWait,
    maxWaitSegundos,
    // `--no-wait-on-limit` negable entrega `false` quando informada e `true`
    // caso contrario (RF-027); `!== false` cobre tambem o `undefined`.
    waitOnLimit: b.waitOnLimit !== false,
    packMaxTokens,
    packTimeout,
    tasks,
    allow,
    preflight: flag(b.preflight),
    skipPreflight: flag(b.skipPreflight),
    requireCmd,
    mcpTimeout,
    mcpCheck: b.mcpCheck !== false,
    dryRun: flag(b.dryRun),
    yes: flag(b.yes),
  };
}
