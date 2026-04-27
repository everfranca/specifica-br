import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolMapping, CopyResult } from '../types/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FileService {
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

      if (toolMapping.commands !== undefined && (typeof toolMapping.commands !== 'string' || toolMapping.commands.trim().length === 0)) {
        throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
      }

      if (toolMapping.skills !== undefined && (typeof toolMapping.skills !== 'string' || toolMapping.skills.trim().length === 0)) {
        throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
      }

      if (toolMapping.templates !== undefined && (typeof toolMapping.templates !== 'string' || toolMapping.templates.trim().length === 0)) {
        throw new Error('Erro: Arquivo tools-mapping.json com formato inválido.');
      }
    }

    return mappings as ToolMapping[];
  }

  async createStructure(toolMapping: ToolMapping): Promise<CopyResult> {
    const boilerplateRoot = path.join(__dirname, '..', 'boilerplate');
    const commandsCopied: string[] = [];
    const skillsCopied: string[] = [];
    const templatesCopied: string[] = [];

    if (toolMapping.commands) {
      const sourceDir = path.join(boilerplateRoot, 'commands');
      const destDir = path.join(process.cwd(), toolMapping.commands);

      const exists = await fs.pathExists(sourceDir);
      if (!exists) {
        throw new Error('Erro: Diretorio de commands não encontrado no boilerplate.');
      }

      try {
        await fs.ensureDir(destDir);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          throw new Error('Erro: Sem permissão para criar diretorios.');
        }
        throw error;
      }

      const files = await this.copyDirectoryContents(sourceDir, destDir);
      commandsCopied.push(...files);
    }

    if (toolMapping.skills) {
      const sourceDir = path.join(boilerplateRoot, 'skills');
      const destDir = path.join(process.cwd(), toolMapping.skills);

      const exists = await fs.pathExists(sourceDir);
      if (!exists) {
        throw new Error('Erro: Diretorio de skills não encontrado no boilerplate.');
      }

      try {
        await fs.ensureDir(destDir);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          throw new Error('Erro: Sem permissão para criar diretorios.');
        }
        throw error;
      }

      const files = await this.copySkillsRecursively(sourceDir, destDir);
      skillsCopied.push(...files);
    }

    if (toolMapping.templates) {
      const sourceDir = path.join(boilerplateRoot, 'templates');
      const destDir = path.join(process.cwd(), toolMapping.templates);

      const exists = await fs.pathExists(sourceDir);
      if (!exists) {
        throw new Error('Erro: Diretorio de templates não encontrado no boilerplate.');
      }

      try {
        await fs.ensureDir(destDir);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          throw new Error('Erro: Sem permissão para criar diretorios.');
        }
        throw error;
      }

      const files = await this.copyDirectoryContents(sourceDir, destDir);
      templatesCopied.push(...files);
    }

    const result: CopyResult = {
      commandsDir: toolMapping.commands ? path.join(process.cwd(), toolMapping.commands) : '',
      commandsCopied,
      skillsDir: toolMapping.skills ? path.join(process.cwd(), toolMapping.skills) : undefined,
      skillsCopied,
      templatesDir: toolMapping.templates ? path.join(process.cwd(), toolMapping.templates) : '',
      templatesCopied
    };

    return result;
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

      await collectFiles(destDir, destDir);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new Error('Erro: Sem permissão para copiar arquivos.');
      }
      throw error;
    }

    return copiedFiles;
  }
}
