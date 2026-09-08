/**
 * Deteccao de suporte a cor e paleta da marca para o terminal.
 *
 * Porte direto de `src/brand/terminal/colors.js` do repositorio de identidade
 * visual (Nota de Decisao 2 da techspec: a sincronia passa a ser manual). A
 * logica de deteccao, os limiares e a ordem de precedencia sao identicos ao
 * original; o que muda e a tipagem e o carregamento da paleta, que agora vem
 * de `assets/tokens.json` e nao de valores literais no codigo (RF-013).
 *
 * A deteccao e conservadora: na duvida, desce um nivel. Um banner sem cor e
 * aceitavel; um banner cheio de lixo de escape na tela do usuario, nao.
 */

import os from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { LEVEL } from './types.js';
import type { ColorLevel, Painter } from './types.js';

export { LEVEL };
export type { ColorLevel, Painter };

const RESET = '\x1b[0m';

/**
 * Niveis do cubo 6x6x6 da paleta xterm-256 (indices 16-231). Usados para
 * aproximar um RGB escalado no nivel ANSI256, onde nao existe cor arbitraria.
 */
const NIVEIS_DO_CUBO = [0, 95, 135, 175, 215, 255] as const;

/** Indice do cubo mais proximo de um canal de 8 bits. */
function nivelDoCubo(canal: number): number {
  let maisProximo = 0;
  for (let indice = 1; indice < NIVEIS_DO_CUBO.length; indice += 1) {
    if (Math.abs(NIVEIS_DO_CUBO[indice] - canal) < Math.abs(NIVEIS_DO_CUBO[maisProximo] - canal)) {
      maisProximo = indice;
    }
  }
  return maisProximo;
}

/**
 * Carrega a paleta canonica de `assets/tokens.json`. A leitura e sincrona e
 * feita uma unica vez na carga do modulo porque acontece fora de qualquer
 * contexto assincrono (import de asset embutido no pacote) e o arquivo tem
 * poucos KB. O caminho e resolvido contra o proprio modulo compilado
 * (`dist/utils/terminal/`), nunca contra `process.cwd()` nem contra `src/`.
 */
function carregarPaleta(): Record<string, { rgb: [number, number, number]; ansi256: number; basic: number }> {
  const aquiDir = dirname(fileURLToPath(import.meta.url));
  const tokensPath = resolve(aquiDir, '../../assets/tokens.json');
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8')) as {
    color: Record<string, Record<string, { value: string }>>;
    ansi: Record<string, Record<string, number>>;
  };

  const hexParaRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };

  const ansi256 = tokens.ansi['256'];
  const ansi16 = tokens.ansi['16'];
  const cor = tokens.color;

  const papel = (hex: string, chaveAnsi: string) => ({
    rgb: hexParaRgb(hex),
    ansi256: ansi256[chaveAnsi],
    basic: ansi16[chaveAnsi],
  });

  return {
    petroleo: papel(cor.accent.petroleo.value, 'petroleo'),
    paprica: papel(cor.accent.paprica.value, 'paprica'),
    primary: papel(cor.text.primary.value, 'primary'),
    secondary: papel(cor.text.secondary.value, 'secondary'),
    muted: papel(cor.text.muted.value, 'muted'),
    success: papel(cor.semantic.success.value, 'success'),
    warning: papel(cor.semantic.warning.value, 'warning'),
    error: papel(cor.semantic.error.value, 'error'),
  };
}

const PALETA = carregarPaleta();

/**
 * Descobre o nivel de cor suportado por `process.stdout`.
 *
 * Ordem de precedencia obrigatoria (tabela ENV-001, secao 4.8 da techspec):
 * (1) `NO_COLOR` nao vazio; (2) `FORCE_COLOR`; (3) saida nao e TTY;
 * (4) `CI` definida limita o nivel; (5) `COLORTERM`/`TERM_PROGRAM`/`WT_SESSION`
 * e `TERM` determinam o nivel detectado.
 */
export function detectLevel(): ColorLevel {
  const env = process.env;
  const stream = process.stdout;

  // NO_COLOR: padrao de facto (no-color.org). Qualquer valor nao vazio conta.
  if (env.NO_COLOR) {
    return LEVEL.NONE;
  }

  // FORCE_COLOR tem a ultima palavra, inclusive para forcar cor em pipe.
  // String vazia conta como nao definida: `FORCE_COLOR= cmd` limpa a variavel.
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '') {
    if (env.FORCE_COLOR === '0' || env.FORCE_COLOR === 'false') {
      return LEVEL.NONE;
    }
    if (env.FORCE_COLOR === '1' || env.FORCE_COLOR === 'true') {
      return LEVEL.BASIC;
    }
    if (env.FORCE_COLOR === '2') {
      return LEVEL.ANSI256;
    }
    if (env.FORCE_COLOR === '3') {
      return LEVEL.TRUECOLOR;
    }
    return LEVEL.BASIC;
  }

  // Saida redirecionada ou em pipe: em stream sem terminal o Node deixa isTTY
  // como undefined, nao false. Testar a ausencia, nao a igualdade com false.
  if (!stream || !stream.isTTY) {
    return LEVEL.NONE;
  }

  if (env.TERM === 'dumb') {
    return LEVEL.NONE;
  }

  // CI costuma aceitar cor basica e quebrar com o resto.
  if (env.CI) {
    return env.GITHUB_ACTIONS || env.GITEA_ACTIONS ? LEVEL.TRUECOLOR : LEVEL.BASIC;
  }

  if (process.platform === 'win32') {
    // Windows Terminal e o console do VS Code fazem truecolor.
    if (env.WT_SESSION) {
      return LEVEL.TRUECOLOR;
    }
    if (env.TERM_PROGRAM === 'vscode') {
      return LEVEL.TRUECOLOR;
    }

    // O conhost do Windows 10 build 14931+ entende ANSI de 24 bits.
    const [major, , build] = os.release().split('.').map(Number);
    if (major >= 10 && build >= 14931) {
      return LEVEL.TRUECOLOR;
    }
    if (major >= 10) {
      return LEVEL.ANSI256;
    }

    // Windows anterior ao 10: sem ANSI confiavel no conhost.
    return LEVEL.NONE;
  }

  if (env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit') {
    return LEVEL.TRUECOLOR;
  }
  if (env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'Apple_Terminal') {
    return env.TERM_PROGRAM === 'iTerm.app' ? LEVEL.TRUECOLOR : LEVEL.ANSI256;
  }

  if (/-256(color)?$/i.test(env.TERM || '')) {
    return LEVEL.ANSI256;
  }
  if (/^(screen|xterm|vt100|vt220|rxvt|linux|ansi|cygwin)/i.test(env.TERM || '')) {
    return LEVEL.BASIC;
  }

  return env.TERM ? LEVEL.BASIC : LEVEL.NONE;
}

/**
 * Monta um `Painter` para o nivel informado, ou para o nivel detectado.
 *
 * Em `LEVEL.NONE` todos os metodos apenas repassam o texto, sem nenhuma
 * sequencia de escape (RNF-003). Nos demais niveis aplicam a cor da paleta
 * lida de `tokens.json` na representacao adequada (24 bits, 256 ou 16 cores).
 */
export function createPainter(level: ColorLevel = detectLevel()): Painter {
  const corDoPapel = (chave: string): ((texto: string) => string) => {
    const def = PALETA[chave];
    if (level === LEVEL.NONE) {
      return (texto: string) => texto;
    }
    if (level === LEVEL.TRUECOLOR) {
      const [r, g, b] = def.rgb;
      return (texto: string) => `\x1b[38;2;${r};${g};${b}m${texto}${RESET}`;
    }
    if (level === LEVEL.ANSI256) {
      return (texto: string) => `\x1b[38;5;${def.ansi256}m${texto}${RESET}`;
    }
    return (texto: string) => `\x1b[${def.basic}m${texto}${RESET}`;
  };

  const identidade = (texto: string) => texto;
  const petroleo = corDoPapel('petroleo');
  const muted = corDoPapel('muted');

  // Petroleo escalado por brilho: ponta do scanner em 1, rastro e inativos
  // abaixo. TRUECOLOR escala o RGB; ANSI256 cai no cubo mais proximo; BASIC
  // so distingue "forte" (petroleo) de "fraco" (muted, a forma explicita de
  // "menos importante" da marca); NONE nao envolve nada.
  const petroleoAjustado = (texto: string, brilho: number): string => {
    if (level === LEVEL.NONE) {
      return texto;
    }
    const fator = Math.min(1, Math.max(0, brilho));
    if (fator >= 0.999) {
      return petroleo(texto);
    }
    if (level === LEVEL.TRUECOLOR) {
      const [r, g, b] = PALETA.petroleo.rgb;
      return `\x1b[38;2;${Math.round(r * fator)};${Math.round(g * fator)};${Math.round(b * fator)}m${texto}${RESET}`;
    }
    if (level === LEVEL.ANSI256) {
      const [r, g, b] = PALETA.petroleo.rgb;
      const codigo =
        16 + 36 * nivelDoCubo(Math.round(r * fator)) + 6 * nivelDoCubo(Math.round(g * fator)) + nivelDoCubo(Math.round(b * fator));
      return `\x1b[38;5;${codigo}m${texto}${RESET}`;
    }
    return fator >= 0.5 ? petroleo(texto) : muted(texto);
  };

  return {
    nivel: level,
    petroleo,
    petroleoAjustado,
    paprica: corDoPapel('paprica'),
    ok: corDoPapel('success'),
    aviso: corDoPapel('warning'),
    erro: corDoPapel('error'),
    // info e a voz neutra da marca: alias de petroleo por design (tokens.json).
    info: petroleo,
    primary: corDoPapel('primary'),
    secondary: corDoPapel('secondary'),
    muted,
    // `dim` real (\x1b[2m) varia demais entre terminais; usamos muted, que e a
    // forma explicita e previsivel de "menos importante" (cli-cor.md secao 7).
    dim: muted,
    bold: level === LEVEL.NONE ? identidade : (texto: string) => `\x1b[1m${texto}${RESET}`,
    reset: level === LEVEL.NONE ? identidade : (texto: string) => `${texto}${RESET}`,
  };
}
