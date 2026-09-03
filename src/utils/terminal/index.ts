/**
 * Camada de identidade visual do terminal (RF-013, RF-014).
 *
 * Este e o unico modulo que as tasks 9, 10 e 11 devem importar:
 *
 *   import { banner, status, createPainter, detectLevel } from '../utils/terminal/index.js';
 *
 * `banner`/`signature`/`status` sao a marca e saem em ASCII puro em qualquer
 * terminal. `box`/`rule` sao UI de aplicacao e sobem para Unicode quando o
 * terminal permite. `Spinner` so anima em TTY.
 */

export * from './types.js';
export { LEVEL, detectLevel, createPainter } from './colors.js';
export {
  GLYPH,
  BOX_STYLES,
  detectGlyphLevel,
  visibleWidth,
  larguraUtil,
  box,
  rule,
} from './glyphs.js';
export type { BoxOpcoes, RuleOpcoes } from './glyphs.js';
export { banner, signature, status } from './banner.js';
export { Spinner, QUADROS_SPINNER } from './spinner.js';
export type { SpinnerOpcoes } from './spinner.js';
