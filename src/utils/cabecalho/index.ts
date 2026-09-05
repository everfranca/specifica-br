/**
 * Cabecalho de abertura do lote: quarta familia fechada de modulos coesos em
 * `utils/`, ao lado de `terminal/`, `layouts/` e `tool-adapters/`.
 *
 * A familia inverte a responsabilidade que era do comando: `executar-tasks`
 * entrega `DadosDeAbertura`, e a *forma* e decidida aqui. E o que torna o
 * cabecalho pre-visualizavel em `config` e independente do layout.
 *
 * Direcao de dependencias `Commands -> Utils -> Types`: nenhum modulo desta
 * familia importa de `commands/` nem de `layouts/`.
 */

import { larguraUtil } from '../terminal/index.js';
import type { Painter, GlyphLevel } from '../terminal/index.js';
import { DEFAULT_HEADER_STYLE } from '../../types/config.js';
import type { HeaderStyle } from '../../types/config.js';
import type { DadosDeAbertura } from '../../types/executar-tasks.js';
import { cabecalhoCompacto, cabecalhoDegradado } from './compacto.js';
import { cabecalhoPainel } from './painel.js';
import { cabecalhoRegua } from './regua.js';

export type { LinhaDeDado, GrupoDeDados, NomeDeGrupo } from './compacto.js';
export {
  GRUPOS,
  gruposDeAbertura,
  cabecalhoCompacto,
  cabecalhoDegradado,
} from './compacto.js';
export { cabecalhoPainel } from './painel.js';
export { cabecalhoRegua } from './regua.js';
export { DEFAULT_HEADER_STYLE };

/**
 * Ambiente de renderizacao do cabecalho. E o subconjunto de `LayoutContext` de
 * que as tres formas precisam — declarado aqui, e nao importado de `layouts/`,
 * porque a familia do cabecalho nao depende da camada de layouts: e ela que
 * depende desta. `LayoutContext` o satisfaz estruturalmente.
 */
export interface ContextoDeCabecalho {
  painter: Painter;
  glyphLevel: GlyphLevel;
  /** Colunas cruas do terminal; a regra de `larguraUtil` e aplicada aqui. */
  largura: number;
}

/**
 * Renderiza o cabecalho de abertura na forma pedida.
 *
 * Nao lanca, em nenhum caminho: estilo desconhecido cai para `painel` em
 * silencio (CT-042), e abaixo de 60 colunas o estilo e ignorado em favor da
 * forma degradada de RF-006, identica nos tres estilos.
 *
 * @param estilo Estilo configurado; valor fora do conjunto cai para `painel`.
 * @param dados Conjunto completo de dados de abertura.
 * @param contexto Pintor, nivel de glifo e colunas do terminal.
 * @returns As linhas do cabecalho, ja formatadas e pintadas.
 */
export function renderCabecalho(
  estilo: HeaderStyle,
  dados: DadosDeAbertura,
  contexto: ContextoDeCabecalho,
): string[] {
  const ambiente: ContextoDeCabecalho = {
    ...contexto,
    largura: larguraUtil(contexto.largura),
  };

  // Abaixo de 60 colunas o estilo e ignorado: as tres formas convergem para a
  // forma degradada, entao a saida e identica nos tres (RF-006).
  if (contexto.largura < 60) {
    return cabecalhoDegradado(dados, ambiente);
  }

  switch (estilo) {
    case 'regua':
      return cabecalhoRegua(dados, ambiente);
    case 'compacto':
      return cabecalhoCompacto(dados, ambiente);
    case 'painel':
      return cabecalhoPainel(dados, ambiente);
    default:
      // Preferencia cosmetica nao bloqueia execucao: valor guardado invalido
      // cai para o padrao, sem mensagem (CT-042, mesma regra de `layout`).
      return cabecalhoPainel(dados, ambiente);
  }
}
