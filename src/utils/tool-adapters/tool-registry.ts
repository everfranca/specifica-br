import type { ToolSlug } from '../../types/config.js';
import { TOOL_SLUGS } from '../../types/config.js';
import type { ToolAdapter, ToolCapabilities } from '../../types/tool-adapter.js';
import { ClaudeCodeAdapter } from './claude-code-adapter.js';

interface RegistroFerramenta {
  slug: ToolSlug;
  nomeExibicao: string;
  executavel: string;
  contratoValidado: boolean;
  capacidades: ToolCapabilities;
}

const TODAS_LIGADAS: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: true,
  consultaAosMcps: true,
};

const NENHUMA: ToolCapabilities = {
  execucaoNaoInterativa: false,
  modoSemPromptDePermissao: false,
  saidaEstruturadaComTokens: false,
  identificadorDeSessao: false,
  injecaoDeContextoNoSystemPrompt: false,
  liberacaoDeDiretoriosDeLeitura: false,
  consultaAosMcps: false,
};

/**
 * Registro das cinco ferramentas suportadas. Apenas `claudecode` tem contrato de
 * execucao validado nesta versao; as outras quatro sao reconhecidas pelo mecanismo
 * e recusadas com mensagem nominal ate que seus contratos sejam preenchidos em
 * entregas posteriores (RF-012, out-of-scope declarado do PRD).
 */
const REGISTRO: Record<ToolSlug, RegistroFerramenta> = {
  claudecode: {
    slug: 'claudecode',
    nomeExibicao: 'ClaudeCode',
    executavel: 'claude',
    contratoValidado: true,
    capacidades: TODAS_LIGADAS,
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
    contratoValidado: false,
    capacidades: NENHUMA,
  },
};

let adapterClaudeCode: ClaudeCodeAdapter | undefined;

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
 * As sete capacidades declaradas da ferramenta (RF-012).
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
 * Devolve o adapter da ferramenta. Ferramenta sem contrato validado e recusada com
 * a mensagem nominal de RF-012, antes do inicio do lote.
 *
 * @throws {Error} `contrato de execucao de <ferramenta> ainda nao validado nesta
 *   versao. Disponivel: ClaudeCode`
 */
export function getAdapter(slug: ToolSlug): ToolAdapter {
  const registro = REGISTRO[slug];

  if (!registro.contratoValidado) {
    throw new Error(
      `contrato de execucao de ${registro.nomeExibicao} ainda nao validado nesta versao. Disponivel: ClaudeCode`
    );
  }

  if (!adapterClaudeCode) {
    adapterClaudeCode = new ClaudeCodeAdapter();
  }

  return adapterClaudeCode;
}
