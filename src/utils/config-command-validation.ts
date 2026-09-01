import type { LayoutName, ToolSlug } from '../types/config.js';
import { LAYOUT_NAMES, TOOL_SLUGS } from '../types/config.js';
import { normalizeToolSlug } from './tool-adapters/tool-registry.js';

/**
 * Validacao pura dos dois argumentos posicionais de `specifica-br config`
 * (CT-002, RF-021). Fica em arquivo proprio para ser testavel sem Commander e
 * sem tocar o disco.
 */

/**
 * Confere que a chave e uma das duas suportadas.
 *
 * @throws {Error} Quando `chave` nao e `layout` nem `ferramenta`.
 */
export function validateChave(chave: string): 'layout' | 'ferramenta' {
  if (chave === 'layout' || chave === 'ferramenta') {
    return chave;
  }

  throw new Error(`chave invalida: ${chave}. Use layout ou ferramenta`);
}

/**
 * Confere que o valor e um dos quatro layouts.
 *
 * @throws {Error} Quando `valor` esta fora de `LAYOUT_NAMES`.
 */
export function validateLayoutValor(valor: string): LayoutName {
  if ((LAYOUT_NAMES as readonly string[]).includes(valor)) {
    return valor as LayoutName;
  }

  throw new Error(`layout invalido: ${valor}. Use um de: ${LAYOUT_NAMES.join(', ')}`);
}

/**
 * Confere que o valor e um dos cinco slugs de ferramenta, sem distincao de
 * caixa (Nota de Decisao 3 da techspec).
 *
 * @throws {Error} Quando `valor` nao normaliza para nenhum slug conhecido.
 */
export function validateFerramentaValor(valor: string): ToolSlug {
  const slug = normalizeToolSlug(valor);

  if (slug) {
    return slug;
  }

  throw new Error(`ferramenta invalida: ${valor}. Use um de: ${TOOL_SLUGS.join(', ')}`);
}
