import { Command } from 'commander';
import prompts from 'prompts';

import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';
import { GlobalConfigService } from '../utils/global-config-service.js';
import { ProcessRunner } from '../utils/process-runner.js';
import { ProjectIdentityService } from '../utils/project-identity.js';
import {
  createPainter,
  detectLevel,
  detectGlyphLevel,
  signature,
  status,
} from '../utils/terminal/index.js';
import type { Painter } from '../utils/terminal/index.js';
import { buildPreview } from '../utils/layout-preview.js';
import {
  validateChave,
  validateLayoutValor,
  validateFerramentaValor,
} from '../utils/config-command-validation.js';
import { shortenPath } from '../utils/path-resolver.js';
import { LAYOUT_NAMES, DEFAULT_LAYOUT } from '../types/config.js';
import type { LayoutName, ToolSlug } from '../types/config.js';

/**
 * Parametros passados a selecao interativa do layout. `initial` e o INDICE da
 * opcao marcada dentro de `choices`, nunca o nome do layout (contrato do tipo
 * `select` de `prompts`, verificado na documentacao oficial).
 */
export interface SelectLayoutParams {
  choices: Array<{ title: string; value: LayoutName }>;
  initial: number;
  optionsPerPage: number;
}

/**
 * Portas de entrada e saida do comando, injetaveis para teste. A selecao
 * devolve `undefined` quando o usuario cancela (Ctrl+C): `prompts` nao lanca
 * excecao nesse caso, resolve com a chave da pergunta ausente.
 */
export interface ConfigIO {
  write(texto: string): void;
  writeErr(texto: string): void;
  isTTY: boolean;
  selectLayout(params: SelectLayoutParams): Promise<LayoutName | undefined>;
}

export interface ConfigDeps {
  configService: GlobalConfigService;
  identityService: ProjectIdentityService;
  io: ConfigIO;
}

const LARGURA_PREVIEW = 72;

/**
 * Bloco literal de CT-002: as quatro linhas Arquivo, Layout, Projeto e
 * Ferramenta, sempre exibidas antes de qualquer gravacao ou selecao.
 */
function exibirConfigVigente(
  io: ConfigIO,
  painter: Painter,
  configPath: string,
  layout: LayoutName,
  projeto: string,
  ferramenta: ToolSlug | undefined
): void {
  const ferramentaTexto = ferramenta
    ? ferramenta
    : 'nao registrada (rode: specifica-br config ferramenta <slug>)';

  io.write(`${signature(painter)}  config\n`);
  io.write('\n');
  io.write(`  Arquivo        ${shortenPath(configPath)}\n`);
  io.write(`  Layout         ${layout}\n`);
  io.write(`  Projeto        ${projeto}\n`);
  io.write(`  Ferramenta     ${ferramentaTexto}\n`);
}

/**
 * Fluxo de `config` (techspec secao 5.1). Devolve o codigo de saida do processo:
 * `0` quando exibe, grava ou o usuario cancela; `1` para argumento invalido ou
 * configuracao global invalida.
 */
export async function runConfig(
  chave: string | undefined,
  valor: string | undefined,
  deps: ConfigDeps
): Promise<number> {
  const { configService, identityService, io } = deps;
  const painter = createPainter(detectLevel());

  let config;
  try {
    // Arquivo invalido lanca aqui e nunca e sobrescrito (CT-010).
    config = await configService.load();
  } catch (erro) {
    io.writeErr(`${status('erro', (erro as Error).message, painter)}\n`);
    return 1;
  }

  const identidade = await identityService.resolve();
  const layoutAtual = config.layout ?? DEFAULT_LAYOUT;
  const ferramentaAtual = config.projetos?.[identidade.nome]?.ferramenta;

  exibirConfigVigente(
    io,
    painter,
    configService.configPath,
    layoutAtual,
    identidade.nome,
    ferramentaAtual
  );

  // Forma com argumentos: valida e grava direto, sem nenhuma interacao (CT-002).
  if (chave !== undefined) {
    try {
      const chaveValida = validateChave(chave);

      if (valor === undefined || valor === '') {
        io.writeErr(
          `${status(
            'erro',
            `valor obrigatorio: specifica-br config ${chaveValida} <valor>`,
            painter
          )}\n`
        );
        return 1;
      }

      if (chaveValida === 'layout') {
        const layout = validateLayoutValor(valor);
        await configService.setLayout(layout);
        io.write(`${status('ok', `layout definido como ${layout}`, painter)}\n`);
      } else {
        const slug = validateFerramentaValor(valor);
        await configService.setProjectTool(identidade.nome, slug);
        io.write(
          `${status(
            'ok',
            `ferramenta do projeto ${identidade.nome} definida como ${slug}`,
            painter
          )}\n`
        );
      }

      return 0;
    } catch (erro) {
      io.writeErr(`${status('erro', (erro as Error).message, painter)}\n`);
      return 1;
    }
  }

  // Sem argumentos e sem TTY: a vigente ja foi exibida, encerra com 0 (CT-002).
  if (!io.isTTY) {
    return 0;
  }

  // Sem argumentos e com TTY: selecao interativa, exclusivamente de layout
  // (RF-016). A ferramenta so muda pela forma com argumentos.
  const glyphLevel = detectGlyphLevel();
  io.write('\n');

  const choices = LAYOUT_NAMES.map((nome) => {
    const marca = nome === layoutAtual ? ' (atual)' : '';
    const preview = buildPreview(nome, { painter, glyphLevel, largura: LARGURA_PREVIEW })
      .map((linha) => `    ${linha}`)
      .join('\n');
    return { title: `${nome}${marca}\n${preview}`, value: nome };
  });

  const escolha = await io.selectLayout({
    choices,
    initial: LAYOUT_NAMES.indexOf(layoutAtual),
    optionsPerPage: LAYOUT_NAMES.length,
  });

  if (escolha === undefined) {
    // Cancelamento: nao grava nada e encerra com 0.
    return 0;
  }

  await configService.setLayout(escolha);
  io.write(`${status('ok', `layout definido como ${escolha}`, painter)}\n`);
  return 0;
}

function criarIOPadrao(): ConfigIO {
  return {
    write: (texto) => {
      process.stdout.write(texto);
    },
    writeErr: (texto) => {
      process.stderr.write(texto);
    },
    isTTY: Boolean(process.stdin.isTTY),
    async selectLayout({ choices, initial, optionsPerPage }) {
      // optionsPerPage e valido no runtime de prompts 2.4.2, mas ausente do
      // @types/prompts; o cast preserva a checagem do restante do objeto.
      const pergunta = {
        type: 'select' as const,
        name: 'layout' as const,
        message: 'Escolha o layout',
        choices,
        initial,
        optionsPerPage,
      };
      const resposta = await prompts(pergunta as unknown as Parameters<typeof prompts>[0]);
      return resposta.layout as LayoutName | undefined;
    },
  };
}

async function acao(chave: string | undefined, valor: string | undefined): Promise<void> {
  const deps: ConfigDeps = {
    configService: new GlobalConfigService(),
    identityService: new ProjectIdentityService(new ProcessRunner()),
    io: criarIOPadrao(),
  };

  process.exitCode = await runConfig(chave, valor, deps);
}

async function acaoEnvolvida(
  chave: string | undefined,
  valor: string | undefined
): Promise<void> {
  await updateNotifierMiddleware.wrap('config', () => acao(chave, valor));
}

/**
 * Subcomando `config` (CT-002, RF-016). Dois argumentos posicionais opcionais:
 * sem eles, exibe a configuracao vigente e abre a selecao de layout com
 * pre-visualizacao dos quatro; com eles, grava layout ou ferramenta sem
 * interacao.
 */
export const configCommand = new Command('config')
  .description('Exibe e altera o layout (por maquina) e a ferramenta de IA (por projeto)')
  .argument('[chave]', 'layout ou ferramenta')
  .argument('[valor]', 'valor a gravar')
  .action(acaoEnvolvida);
