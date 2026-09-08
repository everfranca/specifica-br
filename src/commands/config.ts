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
  GLYPH,
  LEVEL,
} from '../utils/terminal/index.js';
import type { Painter, ColorLevel, GlyphLevel } from '../utils/terminal/index.js';
import { buildPreview, buildHeaderPreview } from '../utils/layout-preview.js';
import {
  validateChave,
  validateLayoutValor,
  validateCabecalhoValor,
  validateFerramentaValor,
} from '../utils/config-command-validation.js';
import {
  getToolDisplayName,
  getExecutavel,
  isContratoValidado,
  NOMES_DISPONIVEIS,
} from '../utils/tool-adapters/tool-registry.js';
import { shortenPath } from '../utils/path-resolver.js';
import { LAYOUT_NAMES, DEFAULT_LAYOUT, HEADER_STYLE_NAMES } from '../types/config.js';
import type { HeaderStyle, LayoutName, ToolSlug } from '../types/config.js';

/**
 * Parametros passados a selecao interativa do layout. `initial` e o INDICE da
 * opcao marcada dentro de `choices`, nunca o nome do layout (contrato do tipo
 * `select` de `prompts`, verificado na documentacao oficial). O `hint` e o
 * texto de navegacao que o `select` exibe no lugar do padrao dele.
 */
export interface SelectLayoutParams {
  choices: Array<{ title: string; value: LayoutName }>;
  initial: number;
  optionsPerPage: number;
  hint: string;
}

/**
 * Parametros da segunda selecao interativa, a do estilo de cabecalho. Mesma
 * regra de `initial` da selecao de layout: e o INDICE dentro de `choices`.
 */
export interface SelectHeaderStyleParams {
  choices: Array<{ title: string; value: HeaderStyle }>;
  initial: number;
  optionsPerPage: number;
  hint: string;
}

/**
 * Cartao da selecao de ferramenta. Cartao de contrato nao validado carrega
 * `disabled: true`; o texto exibido ao destacar um cartao desabilitado e o
 * `warn` da pergunta (contrato do `select` de `prompts` 2.4.2, que exibe o
 * `warn` no lugar do `hint`), e nao um campo por cartao.
 */
export interface EscolhaFerramenta {
  title: string;
  value: ToolSlug;
  disabled?: boolean;
}

/**
 * Parametros da terceira selecao interativa, a da ferramenta de IA do projeto.
 */
export interface SelectFerramentaParams {
  choices: EscolhaFerramenta[];
  initial: number;
  optionsPerPage: number;
  hint: string;
  warn: string;
}

/**
 * Portas de entrada e saida do comando, injetaveis para teste. A selecao
 * devolve `undefined` quando o usuario cancela (Ctrl+C): `prompts` nao lanca
 * excecao nesse caso, resolve com a chave da pergunta ausente. `colunas`
 * expoe a largura do terminal (`process.stdout.columns`) para a largura da
 * pre-visualizacao, injetada para o teste nao depender do terminal da suite.
 */
export interface ConfigIO {
  write(texto: string): void;
  writeErr(texto: string): void;
  isTTY: boolean;
  colunas?: () => number | undefined;
  selectLayout(params: SelectLayoutParams): Promise<LayoutName | undefined>;
  selectHeaderStyle(params: SelectHeaderStyleParams): Promise<HeaderStyle | undefined>;
  selectFerramenta(params: SelectFerramentaParams): Promise<ToolSlug | undefined>;
}

export interface ConfigDeps {
  configService: GlobalConfigService;
  identityService: ProjectIdentityService;
  io: ConfigIO;
}

/**
 * Hint de navegacao das tres selecoes, explicito sobre o eixo: no `select` do
 * `prompts` so ↑/↓ navegam (ciclo pelo qual Tab tambem passa); ←/→ nao fazem
 * nada. Degrada para palavras em glifo ASCII.
 */
const hintDeNavegacao = (glyphLevel: GlyphLevel): string =>
  glyphLevel === GLYPH.ASCII
    ? 'cima/baixo navegam - enter aplica - esc encerra'
    : '↑ ↓ navegam - enter aplica - esc encerra';

/**
 * SGR que desliga sublinhado SEM tocar na cor, com o parametro dobrado
 * (`24;24`): o `select` do `prompts` 2.4.2 pinta o cartao ativo com
 * `cyan().underline(title)`, e o kleur reescreve toda ocorrencia literal do
 * close dele (`\x1b[24m`) como `close + open`, reabrindo o sublinhado. A forma
 * combinada escapa dessa reescrita. Em title multilinha, o sublinhado
 * sobreviveria ao `\n` ate o primeiro reset ANSI da previa, desenhando uma
 * linha solta sobre o cartao (abaixo da moldura `alvo`).
 */
const SEM_SUBLINHADO = '\x1b[24;24m';

/**
 * Prefixa o title do cartao desligando o sublinhado do `prompts`. Somente com
 * cor ativa: em `LEVEL.NONE` nao se emite escape nenhum (RNF-003).
 */
const titleDeCartao = (titulo: string, nivel: ColorLevel): string =>
  nivel === LEVEL.NONE ? titulo : `${SEM_SUBLINHADO}${titulo}`;

const AVISO_CONTRATO = 'contrato de execucao ainda nao validado nesta versao';

const AVISO_ENCERRAMENTO =
  'configuracao encerrada - o que foi aplicado antes desta etapa foi mantido';

/**
 * Ordem de exibicao dos cartoes de ferramenta: as de contrato validado primeiro,
 * as recusadas por ultimo. Fonte dos nomes e executaveis e sempre o registry.
 */
const ORDEM_FERRAMENTAS: readonly ToolSlug[] = [
  'claudecode',
  'opencode',
  'cursor',
  'gemini-cli',
  'kiro',
];

/**
 * Largura da pre-visualizacao, adaptativa ao terminal (D5): o valor bruto das
 * colunas, limitado ao intervalo de leitura da identidade visual (piso 60, que
 * e onde as formas de cabecalho comecam a degradar; teto 100). Sem medida,
 * vale o fallback de 80 colunas.
 */
const larguraPreview = (colunas: number | undefined): number =>
  Math.max(60, Math.min(colunas ?? 80, 100));

/** Recuo das linhas de previa dentro do cartao. */
const INDENTACAO_DO_CARTAO = 4;

/**
 * Largura que a previa em si pode ocupar: o orcamento do cartao descontado do
 * recuo, para que nenhuma linha do cartao — previa indentada inclusive —
 * exceda o terminal e force quebra de linha.
 */
const larguraDePrevia = (colunas: number | undefined): number =>
  larguraPreview(colunas) - INDENTACAO_DO_CARTAO;

/** Separador nominal dos cartoes, degradado para ASCII sem glifo Unicode. */
const separadorDe = (glyphLevel: ReturnType<typeof detectGlyphLevel>): string =>
  glyphLevel === GLYPH.ASCII ? '-' : '·';

/**
 * Bloco literal de CT-041: as cinco linhas Arquivo, Layout, Cabecalho, Projeto e
 * Ferramenta, sempre exibidas antes de qualquer gravacao ou selecao. Rotulo em
 * petroleo com preenchimento FORA da pintura (regra de RF-001: alinhar igual
 * com e sem cor), valor em primary e ausencia de registro em muted. Conteudo,
 * contagem de linhas e alinhamento na coluna 17 permanecem os mesmos.
 */
function exibirConfigVigente(
  io: ConfigIO,
  painter: Painter,
  configPath: string,
  layout: LayoutName,
  cabecalho: HeaderStyle,
  projeto: string,
  ferramenta: ToolSlug | undefined
): void {
  const CALHA_VIGENTE = 15;
  const rotulo = (texto: string): string =>
    painter.petroleo(texto) + ' '.repeat(Math.max(0, CALHA_VIGENTE - texto.length));
  const ferramentaTexto = ferramenta
    ? painter.primary(ferramenta)
    : painter.muted('nao registrada (defina no fluxo interativo ou rode: config ferramenta <slug>)');

  io.write(`${signature(painter)}  config\n`);
  io.write('\n');
  io.write(`  ${rotulo('Arquivo')}${painter.primary(shortenPath(configPath))}\n`);
  io.write(`  ${rotulo('Layout')}${painter.primary(layout)}\n`);
  io.write(`  ${rotulo('Cabecalho')}${painter.primary(cabecalho)}\n`);
  io.write(`  ${rotulo('Projeto')}${painter.primary(projeto)}\n`);
  io.write(`  ${rotulo('Ferramenta')}${ferramentaTexto}\n`);
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
  // `load()` ja resolve `cabecalho` para o padrao quando ausente ou invalido
  // (CT-042): esta camada nao revalida o arquivo.
  const cabecalhoAtual = config.cabecalho;
  const ferramentaAtual = config.projetos?.[identidade.nome]?.ferramenta;

  exibirConfigVigente(
    io,
    painter,
    configService.configPath,
    layoutAtual,
    cabecalhoAtual,
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
      } else if (chaveValida === 'cabecalho') {
        const estilo = validateCabecalhoValor(valor);
        await configService.setHeaderStyle(estilo);
        io.write(`${status('ok', `cabecalho definido como ${estilo}`, painter)}\n`);
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

  // Sem argumentos e com TTY: carrossel de tres etapas, um cartao por pagina.
  // Cada etapa grava ao Enter; cancelar em qualquer uma encerra mantendo o que
  // as anteriores gravaram (CT-041, agora visivel ao usuario na tela).
  const glyphLevel = detectGlyphLevel();
  const separador = separadorDe(glyphLevel);
  const aplicadas: string[] = [];
  const encerrar = (): number => {
    if (aplicadas.length > 0) {
      io.write(`${status('aviso', AVISO_ENCERRAMENTO, painter)}\n`);
    }
    return 0;
  };

  io.write('\n');

  const base = { painter, glyphLevel, largura: larguraDePrevia(io.colunas?.()) };
  const indentar = (linhas: string[]): string =>
    linhas.map((linha) => `    ${linha}`).join('\n');

  // Primeira etapa: o layout. Cada cartao mostra o cabecalho no estilo HOJE
  // configurado seguido das linhas de task daquele layout (RF-007).
  const choices = LAYOUT_NAMES.map((nome, indice) => {
    const marca = nome === layoutAtual ? ` ${separador} atual` : '';
    const preview = indentar(buildPreview(nome, { ...base, cabecalho: cabecalhoAtual }));
    return {
      title: titleDeCartao(
        `${nome}  ${indice + 1}/${LAYOUT_NAMES.length}${marca}\n${preview}`,
        painter.nivel
      ),
      value: nome,
    };
  });

  const escolha = await io.selectLayout({
    choices,
    initial: LAYOUT_NAMES.indexOf(layoutAtual),
    optionsPerPage: 1,
    hint: hintDeNavegacao(glyphLevel),
  });

  if (escolha === undefined) {
    return encerrar();
  }

  await configService.setLayout(escolha);
  aplicadas.push('layout');
  io.write(`${status('ok', `layout definido como ${escolha}`, painter)}\n`);

  // Segunda etapa: o estilo do cabecalho. Cada cartao mostra APENAS o
  // cabecalho naquela forma, com o mesmo `DadosDeAbertura` de exemplo.
  io.write('\n');

  const choicesCabecalho = HEADER_STYLE_NAMES.map((nome, indice) => {
    const marca = nome === cabecalhoAtual ? ` ${separador} atual` : '';
    const preview = indentar(buildHeaderPreview(nome, base));
    return {
      title: titleDeCartao(
        `${nome}  ${indice + 1}/${HEADER_STYLE_NAMES.length}${marca}\n${preview}`,
        painter.nivel
      ),
      value: nome,
    };
  });

  const escolhaCabecalho = await io.selectHeaderStyle({
    choices: choicesCabecalho,
    initial: HEADER_STYLE_NAMES.indexOf(cabecalhoAtual),
    optionsPerPage: 1,
    hint: hintDeNavegacao(glyphLevel),
  });

  if (escolhaCabecalho === undefined) {
    return encerrar();
  }

  await configService.setHeaderStyle(escolhaCabecalho);
  aplicadas.push('cabecalho');
  io.write(`${status('ok', `cabecalho definido como ${escolhaCabecalho}`, painter)}\n`);

  // Terceira etapa: a ferramenta de IA do projeto (D2). Cinco cartoes de uma
  // linha; os de contrato nao validado sinalizam o warn ao ser destacados.
  io.write('\n');

  const choicesFerramenta: EscolhaFerramenta[] = ORDEM_FERRAMENTAS.map((slug, indice) => {
    const validado = isContratoValidado(slug);
    const marca = !validado
      ? ` ${separador} contrato nao validado`
      : slug === ferramentaAtual
        ? ` ${separador} atual`
        : '';
    const cartao: EscolhaFerramenta = {
      title: titleDeCartao(
        `${getToolDisplayName(slug)} (${getExecutavel(slug)})   ${indice + 1}/${ORDEM_FERRAMENTAS.length}${marca}`,
        painter.nivel
      ),
      value: slug,
    };
    return validado ? cartao : { ...cartao, disabled: true };
  });

  const indiceRegistrada = ferramentaAtual
    ? ORDEM_FERRAMENTAS.indexOf(ferramentaAtual)
    : -1;

  const escolhaFerramenta = await io.selectFerramenta({
    choices: choicesFerramenta,
    initial: indiceRegistrada >= 0 ? indiceRegistrada : 0,
    optionsPerPage: ORDEM_FERRAMENTAS.length,
    hint: hintDeNavegacao(glyphLevel),
    warn: AVISO_CONTRATO,
  });

  if (escolhaFerramenta === undefined) {
    return encerrar();
  }

  // O `select` de `prompts` 2.4.2 recusa Enter em cartao desabilitado (o fonte
  // faz `bell()`); o guarda e a segunda barreira, para o comando continuar
  // correto por si so se a dependencia mudar de comportamento.
  if (!isContratoValidado(escolhaFerramenta)) {
    io.write(
      `${status(
        'aviso',
        `contrato de execucao de ${getToolDisplayName(escolhaFerramenta)} ainda nao validado nesta versao. Disponiveis: ${NOMES_DISPONIVEIS}`,
        painter
      )}\n`
    );
    return 0;
  }

  await configService.setProjectTool(identidade.nome, escolhaFerramenta);
  io.write(
    `${status('ok', `ferramenta do projeto ${identidade.nome} definida como ${escolhaFerramenta}`, painter)}\n`
  );
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
    colunas: () => process.stdout.columns,
    async selectLayout({ choices, initial, optionsPerPage, hint }) {
      // optionsPerPage e hint sao validos no runtime de prompts 2.4.2, mas
      // ausentes do @types/prompts; o cast preserva a checagem do restante.
      const pergunta = {
        type: 'select' as const,
        name: 'layout' as const,
        message: 'Escolha o layout',
        choices,
        initial,
        optionsPerPage,
        hint,
      };
      const resposta = await prompts(pergunta as unknown as Parameters<typeof prompts>[0]);
      return resposta.layout as LayoutName | undefined;
    },
    async selectHeaderStyle({ choices, initial, optionsPerPage, hint }) {
      const pergunta = {
        type: 'select' as const,
        name: 'cabecalho' as const,
        message: 'Escolha o estilo do cabecalho',
        choices,
        initial,
        optionsPerPage,
        hint,
      };
      const resposta = await prompts(pergunta as unknown as Parameters<typeof prompts>[0]);
      return resposta.cabecalho as HeaderStyle | undefined;
    },
    async selectFerramenta({ choices, initial, optionsPerPage, hint, warn }) {
      const pergunta = {
        type: 'select' as const,
        name: 'ferramenta' as const,
        message: 'Escolha a ferramenta de IA do projeto',
        choices,
        initial,
        optionsPerPage,
        hint,
        warn,
      };
      const resposta = await prompts(pergunta as unknown as Parameters<typeof prompts>[0]);
      return resposta.ferramenta as ToolSlug | undefined;
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
 * Subcomando `config` (CT-002, CT-041, RF-016, RF-007). Dois argumentos
 * posicionais opcionais: sem eles, exibe a configuracao vigente e abre o
 * carrossel de tres etapas — layout, cabecalho e ferramenta do projeto — cada
 * uma com pre-visualizacao; com eles, grava layout, cabecalho ou ferramenta
 * sem interacao.
 */
export const configCommand = new Command('config')
  .description(
    'Exibe e altera o layout e o cabecalho (por maquina) e a ferramenta de IA (por projeto)'
  )
  .argument('[chave]', 'layout, cabecalho ou ferramenta')
  .argument('[valor]', 'valor a gravar')
  .action(acaoEnvolvida);
