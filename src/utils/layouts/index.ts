/**
 * Fabrica dos quatro layouts (RF-015, RF-016).
 *
 * Padrao Strategy + Factory: `createLayout` recebe o nome ja normalizado pela
 * configuracao global (task-3) e devolve a estrategia correspondente. A unica
 * regra de negocio aqui e a degradacao de `lote` para `coluna` quando nao ha
 * terminal interativo, que e o cenario Gherkin de RF-015.
 */

import type { LayoutName } from '../../types/config.js';

import { ColumnLayout } from './coluna.js';
import { MolduraLayout } from './moldura.js';
import { ReguaLayout } from './regua.js';
import { LoteLayout } from './lote.js';
import type { LayoutContext, LayoutRenderer } from './types.js';

export { ColumnLayout } from './coluna.js';
export { MolduraLayout } from './moldura.js';
export { ReguaLayout } from './regua.js';
export { LoteLayout } from './lote.js';
export type {
  LayoutContext,
  LayoutRenderer,
  TaskStartInfo,
  TaskEndInfo,
  EtapaInfo,
} from './types.js';
export type { EstadoDeEspera } from '../../types/executar-tasks.js';

/**
 * Instancia o layout `nome` no `contexto` dado.
 *
 * 1. `lote` sem TTY -> `ColumnLayout` (degradacao de RF-015).
 * 2. Nome valido -> a estrategia correspondente.
 * 3. Nome fora dos quatro -> `ColumnLayout`, o padrao de RF-016. Nao lanca: um
 *    valor invalido ja foi normalizado na task-3 e a preferencia e cosmetica.
 */
export function createLayout(
  nome: LayoutName,
  contexto: LayoutContext,
): LayoutRenderer {
  if (nome === 'lote' && contexto.isTTY === false) {
    return new ColumnLayout(contexto);
  }
  switch (nome) {
    case 'moldura':
      return new MolduraLayout(contexto);
    case 'regua':
      return new ReguaLayout(contexto);
    case 'lote':
      return new LoteLayout(contexto);
    case 'coluna':
      return new ColumnLayout(contexto);
    default:
      return new ColumnLayout(contexto);
  }
}
