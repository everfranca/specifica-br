import fs from 'fs-extra';
import path from 'path';
import process from 'node:process';
import { resolveHome } from './path-resolver.js';
import {
  GlobalConfig,
  ProjectConfig,
  LayoutName,
  ToolSlug,
  LAYOUT_NAMES,
  TOOL_SLUGS,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_LAYOUT,
} from '../types/config.js';

const INVALID_CONFIG_MESSAGE = '~/.specifica-br/config.json invalido. Corrija ou remova o arquivo.';
const WRITE_DENIED_MESSAGE = 'sem permissao de escrita em ~/.specifica-br/config.json';

/**
 * Servico de leitura, validacao e gravacao atomica de `~/.specifica-br/config.json`.
 *
 * Guarda as duas preferencias de RF-016: `layout` (por maquina) e `ferramenta`
 * (por projeto, chaveada pelo identificador ja resolvido). Implementa CT-010:
 * o arquivo do usuario nunca e sobrescrito quando a leitura falha, e toda
 * gravacao passa por arquivo temporario no mesmo diretorio seguido de `rename`.
 */
class GlobalConfigService {
  private readonly baseDir: string;
  public readonly configPath: string;
  public readonly logsBaseDir: string;

  private static readonly DEFAULT: GlobalConfig = {
    version: CONFIG_SCHEMA_VERSION,
    layout: DEFAULT_LAYOUT,
    projetos: {},
  };

  constructor() {
    this.baseDir = path.join(resolveHome(), '.specifica-br');
    this.configPath = path.join(this.baseDir, 'config.json');
    this.logsBaseDir = path.join(this.baseDir, 'logs');
  }

  private tempPath(): string {
    return path.join(this.baseDir, `config.${process.pid}.tmp`);
  }

  private cloneDefault(): GlobalConfig {
    return {
      version: CONFIG_SCHEMA_VERSION,
      layout: DEFAULT_LAYOUT,
      projetos: {},
    };
  }

  /**
   * Le e valida a configuracao global.
   *
   * @returns Configuracao normalizada. Arquivo ausente devolve o default em memoria.
   * @throws {Error} `INVALID_CONFIG_MESSAGE` quando o arquivo e ilegivel, tem JSON
   *   invalido, raiz nao-objeto ou `version` diferente de 1. Mensagem nominal
   *   quando uma `ferramenta` registrada esta fora dos cinco slugs.
   */
  public async load(): Promise<GlobalConfig> {
    let raw: string;

    try {
      raw = await fs.readFile(this.configPath, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOENT') {
        return this.cloneDefault();
      }

      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(INVALID_CONFIG_MESSAGE);
      }

      throw error;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(INVALID_CONFIG_MESSAGE);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(INVALID_CONFIG_MESSAGE);
    }

    const root = parsed as Record<string, unknown>;

    if (root.version !== CONFIG_SCHEMA_VERSION) {
      throw new Error(INVALID_CONFIG_MESSAGE);
    }

    const layout: LayoutName = LAYOUT_NAMES.includes(root.layout as LayoutName)
      ? (root.layout as LayoutName)
      : DEFAULT_LAYOUT;

    const projetos: Record<string, ProjectConfig> = {};
    const projetosRaw = root.projetos;

    if (projetosRaw !== undefined) {
      if (typeof projetosRaw !== 'object' || projetosRaw === null || Array.isArray(projetosRaw)) {
        throw new Error(INVALID_CONFIG_MESSAGE);
      }

      for (const [nome, valorRaw] of Object.entries(projetosRaw as Record<string, unknown>)) {
        const valor = (valorRaw ?? {}) as Record<string, unknown>;
        const ferramenta = valor.ferramenta;

        if (!TOOL_SLUGS.includes(ferramenta as ToolSlug)) {
          throw new Error(
            `ferramenta registrada ${String(ferramenta)} nao e suportada. Rode: specifica-br config`
          );
        }

        const atualizadoEm =
          typeof valor.atualizadoEm === 'string' ? valor.atualizadoEm : new Date(0).toISOString();

        projetos[nome] = { ferramenta: ferramenta as ToolSlug, atualizadoEm };
      }
    }

    return { version: CONFIG_SCHEMA_VERSION, layout, projetos };
  }

  /**
   * Grava a configuracao de forma atomica: escreve em `config.<pid>.tmp` no
   * mesmo diretorio do destino e aplica `rename`, evitando arquivo truncado e
   * `EXDEV`. O arquivo temporario nunca sobrevive a um caminho de falha.
   *
   * @param config Configuracao ja normalizada a persistir.
   * @throws {Error} `WRITE_DENIED_MESSAGE` em `EACCES` ou `EPERM`.
   */
  public async save(config: GlobalConfig): Promise<void> {
    const temp = this.tempPath();

    try {
      await fs.ensureDir(this.baseDir);
      await fs.writeFile(temp, JSON.stringify(config, null, 2), 'utf-8');
      await fs.rename(temp, this.configPath);
    } catch (error) {
      await fs.remove(temp).catch(() => undefined);

      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(WRITE_DENIED_MESSAGE);
      }

      throw error;
    }
  }

  /**
   * Layout vigente da maquina, ja normalizado para `coluna` quando invalido.
   */
  public async getLayout(): Promise<LayoutName> {
    const config = await this.load();
    return config.layout ?? DEFAULT_LAYOUT;
  }

  /**
   * Grava o layout da maquina sem tocar em nenhuma outra chave.
   *
   * @throws {Error} Quando `layout` esta fora dos quatro valores suportados.
   */
  public async setLayout(layout: LayoutName): Promise<void> {
    if (!LAYOUT_NAMES.includes(layout)) {
      throw new Error(`layout ${String(layout)} invalido. Use um de: ${LAYOUT_NAMES.join(', ')}`);
    }

    const config = await this.load();
    config.layout = layout;
    await this.save(config);
  }

  /**
   * Ferramenta de IA registrada para o projeto, ou `undefined` quando ausente.
   *
   * @param projeto Identificador do projeto ja resolvido (CT-024, task-4).
   */
  public async getProjectTool(projeto: string): Promise<ToolSlug | undefined> {
    const config = await this.load();
    return config.projetos?.[projeto]?.ferramenta;
  }

  /**
   * Registra a ferramenta do projeto informado. Ler-modificar-gravar a cada
   * chamada preserva os demais projetos mesmo sob execucao concorrente.
   *
   * @throws {Error} Quando `ferramenta` esta fora dos cinco slugs suportados.
   */
  public async setProjectTool(projeto: string, ferramenta: ToolSlug): Promise<void> {
    if (!TOOL_SLUGS.includes(ferramenta)) {
      throw new Error(`ferramenta ${String(ferramenta)} invalida. Use um de: ${TOOL_SLUGS.join(', ')}`);
    }

    const config = await this.load();
    const projetos: Record<string, ProjectConfig> = { ...(config.projetos ?? {}) };
    projetos[projeto] = { ferramenta, atualizadoEm: new Date().toISOString() };
    config.projetos = projetos;
    await this.save(config);
  }
}

export { GlobalConfigService };
export const globalConfigService = new GlobalConfigService();
