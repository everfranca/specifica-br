import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ToolMapping,
  CopyResult,
  CopyTarget,
  GlobalPath,
  InstallScope,
  ProjectCleanup,
  TargetKind
} from '../types/init.js';
import { resolveGlobalPath } from './path-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GLOBAL_BASES = ['home', 'config'];

function isValidGlobalPath(value: unknown): value is GlobalPath {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;

  if (typeof entry.base !== 'string' || !GLOBAL_BASES.includes(entry.base)) {
    return false;
  }

  return typeof entry.path === 'string' && entry.path.trim().length > 0;
}

export class FileService {
  private readonly boilerplateRoot = path.join(__dirname, '..', 'boilerplate');

  async loadToolsMapping(): Promise<ToolMapping[]> {
    const mappingPath = path.join(__dirname, '..', 'tools-mapping.json');

    try {
      await fs.access(mappingPath);
    } catch (error) {
      throw new Error('Erro: Arquivo de mapeamento de ferramentas (tools-mapping.json) não encontrado ou inválido.');
    }

    let mappingContent: string;
    try {
      mappingContent = await fs.readFile(mappingPath, 'utf-8');
    } catch (error) {
      throw new Error('Erro: Arquivo de mapeamento de ferramentas (tools-mapping.json) não encontrado ou inválido.');
    }

    let mappings: unknown;
    try {
      mappings = JSON.parse(mappingContent);
    } catch (error) {
      throw new Error('Erro: Arquivo tools-mapping.json contém JSON inválido.');
    }

    if (!Array.isArray(mappings)) {
      throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
    }

    if (mappings.length !== 5) {
      throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
    }

    for (const mapping of mappings) {
      if (typeof mapping !== 'object' || mapping === null) {
        throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
      }

      const toolMapping = mapping as Record<string, unknown>;

      if (!toolMapping.name || typeof toolMapping.name !== 'string' || toolMapping.name.trim().length === 0) {
        throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
      }

      for (const field of ['commands', 'legacyCommands', 'skills', 'templates'] as const) {
        const value = toolMapping[field];

        if (value !== undefined && (typeof value !== 'string' || value.trim().length === 0)) {
          throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
        }
      }

      if (toolMapping.global !== undefined) {
        if (typeof toolMapping.global !== 'object' || toolMapping.global === null) {
          throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
        }

        const globalMapping = toolMapping.global as Record<string, unknown>;

        for (const field of ['commands', 'skills'] as const) {
          const value = globalMapping[field];

          if (value !== undefined && !isValidGlobalPath(value)) {
            throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
          }
        }
      }
    }

    return mappings as ToolMapping[];
  }

  /**
   * Monta a lista de destinos das ferramentas selecionadas, deduplicando por (kind, dir).
   * Ferramentas que compartilham diretorio -- Gemini CLI e OpenCode em ~/.agents/skills/,
   * ou todas em specs/templates/ -- geram um unico target creditado a todas elas.
   */
  resolveTargets(tools: ToolMapping[], scope: InstallScope): CopyTarget[] {
    const targets = new Map<string, CopyTarget>();

    const add = (kind: TargetKind, dir: string, toolName: string): void => {
      const key = `${kind}:${dir}`;
      const existing = targets.get(key);

      if (existing) {
        if (!existing.tools.includes(toolName)) {
          existing.tools.push(toolName);
        }
        return;
      }

      targets.set(key, { kind, dir, tools: [toolName], files: [] });
    };

    for (const tool of tools) {
      for (const kind of ['commands', 'skills'] as const) {
        const dir = scope === 'global'
          ? this.resolveGlobalDir(tool, kind)
          : this.resolveProjectDir(tool[kind]);

        if (dir) {
          add(kind, dir, tool.name);
        }
      }

      // Templates sao artefato versionavel do projeto e nunca vao para o escopo global.
      const templatesDir = this.resolveProjectDir(tool.templates);

      if (templatesDir) {
        add('templates', templatesDir, tool.name);
      }
    }

    return Array.from(targets.values());
  }

  private resolveGlobalDir(tool: ToolMapping, kind: 'commands' | 'skills'): string | undefined {
    const entry = tool.global?.[kind];

    if (!entry) {
      throw new Error(`Erro: Ferramenta ${tool.name} não possui diretório global mapeado para ${kind}.`);
    }

    return resolveGlobalPath(entry);
  }

  private resolveProjectDir(relative: string | undefined): string | undefined {
    return relative ? path.join(process.cwd(), relative) : undefined;
  }

  async createStructure(tools: ToolMapping[], scope: InstallScope): Promise<CopyResult> {
    const targets = this.resolveTargets(tools, scope);

    for (const target of targets) {
      const sourceDir = path.join(this.boilerplateRoot, target.kind);

      if (!(await fs.pathExists(sourceDir))) {
        throw new Error(`Erro: Diretorio de ${target.kind} não encontrado no boilerplate.`);
      }

      try {
        await fs.ensureDir(target.dir);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          throw new Error('Erro: Sem permissão para criar diretorios.');
        }
        throw error;
      }

      const files = target.kind === 'skills'
        ? await this.copySkillsRecursively(sourceDir, target.dir)
        : await this.copyDirectoryContents(sourceDir, target.dir);

      target.files.push(...files);
    }

    // No modo --local o diretorio legado do OpenCode continua sendo tratado aqui.
    // No modo global ele entra na varredura de artefatos do projeto (scanProjectArtifacts).
    const projectCleanup: ProjectCleanup = { removed: [], keptDirs: [] };

    if (scope === 'local') {
      for (const tool of tools) {
        if (!tool.commands || !tool.legacyCommands) {
          continue;
        }

        const legacyDir = path.join(process.cwd(), tool.legacyCommands);
        const result = await this.removeLegacyCommands(
          path.join(this.boilerplateRoot, 'commands'),
          legacyDir
        );

        projectCleanup.removed.push(...result.removed.map(file => path.join(legacyDir, file)));

        if (result.kept) {
          projectCleanup.keptDirs.push(legacyDir);
        }
      }
    }

    return { scope, targets, projectCleanup };
  }

  /**
   * Nomes de arquivos e diretorios que o boilerplate gera -- a base para decidir
   * o que pode ser removido de uma instalacao antiga sem tocar em arquivos de terceiros.
   */
  private async ownedEntries(kind: 'commands' | 'skills'): Promise<Set<string>> {
    const sourceDir = path.join(this.boilerplateRoot, kind);

    if (!(await fs.pathExists(sourceDir))) {
      return new Set();
    }

    return new Set(await fs.readdir(sourceDir));
  }

  /**
   * Procura instalacoes do specifica-br dentro do projeto atual, varrendo os diretorios
   * de TODAS as ferramentas -- nao apenas as selecionadas -- para que a migracao para o
   * escopo global limpe tambem restos de ferramentas usadas no passado.
   * Templates (specs/) e .specifica-br/ ficam de fora por serem artefatos do projeto.
   */
  async scanProjectArtifacts(
    toolsMapping: ToolMapping[]
  ): Promise<Array<{ dir: string; entries: string[] }>> {
    const ownedCommands = await this.ownedEntries('commands');
    const ownedSkills = await this.ownedEntries('skills');

    const candidates = new Map<string, Set<string>>();

    for (const tool of toolsMapping) {
      for (const relative of [tool.commands, tool.legacyCommands]) {
        if (relative) {
          candidates.set(path.join(process.cwd(), relative), ownedCommands);
        }
      }

      if (tool.skills) {
        candidates.set(path.join(process.cwd(), tool.skills), ownedSkills);
      }
    }

    const found: Array<{ dir: string; entries: string[] }> = [];

    for (const [dir, owned] of candidates) {
      if (!(await fs.pathExists(dir))) {
        continue;
      }

      let existing: string[];
      try {
        existing = await fs.readdir(dir);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          continue;
        }
        throw error;
      }

      const entries = existing.filter(entry => owned.has(entry));

      if (entries.length > 0) {
        found.push({ dir, entries });
      }
    }

    return found;
  }

  async cleanProjectArtifacts(
    artifacts: Array<{ dir: string; entries: string[] }>
  ): Promise<ProjectCleanup> {
    const cleanup: ProjectCleanup = { removed: [], keptDirs: [] };

    for (const artifact of artifacts) {
      const result = await this.removeOwnedEntries(artifact.dir, new Set(artifact.entries));

      cleanup.removed.push(...result.removed.map(entry => path.join(artifact.dir, entry)));

      if (result.kept) {
        cleanup.keptDirs.push(artifact.dir);
      }
    }

    return cleanup;
  }

  /**
   * Remove a instalacao antiga de comandos em um diretorio que a ferramenta nao le mais.
   * Apaga somente os arquivos que o proprio boilerplate gera; qualquer arquivo de terceiros
   * mantem o diretorio de pe, e nesse caso apenas sinalizamos para o usuario decidir.
   */
  async removeLegacyCommands(
    boilerplateCommandsDir: string,
    legacyDir: string
  ): Promise<{ removed: string[]; kept: boolean }> {
    if (!(await fs.pathExists(legacyDir))) {
      return { removed: [], kept: false };
    }

    const owned = new Set(await fs.readdir(boilerplateCommandsDir));

    return this.removeOwnedEntries(legacyDir, owned);
  }

  /**
   * Apaga de `dir` apenas as entradas presentes em `owned` -- arquivos (comandos) ou
   * diretorios (skills). Se sobrar qualquer coisa de terceiros o diretorio e preservado
   * e devolvemos `kept: true` para que o usuario decida o que fazer.
   */
  async removeOwnedEntries(dir: string, owned: Set<string>): Promise<{ removed: string[]; kept: boolean }> {
    const removed: string[] = [];

    if (!(await fs.pathExists(dir))) {
      return { removed, kept: false };
    }

    try {
      const existing = await fs.readdir(dir);

      for (const entry of existing) {
        if (!owned.has(entry)) {
          continue;
        }

        await fs.remove(path.join(dir, entry));
        removed.push(entry);
        console.log(`✓ Removido do projeto: ${path.join(dir, entry)}`);
      }

      const remaining = await fs.readdir(dir);

      if (remaining.length === 0) {
        await fs.remove(dir);
        return { removed, kept: false };
      }

      return { removed, kept: true };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new Error('Erro: Sem permissão para remover a instalação antiga de comandos.');
      }
      throw error;
    }
  }

  async copyDirectoryContents(sourceDir: string, destDir: string): Promise<string[]> {
    const copiedFiles: string[] = [];

    try {
      const files = await fs.readdir(sourceDir);

      for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        const stat = await fs.stat(sourcePath);

        if (stat.isFile()) {
          try {
            await fs.copy(sourcePath, destPath, { overwrite: true });
            copiedFiles.push(file);
            console.log(`✓ Arquivo copiado: ${file}`);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
              throw new Error('Erro: Sem permissão para copiar arquivos.');
            }
            throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new Error('Erro: Sem permissão para copiar arquivos.');
      }
      throw error;
    }

    return copiedFiles;
  }

  async copySkillsRecursively(sourceDir: string, destDir: string): Promise<string[]> {
    const copiedFiles: string[] = [];

    try {
      await fs.copy(sourceDir, destDir, { overwrite: true });

      // Enumeramos a ORIGEM, nao o destino: diretorios globais compartilhados
      // (ex.: ~/.agents/skills/) costumam ter skills de terceiros que nao foram copiadas.
      const collectFiles = async (dir: string, baseDir: string): Promise<void> => {
        const items = await fs.readdir(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          const relativePath = path.relative(baseDir, itemPath);

          if (stat.isFile()) {
            copiedFiles.push(relativePath);
            console.log(`✓ Arquivo copiado: ${relativePath}`);
          } else if (stat.isDirectory()) {
            await collectFiles(itemPath, baseDir);
          }
        }
      };

      await collectFiles(sourceDir, sourceDir);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new Error('Erro: Sem permissão para copiar arquivos.');
      }
      throw error;
    }

    return copiedFiles;
  }
}
