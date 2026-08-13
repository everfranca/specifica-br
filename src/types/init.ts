export type GlobalBase = 'home' | 'config';

export type InstallScope = 'global' | 'local';

export type TargetKind = 'commands' | 'skills' | 'templates';

export interface GlobalPath {
  base: GlobalBase;
  path: string;
}

export interface ToolMapping {
  name: string;
  commands?: string;
  legacyCommands?: string;
  skills?: string;
  templates?: string;
  global?: {
    commands?: GlobalPath;
    skills?: GlobalPath;
  };
}

export interface InitAnswers {
  toolNames: string[];
  scope: InstallScope;
}

/**
 * Destino resolvido de uma copia. Ferramentas diferentes podem apontar para o mesmo
 * diretorio (ex.: Gemini CLI e OpenCode compartilham ~/.agents/skills/); nesse caso
 * existe um unico target e `tools` lista todas as ferramentas atendidas por ele.
 */
export interface CopyTarget {
  kind: TargetKind;
  dir: string;
  tools: string[];
  files: string[];
}

export interface ProjectCleanup {
  removed: string[];
  keptDirs: string[];
}

export interface CopyResult {
  scope: InstallScope;
  targets: CopyTarget[];
  projectCleanup: ProjectCleanup;
}
