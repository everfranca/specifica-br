/**
 * Deteccao de suporte a glifo e primitivos de moldura e regua.
 *
 * Porte direto de `src/brand/terminal/glyphs.js` (Nota de Decisao 2 da
 * techspec: sincronia manual). A logica de deteccao e os limiares sao
 * identicos ao original. O `BOX_STYLES` foi reorganizado por nivel de glifo,
 * conforme o contrato desta task (secao 2.b): um conjunto de caracteres por
 * nivel, em vez dos sete estilos nomeados do original.
 *
 * A postura e a mesma de colors.ts: na duvida, desce um nivel. Uma moldura de
 * `+` e `-` e feia mas legivel; uma moldura de `?` e lixo, nao.
 *
 * O banner, o wordmark e a assinatura NAO passam por aqui: continuam em ASCII
 * imprimivel puro em todos os niveis, porque a marca sai identica em qualquer
 * terminal (ver banner.ts).
 */

import { GLYPH } from './types.js';
import type { GlyphLevel, BoxStyle, Painter } from './types.js';

export { GLYPH };
export type { GlyphLevel, BoxStyle };

/**
 * Descobre o nivel de glifo suportado por `process.stdout`.
 *
 * Ordem obrigatoria (tabela ENV-001, secao 4.8 da techspec): (1)
 * `SPECIFICA_GLYPHS` com `ascii|box|full` forca o nivel; (2) `NERD_FONT` ou
 * `POWERLINE_FONT` definidas elevam para `UNICODE_FULL`; (3) `LANG`/`LC_ALL`/
 * `LC_CTYPE` confirmando UTF-8 dao `UNICODE_BOX`; (4) sem confirmacao de UTF-8,
 * `ASCII`.
 */
export function detectGlyphLevel(): GlyphLevel {
  const env = process.env;
  const stream = process.stdout;

  // Escotilha de escape explicita, no espirito de FORCE_COLOR.
  if (env.SPECIFICA_GLYPHS === 'ascii') {
    return GLYPH.ASCII;
  }
  if (env.SPECIFICA_GLYPHS === 'box') {
    return GLYPH.UNICODE_BOX;
  }
  if (env.SPECIFICA_GLYPHS === 'full') {
    return GLYPH.UNICODE_FULL;
  }

  // Sem terminal do outro lado quem le e um arquivo ou outro programa. Como em
  // colors.ts: isTTY vem undefined, nao false, entao testamos a ausencia.
  if (!stream || !stream.isTTY) {
    return GLYPH.ASCII;
  }
  if (env.TERM === 'dumb') {
    return GLYPH.ASCII;
  }

  if (process.platform === 'win32') {
    // Windows Terminal e o console do VS Code sao UTF-8 e trazem fonte
    // completa. O conhost legado do cmd.exe roda em codepage 437/850 e
    // trocaria os glifos por lixo — sem conserto em runtime, fica em ASCII.
    if (env.WT_SESSION || env.TERM_PROGRAM === 'vscode') {
      return GLYPH.UNICODE_FULL;
    }
    return GLYPH.ASCII;
  }

  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || '';
  if (!/UTF-?8/i.test(locale)) {
    return GLYPH.ASCII;
  }

  // UTF-8 confirmado. Falta saber se a fonte cobre os quadrantes de U+2590.
  if (/^linux/i.test(env.TERM || '')) {
    return GLYPH.UNICODE_BOX;
  }
  if (env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'Apple_Terminal') {
    return GLYPH.UNICODE_FULL;
  }
  if (env.NERD_FONT || env.POWERLINE_FONT) {
    return GLYPH.UNICODE_FULL;
  }

  // Emulador grafico generico: box drawing e certo, quadrante e aposta.
  return GLYPH.UNICODE_BOX;
}

/**
 * Um conjunto de caracteres de moldura por nivel de glifo. O canto arredondado
 * do nivel Unicode ecoa o cartao do wordmark (cli-molduras.md, estilo
 * `rounded`, o padrao da marca). O nivel ASCII usa exclusivamente `+`, `-` e
 * `|`.
 */
export const BOX_STYLES: Record<GlyphLevel, BoxStyle> = {
  [GLYPH.ASCII]: {
    tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|',
    cross: '+', teeUp: '+', teeDown: '+', teeLeft: '+', teeRight: '+',
  },
  [GLYPH.UNICODE_BOX]: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
    cross: '┼', teeUp: '┴', teeDown: '┬', teeLeft: '┤', teeRight: '├',
  },
  [GLYPH.UNICODE_FULL]: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
    cross: '┼', teeUp: '┴', teeDown: '┬', teeLeft: '┤', teeRight: '├',
  },
};

const ANSI = /\x1b\[[0-9;]*m/g;

/** Largura visivel de uma linha, ignorando as sequencias de escape ANSI. */
export function visibleWidth(texto: string): number {
  return texto.replace(ANSI, '').length;
}

/**
 * Largura util do terminal, limitada ao intervalo de 60 a 100 colunas
 * (cli-layout.md; caso extremo 29 da secao 5.2 da techspec). Abaixo de 60
 * colunas devolve o valor cru, que sinaliza o desmonte do layout para quem
 * chama.
 */
export function larguraUtil(colunas: number = process.stdout.columns || 80): number {
  if (colunas < 60) {
    return colunas;
  }
  return Math.min(Math.max(colunas, 60), 100);
}

export interface BoxOpcoes {
  painter?: Painter;
  glyphLevel?: GlyphLevel;
  titulo?: string;
  padding?: number;
  /** Colunas do terminal; abaixo de 60 a moldura desmonta (caso extremo 29). */
  colunas?: number;
}

/**
 * Desenha uma moldura em volta do conteudo e devolve as linhas.
 *
 * O conteudo pode ja vir colorido: a largura e medida com `visibleWidth`,
 * entao pintar por dentro nao desalinha a borda direita. Abaixo de 60 colunas
 * a moldura desmonta e as linhas voltam sem borda (caso extremo 29).
 */
export function box(linhas: string[], opcoes: BoxOpcoes = {}): string[] {
  const {
    painter,
    glyphLevel = detectGlyphLevel(),
    titulo,
    padding = 1,
    colunas = process.stdout.columns || 80,
  } = opcoes;

  if (colunas < 60) {
    return [...linhas];
  }

  const g = BOX_STYLES[glyphLevel] ?? BOX_STYLES[GLYPH.ASCII];
  const pintarBorda = painter ? (s: string) => painter.petroleo(s) : (s: string) => s;

  const inner = Math.max(
    0,
    ...linhas.map(visibleWidth),
    titulo ? visibleWidth(titulo) + 2 : 0,
  );
  const span = inner + padding * 2;
  const pad = ' '.repeat(padding);

  const top = titulo
    ? g.tl + g.h + titulo + g.h.repeat(Math.max(0, span - visibleWidth(titulo) - 1)) + g.tr
    : g.tl + g.h.repeat(span) + g.tr;

  const saida: string[] = [pintarBorda(top)];
  for (const linha of linhas) {
    const preenche = ' '.repeat(Math.max(0, inner - visibleWidth(linha)));
    saida.push(pintarBorda(g.v) + pad + linha + preenche + pad + pintarBorda(g.v));
  }
  saida.push(pintarBorda(g.bl + g.h.repeat(span) + g.br));

  return saida;
}

export interface RuleOpcoes {
  painter?: Painter;
  glyphLevel?: GlyphLevel;
  /** Colunas do terminal; abaixo de 60 a regua desmonta para `-` (caso 29). */
  colunas?: number;
}

/**
 * Regua horizontal, para separar secoes sem gastar uma moldura inteira. A
 * largura e limitada a 100 colunas. Abaixo de 60 colunas de terminal, ou sem
 * glifo Unicode, usa `-` em vez do traco de box drawing (caso extremo 29).
 */
export function rule(largura: number, opcoes: RuleOpcoes = {}): string {
  const {
    painter,
    glyphLevel = detectGlyphLevel(),
    colunas = process.stdout.columns || 80,
  } = opcoes;

  const larg = Math.max(1, Math.min(largura, 100));
  const traco = colunas < 60 || glyphLevel < GLYPH.UNICODE_BOX ? '-' : '─';
  const linha = traco.repeat(larg);
  return painter ? painter.petroleo(linha) : linha;
}
