/**
 * Forma `regua` do cabecalho de abertura (RF-005).
 *
 * Cinco blocos separados por regua horizontal, com o titulo do grupo a esquerda
 * da regua em minusculas e sem acento. A regua vem de `rule()`, que ja degrada
 * para `-` em terminal sem glifo Unicode, sem mensagem.
 */

import { rule } from '../terminal/index.js';
import type { DadosDeAbertura } from '../../types/executar-tasks.js';
import type { ContextoDeCabecalho } from './index.js';
import { gruposDeAbertura, linhaRotulada } from './compacto.js';

/**
 * Renderiza os cinco blocos. As linhas de dado tem recuo de duas colunas, e a
 * regua ocupa o resto da largura util a direita do titulo do grupo.
 */
export function cabecalhoRegua(
  dados: DadosDeAbertura,
  contexto: ContextoDeCabecalho,
): string[] {
  const saida: string[] = [];
  for (const grupo of gruposDeAbertura(dados)) {
    const traco = rule(Math.max(1, contexto.largura - grupo.titulo.length - 1), {
      painter: contexto.painter,
      glyphLevel: contexto.glyphLevel,
      colunas: contexto.largura,
    });
    saida.push(`${contexto.painter.petroleo(grupo.titulo)} ${traco}`);
    for (const linha of grupo.linhas) {
      saida.push(`  ${linhaRotulada(linha, contexto, Math.max(1, contexto.largura - 2))}`);
    }
  }
  return saida;
}
