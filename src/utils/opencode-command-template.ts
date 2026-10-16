import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TemplateResolvido {
  caminho: string;
  corpo: string;
  origem: 'projeto' | 'global' | 'pacote';
}

export const NOME_ARQUIVO_TEMPLATE = 'executar-task.md';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolverDiretorioConfig(home: string): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(home, '.config');
}

function caminhoPacote(): string {
  return path.join(__dirname, '..', 'boilerplate', 'commands', NOME_ARQUIVO_TEMPLATE);
}

export function removerFrontmatter(texto: string): string {
  const linhas: string[] = texto.split('\n');
  if (linhas.length === 0 || linhas[0].trim() !== '---') {
    return texto.trim();
  }
  let fechamento = -1;
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i].trim() === '---') {
      fechamento = i;
      break;
    }
  }
  if (fechamento === -1) {
    return texto.trim();
  }
  return linhas.slice(fechamento + 1).join('\n').trim();
}

export function detectarMarcadores(corpo: string): boolean {
  if (corpo.includes('$ARGUMENTS')) {
    return true;
  }
  if (/\$[1-9]/.test(corpo)) {
    return true;
  }
  const linhas: string[] = corpo.split('\n');
  for (const linha of linhas) {
    if (linha.trimStart().startsWith('```!')) {
      return true;
    }
  }
  return false;
}

export async function resolverTemplateDoComando(projetoDir: string, home: string, pacotePathOverride?: string): Promise<TemplateResolvido | null> {
  const configDir: string = resolverDiretorioConfig(home);
  const pacote: string = pacotePathOverride ?? caminhoPacote();
  const candidatos: Array<{ caminho: string; origem: TemplateResolvido['origem'] }> = [
    { caminho: path.join(projetoDir, '.opencode', 'command', NOME_ARQUIVO_TEMPLATE), origem: 'projeto' },
    { caminho: path.join(projetoDir, '.opencode', 'commands', NOME_ARQUIVO_TEMPLATE), origem: 'projeto' },
    { caminho: path.join(configDir, 'opencode', 'command', NOME_ARQUIVO_TEMPLATE), origem: 'global' },
    { caminho: path.join(configDir, 'opencode', 'commands', NOME_ARQUIVO_TEMPLATE), origem: 'global' },
    { caminho: pacote, origem: 'pacote' },
  ];
  for (const candidato of candidatos) {
    let existe = false;
    try {
      existe = await fs.pathExists(candidato.caminho);
    } catch {
      continue;
    }
    if (!existe) {
      continue;
    }
    try {
      const bruto: string = await fs.readFile(candidato.caminho, 'utf-8');
      return { caminho: candidato.caminho, corpo: removerFrontmatter(bruto), origem: candidato.origem };
    } catch {
      continue;
    }
  }
  return null;
}
