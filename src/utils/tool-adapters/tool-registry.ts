import type { ToolSlug } from '../../types/config.js';
import { TOOL_SLUGS } from '../../types/config.js';
import type { ToolAdapter, ToolCapabilities } from '../../types/tool-adapter.js';
import type { OpenCodeExecutorConfigService } from '../opencode-executor-config.js';
import type { ProcessRunner } from '../process-runner.js';
import { ClaudeCodeAdapter } from './claude-code-adapter.js';
import { OpenCodeAdapter } from './opencode-adapter.js';

interface RegistroFerramenta {
  slug: ToolSlug;
  nomeExibicao: string;
  executavel: string;
  contratoValidado: boolean;
  capacidades: ToolCapabilities;
}

const CAPACIDADES_CLAUDECODE: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: true,
  consultaAosMcps: true,
  relatoDeCustoEmUSD: true,
  tetoDeCustoNativo: true,
  modeloDeFallback: true,
  otimizacaoDeCacheDePrompt: true,
  relatoDeNegacoesDePermissao: true,
  formaDeInjecaoSelecionavel: false,
  relatoDeModeloEfetivo: true,
};

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

const NENHUMA: ToolCapabilities = {
  execucaoNaoInterativa: false,
  modoSemPromptDePermissao: false,
  saidaEstruturadaComTokens: false,
  identificadorDeSessao: false,
  injecaoDeContextoNoSystemPrompt: false,
  liberacaoDeDiretoriosDeLeitura: false,
  consultaAosMcps: false,
  relatoDeCustoEmUSD: false,
  tetoDeCustoNativo: false,
  modeloDeFallback: false,
  otimizacaoDeCacheDePrompt: false,
  relatoDeNegacoesDePermissao: false,
  formaDeInjecaoSelecionavel: false,
  relatoDeModeloEfetivo: false,
};

/**
 * Registro das cinco ferramentas suportadas. `claudecode` e `opencode` tem contrato
 * de execucao validado nesta versao; as outras tres sao reconhecidas pelo mecanismo
 * e recusadas com mensagem nominal ate que seus contratos sejam preenchidos em
 * entregas posteriores (RF-001, RF-019).
 */
const REGISTRO: Record<ToolSlug, RegistroFerramenta> = {
  claudecode: {
    slug: 'claudecode',
    nomeExibicao: 'ClaudeCode',
    executavel: 'claude',
    contratoValidado: true,
    capacidades: CAPACIDADES_CLAUDECODE,
  },
  cursor: {
    slug: 'cursor',
    nomeExibicao: 'Cursor',
    executavel: 'cursor',
    contratoValidado: false,
    capacidades: NENHUMA,
  },
  'gemini-cli': {
    slug: 'gemini-cli',
    nomeExibicao: 'Gemini CLI',
    executavel: 'gemini',
    contratoValidado: false,
    capacidades: NENHUMA,
  },
  kiro: {
    slug: 'kiro',
    nomeExibicao: 'Kiro',
    executavel: 'kiro',
    contratoValidado: false,
    capacidades: NENHUMA,
  },
  opencode: {
    slug: 'opencode',
    nomeExibicao: 'OpenCode',
    executavel: 'opencode',
    contratoValidado: true,
    capacidades: CAPACIDADES_OPENCODE,
  },
};

/**
 * Nomes de exibicao das ferramentas de contrato validado, na ordem da mensagem
 * nominal de RF-019. Fonte unica: a recusa do `getAdapter` e o guarda da etapa
 * interativa de `config` reutilizam este texto em vez de copia-lo.
 */
export const NOMES_DISPONIVEIS = 'ClaudeCode, OpenCode';

let adapterClaudeCode: ClaudeCodeAdapter | undefined;
let adapterOpenCode: OpenCodeAdapter | undefined;

/**
 * Normaliza um valor de ferramenta sem distincao de caixa (RF-021, Nota de Decisao 3
 * da techspec) e devolve o slug canonico, ou `null` quando nao e uma das cinco.
 */
export function normalizeToolSlug(valor: string): ToolSlug | null {
  const alvo = valor.trim().toLowerCase();
  return TOOL_SLUGS.find((slug) => slug === alvo) ?? null;
}

/**
 * Nome de exibicao da ferramenta (`ClaudeCode`, `Cursor`, `Gemini CLI`, `Kiro`,
 * `OpenCode`).
 */
export function getToolDisplayName(slug: ToolSlug): string {
  return REGISTRO[slug].nomeExibicao;
}

/**
 * Nome do executavel da CLI da ferramenta. Fonte unica: nenhum outro modulo declara
 * esse nome, nem o repete como literal destinado a saida ao usuario.
 */
export function getExecutavel(slug: ToolSlug): string {
  return REGISTRO[slug].executavel;
}

/**
 * As treze capacidades declaradas da ferramenta (CT-038).
 */
export function getCapabilities(slug: ToolSlug): ToolCapabilities {
  return { ...REGISTRO[slug].capacidades };
}

/**
 * Verdadeiro quando o contrato de execucao da ferramenta ja foi validado nesta versao.
 */
export function isContratoValidado(slug: ToolSlug): boolean {
  return REGISTRO[slug].contratoValidado;
}

/**
 * Dependencias que o comando injeta no adapter no momento da construcao. Todas
 * opcionais: a construcao sem nenhuma delas continua valendo, e e a usada pelos
 * pontos que so precisam do contrato (preflight, resolucao de capacidades).
 */
export interface AdapterDeps {
  /** Criador de processos filhos, sempre com `shell: false`. */
  runner?: ProcessRunner;
  /**
   * Instancia **unica** do ciclo de vida do arquivo de apoio de CT-035. Precisa
   * ser a mesma que o comando usa para gravar: `buildEnv` le o caminho dela, e
   * duas instancias fariam `OPENCODE_CONFIG` nunca ser exportada (ENV-002).
   */
  configService?: OpenCodeExecutorConfigService;
  /** Canal dos avisos nominais de RF-007 e RF-009, sem prefixo. */
  onAviso?: (mensagem: string) => void;
}

/**
 * Devolve o adapter da ferramenta. Ferramenta sem contrato validado e recusada com
 * a mensagem nominal de RF-019, antes do inicio do lote e sem consumir tokens.
 *
 * Chamada **com** dependencias constroi um adapter novo; so a chamada sem elas
 * reaproveita o memo do modulo. Memorizar a construcao com dependencia faria o
 * servico de um lote vazar para todos os seguintes do mesmo processo.
 *
 * @throws {Error} `contrato de execucao de <ferramenta> ainda nao validado nesta
 *   versao. Disponiveis: ClaudeCode, OpenCode`
 */
export function getAdapter(slug: ToolSlug, deps: AdapterDeps = {}): ToolAdapter {
  const registro = REGISTRO[slug];

  if (!registro.contratoValidado) {
    throw new Error(
      `contrato de execucao de ${registro.nomeExibicao} ainda nao validado nesta versao. Disponiveis: ${NOMES_DISPONIVEIS}`
    );
  }

  const temDeps =
    deps.runner !== undefined || deps.configService !== undefined || deps.onAviso !== undefined;

  if (slug === 'opencode') {
    if (temDeps) {
      return new OpenCodeAdapter(deps.runner, deps.configService, deps.onAviso);
    }
    if (!adapterOpenCode) {
      adapterOpenCode = new OpenCodeAdapter();
    }
    return adapterOpenCode;
  }

  if (deps.runner !== undefined) {
    return new ClaudeCodeAdapter(deps.runner);
  }

  if (!adapterClaudeCode) {
    adapterClaudeCode = new ClaudeCodeAdapter();
  }

  return adapterClaudeCode;
}
