import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FileService {
  async createStructure(directoryConvention: 'opencode' | 'specifica-br'): Promise<void> {
    const commandsDestDir = directoryConvention === 'opencode'
      ? path.join(process.cwd(), '.opencode', 'commands')
      : path.join(process.cwd(), 'specifica-br', 'commands');

    console.log(`• Criando diretórios com convenção: ${directoryConvention}`);
    await this.createDirectories(commandsDestDir, path.join(process.cwd(), 'specs', 'templates'));
    await this.copyTemplates(commandsDestDir);
  }

  private async createDirectories(commandsDestDir: string, templatesDestDir: string): Promise<void> {
    try {
      await fs.ensureDir(commandsDestDir);
      console.log(`✓ Diretório criado: ${commandsDestDir}`);

      await fs.ensureDir(templatesDestDir);
      console.log(`✓ Diretório criado: ${templatesDestDir}`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
        throw new Error('Erro: Sem permissão para criar diretórios.');
      }
      throw error;
    }
  }

  private async copyTemplates(commandsDestDir: string): Promise<void> {
    const distRoot = path.resolve(__dirname, '..', 'boilerplate');

    const templateFiles = [
      {
        source: path.join(distRoot, 'opencode-commands', 'gerar-prd.md'),
        dest: path.join(commandsDestDir, 'gerar-prd.md')
      },
      {
        source: path.join(distRoot, 'opencode-commands', 'gerar-techspec.md'),
        dest: path.join(commandsDestDir, 'gerar-techspec.md')
      },
      {
        source: path.join(distRoot, 'opencode-commands', 'gerar-tasks.md'),
        dest: path.join(commandsDestDir, 'gerar-tasks.md')
      },
      {
        source: path.join(distRoot, 'opencode-commands', 'executar-task.md'),
        dest: path.join(commandsDestDir, 'executar-task.md')
      },
      {
        source: path.join(distRoot, 'specs-templates', 'prd-template.md'),
        dest: path.join(process.cwd(), 'specs', 'templates', 'prd-template.md')
      },
      {
        source: path.join(distRoot, 'specs-templates', 'techspec-template.md'),
        dest: path.join(process.cwd(), 'specs', 'templates', 'techspec-template.md')
      },
      {
        source: path.join(distRoot, 'specs-templates', 'task-template.md'),
        dest: path.join(process.cwd(), 'specs', 'templates', 'task-template.md')
      },
      {
        source: path.join(distRoot, 'specs-templates', 'tasks-template.md'),
        dest: path.join(process.cwd(), 'specs', 'templates', 'tasks-template.md')
      }
    ];

    for (const { source, dest } of templateFiles) {
      if (await fs.pathExists(source)) {
        await fs.copy(source, dest, { overwrite: true });
        console.log(`✓ Arquivo copiado: ${path.basename(dest)}`);
      } else {
        throw new Error(`Erro: Diretório de templates não encontrado em ${source}`);
      }
    }
  }
}
