/**
 * Forma `compacto` do cabecalho de abertura (RF-005) e base da forma degradada
 * de RF-006.
 *
 * Este modulo tambem concentra o *modelo de linhas* consumido pelas outras duas
 * formas: `gruposDeAbertura` traduz `DadosDeAbertura` nos cinco grupos fixos —
 * alvo, motor, contexto, limites, registro — uma unica vez. Painel e regua
 * importam daqui, e nao o contrario: e o que garante que as tres formas exibam
 * exatamente o mesmo conjunto de dados, sem que nenhuma acrescente ou omita
 * linha por conta propria.
 */

import { visibleWidth } from '../terminal/index.js';
import { formatarMilhar } from '../formatos.js';
import type { DadosDeAbertura } from '../../types/executar-tasks.js';
import type { ContextoDeCabecalho } from './index.js';

/** Calha do rotulo nas formas `painel`, `regua` e degradada. */
export const CALHA = 13;

/** Calha do titulo de grupo na forma `compacto`, com recuo de duas colunas. */
export const CALHA_COMPACTA = 11;

/** Os cinco grupos fixos, na ordem em que as tres formas os apresentam. */
export const GRUPOS = ['alvo', 'motor', 'contexto', 'limites', 'registro'] as const;

export type NomeDeGrupo = typeof GRUPOS[number];

/**
 * Uma linha rotulo/valor do cabecalho. `ausente` marca o dado desligado ou
 * inexistente, que sai em `muted` — nunca como linha omitida, porque as tres
 * formas exibem todos os dados de `DadosDeAbertura`.
 */
export interface LinhaDeDado {
  rotulo: string;
  valor: string;
  ausente: boolean;
}

/** Um grupo do cabecalho, com o titulo ja em minusculas e sem acento. */
export interface GrupoDeDados {
  titulo: NomeDeGrupo;
  linhas: LinhaDeDado[];
}

/**
 * Trunca em `max` colunas visiveis, marcando o corte com `...` na mesma
 * posicao. Opera sobre texto sem marcacao de cor: quem chama pinta depois.
 */
export function truncar(texto: string, max: number): string {
  if (max <= 0) {
    return '';
  }
  if (texto.length <= max) {
    return texto;
  }
  if (max <= 3) {
    return '.'.repeat(max);
  }
  return `${texto.slice(0, max - 3)}...`;
}

/**
 * Estado do mecanismo de Contexto de Execucao. Sob `--dry-run` o mecanismo esta
 * ligado mas nao constroi nada, e o cabecalho precisa dizer o que de fato vai
 * acontecer (tabela de regras comuns da secao 4.1).
 */
function estadoDoContexto(dados: DadosDeAbertura): string {
  if (!dados.contextoLigado) {
    return 'off';
  }
  return dados.contextoSimulado
    ? 'on (--dry-run: nao sera construido nem injetado)'
    : 'on';
}

/** Teto e — quando ha escolha — forma de injecao, com o separador dado. */
function tetoEInjecao(dados: DadosDeAbertura, separador: string): string {
  const injecao =
    dados.contextoInjecao === null
      ? ''
      : `${separador}injecao: ${dados.contextoInjecao}`;
  return `teto: ${dados.contextoTeto}${injecao}`;
}

/** Texto da linha `Espera`, que sai `desligada` sob `--no-wait-on-limit`. */
function textoDaEspera(dados: DadosDeAbertura): string {
  return dados.tetoEspera === 'desligada'
    ? 'desligada'
    : `ate ${dados.tetoEspera} por renovacao da cota`;
}

/** Diretorios extras ja encurtados, ou `nenhum` quando a lista esta vazia. */
function textoDosDirs(dados: DadosDeAbertura): string {
  return dados.dirsExtras.length ? dados.dirsExtras.join(' ') : 'nenhum';
}

/**
 * Traduz os dados de abertura nos cinco grupos fixos. Fonte unica das tres
 * formas e da forma degradada.
 */
export function gruposDeAbertura(dados: DadosDeAbertura): GrupoDeDados[] {
  const semDirs = dados.dirsExtras.length === 0;
  return [
    {
      titulo: 'alvo',
      linhas: [
        { rotulo: 'Feature', valor: dados.feature, ausente: false },
        {
          rotulo: 'Tasks',
          valor: `${formatarMilhar(dados.tasksSelecionadas)} de ${formatarMilhar(
            dados.tasksTotal,
          )} selecionadas (${dados.criterioDeSelecao})`,
          ausente: false,
        },
      ],
    },
    {
      titulo: 'motor',
      linhas: [
        {
          rotulo: 'Ferramenta',
          valor: `${dados.ferramenta} (${dados.executavel} ${dados.versao})`,
          ausente: false,
        },
        {
          rotulo: 'Modelo',
          valor: `${dados.model}   esforco: ${dados.effort}   fallback: ${dados.fallbackModel}`,
          ausente: dados.fallbackModel === 'nenhum',
        },
        { rotulo: 'Permissoes', valor: dados.permissoes, ausente: false },
      ],
    },
    {
      titulo: 'contexto',
      linhas: [
        // Sob simulacao o aviso e longo o bastante para estourar a largura
        // util: teto e injecao descem para uma linha de continuacao, porque
        // trunca-los apagaria dados que RF-005 manda exibir sempre.
        ...(dados.contextoSimulado
          ? [
              {
                rotulo: 'Contexto',
                valor: estadoDoContexto(dados),
                ausente: false,
              },
              { rotulo: '', valor: tetoEInjecao(dados, '   '), ausente: false },
            ]
          : [
              {
                rotulo: 'Contexto',
                valor: `${estadoDoContexto(dados)}   ${tetoEInjecao(dados, '   ')}`,
                ausente: !dados.contextoLigado,
              },
            ]),
        {
          rotulo: 'Cache',
          valor: dados.cacheTuning ? 'on' : 'off',
          ausente: !dados.cacheTuning,
        },
        { rotulo: 'Dirs extras', valor: textoDosDirs(dados), ausente: semDirs },
      ],
    },
    {
      titulo: 'limites',
      linhas: [
        {
          rotulo: 'Orcamentos',
          valor: `task=${dados.tetoCustoPorTask}   janela=${dados.tetoJanela}`,
          ausente: false,
        },
        {
          rotulo: 'Espera',
          valor: textoDaEspera(dados),
          ausente: dados.tetoEspera === 'desligada',
        },
      ],
    },
    {
      titulo: 'registro',
      linhas: [{ rotulo: 'Arquivo', valor: dados.registroPath, ausente: false }],
    },
  ];
}

/**
 * Monta uma linha rotulo/valor ja truncada e pintada: rotulo em `petroleo`,
 * valor em `primary`, ou em `muted` quando o dado esta ausente ou desligado. A
 * truncagem ocorre sobre o texto cru, antes da pintura, para que a marcacao de
 * cor nao entre na conta das colunas.
 */
export function linhaRotulada(
  linha: LinhaDeDado,
  contexto: ContextoDeCabecalho,
  max: number,
  calha: number = CALHA,
): string {
  const cru = truncar(`${linha.rotulo.padEnd(calha)}${linha.valor}`, max);
  const rotulo = cru.slice(0, Math.min(calha, cru.length));
  const valor = cru.slice(rotulo.length);
  const pintarValor = linha.ausente
    ? contexto.painter.muted.bind(contexto.painter)
    : contexto.painter.primary.bind(contexto.painter);
  return `${contexto.painter.petroleo(rotulo)}${valor ? pintarValor(valor) : ''}`;
}

/**
 * Forma degradada de RF-006: uma linha por dado, sem moldura e sem regua, com o
 * rotulo a esquerda, cada linha truncada em `largura - 1` colunas. Os tres
 * estilos convergem para ela abaixo de 60 colunas, o que torna a saida
 * identica nas tres formas nesse regime.
 */
export function cabecalhoDegradado(
  dados: DadosDeAbertura,
  contexto: ContextoDeCabecalho,
): string[] {
  const max = Math.max(1, contexto.largura - 1);
  return gruposDeAbertura(dados).flatMap((grupo) =>
    grupo.linhas.map((linha) => linhaRotulada(linha, contexto, max)),
  );
}

/**
 * Forma `compacto`: uma linha por grupo, mais as linhas de `permissao` e de
 * `dirs`, com o titulo do grupo em minusculas na calha da esquerda.
 */
export function cabecalhoCompacto(
  dados: DadosDeAbertura,
  contexto: ContextoDeCabecalho,
): string[] {
  const max = Math.max(1, contexto.largura);
  const cache = `cache: ${dados.cacheTuning ? 'on' : 'off'}`;
  const detalhe = `${tetoEInjecao(dados, '  ')}  ${cache}`;
  const espera =
    dados.tetoEspera === 'desligada' ? 'desligada' : `ate ${dados.tetoEspera}`;

  const entradas: LinhaDeDado[] = [
    {
      rotulo: 'alvo',
      valor: `${dados.feature}  ${formatarMilhar(dados.tasksSelecionadas)}/${formatarMilhar(
        dados.tasksTotal,
      )} (${dados.criterioDeSelecao})`,
      ausente: false,
    },
    {
      rotulo: 'motor',
      valor: `${dados.ferramenta} (${dados.executavel} ${dados.versao})  ${dados.model}/${dados.effort}  fallback: ${dados.fallbackModel}`,
      ausente: false,
    },
    { rotulo: 'permissao', valor: dados.permissoes, ausente: false },
    ...(dados.contextoSimulado
      ? [
          { rotulo: 'contexto', valor: estadoDoContexto(dados), ausente: false },
          { rotulo: '', valor: detalhe, ausente: false },
        ]
      : [
          {
            rotulo: 'contexto',
            valor: `${estadoDoContexto(dados)}  ${detalhe}`,
            ausente: !dados.contextoLigado,
          },
        ]),
    { rotulo: 'dirs', valor: textoDosDirs(dados), ausente: dados.dirsExtras.length === 0 },
    {
      rotulo: 'limites',
      valor: `task=${dados.tetoCustoPorTask}  janela=${dados.tetoJanela}  espera: ${espera}`,
      ausente: false,
    },
    { rotulo: 'registro', valor: dados.registroPath, ausente: false },
  ];

  return entradas.map(
    (linha) => `  ${linhaRotulada(linha, contexto, max - 2, CALHA_COMPACTA)}`,
  );
}

/**
 * Maior largura visivel entre todas as linhas rotulo/valor dos cinco grupos.
 * Painel e regua usam para alinhar os blocos entre si.
 */
export function larguraDoConteudo(grupos: GrupoDeDados[]): number {
  let maior = 0;
  for (const grupo of grupos) {
    for (const linha of grupo.linhas) {
      maior = Math.max(maior, visibleWidth(`${linha.rotulo.padEnd(CALHA)}${linha.valor}`));
    }
  }
  return maior;
}
