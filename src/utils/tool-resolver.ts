import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import prompts from 'prompts';
import type { ToolSlug } from '../types/config.js';
import { TOOL_SLUGS } from '../types/config.js';
import type { GlobalConfigService } from './global-config-service.js';
import type { FileService } from './file-service.js';
import { getToolDisplayName, normalizeToolSlug } from './tool-adapters/tool-registry.js';
import { createPainter, detectLevel, status } from './terminal/index.js';

const DETECCAO_INCONCLUSIVA_MESSAGE =
  'nenhuma ferramenta registrada para este projeto e a deteccao foi inconclusiva. Informe --tool';

const NOME_MAPEAMENTO_PARA_SLUG: Record<string, ToolSlug> = {
  ClaudeCode: 'claudecode',
  Cursor: 'cursor',
  'Gemini CLI': 'gemini-cli',
  Kiro: 'kiro',
  OpenCode: 'opencode',
};

/**
 * Entrada interativa injetavel: envolve a biblioteca `prompts` para permitir teste
 * sem TTY. `undefined` sinaliza cancelamento (Ctrl+C), que em `prompts` nao lanca:
 * a promessa resolve com a chave da pergunta ausente.
 */
export interface EntradaInterativa {
  selecionarFerramenta(
    choices: { title: string; value: ToolSlug }[]
  ): Promise<ToolSlug | undefined>;
}

/**
 * Emissao padrao das mensagens do resolver. Passa pelo `status()` e pela paleta
 * (RF-013): nenhuma linha do comando e escrita com `console.log` cru. O comando
 * injeta o proprio `painter` para nao recriar a deteccao de cor.
 */
const emitirInfoPadrao = (texto: string): void => {
  process.stdout.write(`${status('info', texto, createPainter(detectLevel()))}\n`);
};

const entradaInterativaPadrao: EntradaInterativa = {
  async selecionarFerramenta(choices) {
    const resposta = await prompts({
      type: 'select',
      name: 'ferramenta',
      message: 'Selecione a ferramenta de IA para este projeto:',
      choices,
    });

    return resposta.ferramenta as ToolSlug | undefined;
  },
};

/**
 * Resolve a ferramenta de IA de um projeto na ordem de RF-011: `--tool` informado,
 * depois o valor registrado, depois a deteccao pelos diretorios `commands` que o
 * `init` cria. A ferramenta efetivamente usada e sempre gravada como a ultima do
 * projeto, exceto quando a selecao interativa foi cancelada.
 */
export class ToolResolver {
  constructor(
    private readonly config: GlobalConfigService,
    private readonly fileService: FileService,
    private readonly entradaInterativa: EntradaInterativa = entradaInterativaPadrao,
    private readonly isTTY: () => boolean = () => Boolean(process.stdin.isTTY),
    private readonly onInfo: (texto: string) => void = emitirInfoPadrao
  ) {}

  /**
   * @param projeto Identificador do projeto ja resolvido (CT-024).
   * @param toolOpcao Valor de `--tool`, quando informado.
   * @param cwd Raiz do projeto onde procurar os diretorios de deteccao.
   * @returns O slug resolvido, ou `null` quando a selecao interativa foi cancelada
   *   pelo usuario — nesse caso nada e gravado.
   * @throws {Error} Quando `--tool` traz um valor fora dos cinco slugs, ou quando a
   *   deteccao e inconclusiva fora de um terminal interativo.
   */
  public async resolve(
    projeto: string,
    toolOpcao: string | undefined,
    cwd: string
  ): Promise<ToolSlug | null> {
    const resolvida = await this.determinar(projeto, toolOpcao, cwd);

    if (resolvida === null) {
      return null;
    }

    await this.config.setProjectTool(projeto, resolvida);
    return resolvida;
  }

  private async determinar(
    projeto: string,
    toolOpcao: string | undefined,
    cwd: string
  ): Promise<ToolSlug | null> {
    if (toolOpcao !== undefined && toolOpcao !== '') {
      const slug = normalizeToolSlug(toolOpcao);

      if (!slug) {
        throw new Error(
          `ferramenta ${toolOpcao} invalida. Use um de: ${TOOL_SLUGS.join(', ')}`
        );
      }

      return slug;
    }

    const registrada = await this.config.getProjectTool(projeto);
    if (registrada) {
      return registrada;
    }

    const detectadas = await this.detectar(cwd);

    if (detectadas.length === 1) {
      this.onInfo(`ferramenta detectada: ${getToolDisplayName(detectadas[0])}`);
      return detectadas[0];
    }

    if (this.isTTY()) {
      const choices = TOOL_SLUGS.map((slug) => ({
        title: getToolDisplayName(slug),
        value: slug,
      }));

      // prompts nao lanca em Ctrl+C: a chave fica ausente e a chamada resolve.
      // Testar por undefined e a unica forma correta; try/catch nao funcionaria.
      const escolhida = await this.entradaInterativa.selecionarFerramenta(choices);
      return escolhida ?? null;
    }

    throw new Error(DETECCAO_INCONCLUSIVA_MESSAGE);
  }

  private async detectar(cwd: string): Promise<ToolSlug[]> {
    const mapeamento = await this.fileService.loadToolsMapping();
    const encontradas: ToolSlug[] = [];

    for (const tool of mapeamento) {
      const slug = NOME_MAPEAMENTO_PARA_SLUG[tool.name];

      if (!slug || !tool.commands) {
        continue;
      }

      const diretorioComandos = path.join(cwd, tool.commands);

      if (await fs.pathExists(diretorioComandos)) {
        encontradas.push(slug);
      }
    }

    return encontradas;
  }
}
