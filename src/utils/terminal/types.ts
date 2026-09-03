/**
 * Contratos da camada de identidade visual do terminal (RF-013, RF-014).
 *
 * Os dois eixos de degradacao da marca sao independentes: a cor (LEVEL) e o
 * glifo (GLYPH). Um terminal pode ter truecolor sem UTF-8, ou UTF-8 sem cor
 * nenhuma (um pipe para arquivo), entao quem desenha consulta os dois.
 */

/**
 * Os quatro niveis de cor, do mais pobre ao mais rico. Valores numericos
 * crescentes permitem comparacao direta (`nivel >= LEVEL.ANSI256`).
 */
export const LEVEL = Object.freeze({
  NONE: 0,
  BASIC: 1,
  ANSI256: 2,
  TRUECOLOR: 3,
});

export type ColorLevel = typeof LEVEL[keyof typeof LEVEL];

/**
 * Os tres niveis de glifo, do mais pobre ao mais rico. ASCII e o piso e o
 * destino de todo fallback; nele so aparecem caracteres de 0x20 a 0x7E.
 */
export const GLYPH = Object.freeze({
  ASCII: 0,
  UNICODE_BOX: 1,
  UNICODE_FULL: 2,
});

export type GlyphLevel = typeof GLYPH[keyof typeof GLYPH];

/** Os quatro estados de operacao comunicados pelos rotulos de sete colunas. */
export type StatusKind = 'ok' | 'aviso' | 'erro' | 'info';

/**
 * Pintor de texto para um nivel de cor. Cada metodo recebe uma string e
 * devolve a mesma string com as sequencias ANSI do papel aplicado. Em
 * `LEVEL.NONE` todos os metodos devolvem a entrada intacta (RNF-003), entao
 * quem chama nunca precisa saber se ha cor.
 *
 * Papeis fixos de RF-013: `petroleo` para estrutura, moldura, contorno e
 * informacao; `paprica` reservada a acao do usuario; `ok`/`aviso`/`erro`/`info`
 * para estado de operacao.
 */
export interface Painter {
  nivel: ColorLevel;
  petroleo(texto: string): string;
  paprica(texto: string): string;
  ok(texto: string): string;
  aviso(texto: string): string;
  erro(texto: string): string;
  info(texto: string): string;
  primary(texto: string): string;
  secondary(texto: string): string;
  muted(texto: string): string;
  dim(texto: string): string;
  bold(texto: string): string;
  reset(texto: string): string;
}

/**
 * Caracteres de canto, aresta e juncao de uma moldura, um conjunto por nivel
 * de glifo. O conjunto ASCII usa exclusivamente `+`, `-` e `|`.
 */
export interface BoxStyle {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
  cross: string;
  teeUp: string;
  teeDown: string;
  teeLeft: string;
  teeRight: string;
}
