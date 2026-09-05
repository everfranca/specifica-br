export type LayoutName = 'coluna' | 'moldura' | 'regua' | 'lote';

export type ToolSlug = 'claudecode' | 'cursor' | 'gemini-cli' | 'kiro' | 'opencode';

export const LAYOUT_NAMES: readonly LayoutName[] = ['coluna', 'moldura', 'regua', 'lote'];

export const TOOL_SLUGS: readonly ToolSlug[] = ['claudecode', 'cursor', 'gemini-cli', 'kiro', 'opencode'];

export interface ProjectConfig {
  ferramenta: ToolSlug;
  atualizadoEm: string;
}

export interface GlobalConfig {
  version: number;
  layout?: LayoutName;
  cabecalho?: HeaderStyle;
  projetos?: Record<string, ProjectConfig>;
}

export const CONFIG_SCHEMA_VERSION = 1;

export const DEFAULT_LAYOUT: LayoutName = 'coluna';

/**
 * Estilo do cabecalho de abertura do lote (RF-005). Uniao literal, e nunca uma
 * `string` solta: as tres formas sao um conjunto fechado, decidido por
 * `renderCabecalho`, e um valor fora dele nao deve poder ser construido.
 *
 * A chave e independente de `LayoutName`: o cabecalho e por maquina e nao
 * depende da estrategia de layout (techspec secao 3.1).
 */
export type HeaderStyle = 'painel' | 'regua' | 'compacto';

export const HEADER_STYLE_NAMES: readonly HeaderStyle[] = ['painel', 'regua', 'compacto'];

export const DEFAULT_HEADER_STYLE: HeaderStyle = 'painel';

/**
 * Configuracao ja normalizada por `GlobalConfigService.load()`: `cabecalho` e
 * opcional NO ARQUIVO (a configuracao da 1.9.0 nao tem a chave, e continua
 * valida) e obrigatorio NO DOMINIO, porque a leitura resolve valor ausente ou
 * invalido para `DEFAULT_HEADER_STYLE`. Quem consome `load()` nunca precisa
 * repetir essa queda (techspec secao 3.1, CT-042).
 */
export type ResolvedGlobalConfig = GlobalConfig & { cabecalho: HeaderStyle };
