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
  projetos?: Record<string, ProjectConfig>;
}

export const CONFIG_SCHEMA_VERSION = 1;

export const DEFAULT_LAYOUT: LayoutName = 'coluna';
