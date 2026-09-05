/**
 * Forma `painel` do cabecalho de abertura (RF-005), a padrao.
 *
 * Cinco painéis emoldurados, um por grupo, com o titulo do grupo embutido na
 * moldura em minusculas e sem acento. A moldura vem de `box()`, que ja degrada
 * para `+ - |` em terminal sem glifo Unicode, sem mensagem.
 */

import { box } from '../terminal/index.js';
import type { DadosDeAbertura } from '../../types/executar-tasks.js';
import type { ContextoDeCabecalho } from './index.js';
import {
  CALHA,
  gruposDeAbertura,
  larguraDoConteudo,
  linhaRotulada,
  truncar,
} from './compacto.js';

/**
 * Renderiza os cinco painéis. Todos saem com a mesma largura: o conteudo e
 * alinhado pela linha mais larga dos cinco grupos, limitado a `largura - 4`
 * para caber nas duas bordas e nos dois espacos de preenchimento de `box()`.
 */
export function cabecalhoPainel(
  dados: DadosDeAbertura,
  contexto: ContextoDeCabecalho,
): string[] {
  const grupos = gruposDeAbertura(dados);
  const teto = Math.max(1, contexto.largura - 4);
  const interno = Math.min(larguraDoConteudo(grupos), teto);

  return grupos.flatMap((grupo) => {
    const linhas = grupo.linhas.map((linha) => {
      const cru = truncar(`${linha.rotulo.padEnd(CALHA)}${linha.valor}`, interno);
      const pintada = linhaRotulada(linha, contexto, interno);
      return `${pintada}${' '.repeat(Math.max(0, interno - cru.length))}`;
    });
    return box(linhas, {
      painter: contexto.painter,
      glyphLevel: contexto.glyphLevel,
      titulo: grupo.titulo,
      colunas: contexto.largura,
    });
  });
}
