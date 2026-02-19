import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDirectories(): void {
  const directoriesToCreate = [
    path.join(process.cwd(), '.opencode', 'commands'),
    path.join(process.cwd(), 'specs', 'templates')
  ];

  directoriesToCreate.forEach((dir) => {
    try {
      fs.ensureDirSync(dir);
      console.log(`Diretório criado: ${dir}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao criar diretório ${dir}: ${error.message}`);
      }
      throw new Error(`Erro ao criar diretório ${dir}`);
    }
  });
}

export function copyTemplates(): void {
  const distRoot = path.resolve(__dirname, '..');
  const boilerplateDir = path.join(distRoot, 'boilerplate');
  
  const templateFiles = [
    {
      source: path.join(boilerplateDir, 'opencode-commands', 'gerar-prd.md'),
      dest: path.join(process.cwd(), '.opencode', 'commands', 'gerar-prd.md')
    },
    {
      source: path.join(boilerplateDir, 'opencode-commands', 'gerar-techspec.md'),
      dest: path.join(process.cwd(), '.opencode', 'commands', 'gerar-techspec.md')
    },
    {
      source: path.join(boilerplateDir, 'opencode-commands', 'gerar-tasks.md'),
      dest: path.join(process.cwd(), '.opencode', 'commands', 'gerar-tasks.md')
    },
    {
      source: path.join(boilerplateDir, 'opencode-commands', 'executar-task.md'),
      dest: path.join(process.cwd(), '.opencode', 'commands', 'executar-task.md')
    },
    {
      source: path.join(boilerplateDir, 'specs-templates', 'prd-template.md'),
      dest: path.join(process.cwd(), 'specs', 'templates', 'prd-template.md')
    },
    {
      source: path.join(boilerplateDir, 'specs-templates', 'techspec-template.md'),
      dest: path.join(process.cwd(), 'specs', 'templates', 'techspec-template.md')
    },
    {
      source: path.join(boilerplateDir, 'specs-templates', 'task-template.md'),
      dest: path.join(process.cwd(), 'specs', 'templates', 'task-template.md')
    },
    {
      source: path.join(boilerplateDir, 'specs-templates', 'tasks-template.md'),
      dest: path.join(process.cwd(), 'specs', 'templates', 'tasks-template.md')
    }
  ];

  templateFiles.forEach(({ source, dest }) => {
    try {
      fs.copySync(source, dest, { overwrite: true });
      console.log(`Arquivo copiado: ${path.basename(dest)}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao copiar arquivo ${source}: ${error.message}`);
      }
      throw new Error(`Erro ao copiar arquivo ${source}`);
    }
  });
}
