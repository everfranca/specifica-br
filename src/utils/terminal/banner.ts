/**
 * Banner de abertura, assinatura compacta e rotulos de estado da marca.
 *
 * Porte de `src/brand/terminal/banner.js` (Nota de Decisao 2 da techspec:
 * sincronia manual). As assinaturas foram ajustadas ao contrato desta task
 * (secao 2.c): `banner` e `signature` recebem um `Painter` pronto e `status`
 * recebe `(kind, mensagem, painter)`.
 *
 * Regra que governa este arquivo: TUDO em ASCII imprimivel (0x20 a 0x7E). Nada
 * de moldura Unicode nem de meio-bloco. O cmd.exe roda em codepage 437/850 e
 * substitui esses glifos por lixo, e a marca precisa aparecer igual em Linux,
 * macOS e Windows. A unica excecao sao as sequencias de escape ANSI, que nao
 * sao texto e o terminal consome. Nenhum emoji, em nenhum nivel (RF-013).
 */

import type { GlyphLevel } from './types.js';
import type { Painter, StatusKind } from './types.js';

/* Linhas do icone: a Rota A traduzida para caracteres. Cada entrada separa o
   contorno (petroleo) do prompt (paprica), para pintar cada parte com sua cor
   sem recortar string depois. */
const ICONE: Array<{ frame: string; mid?: string; tail?: string }> = [
  { frame: '  ______' },
  { frame: ' |      \\' },
  { frame: ' |  ', mid: '>', tail: '    |' },
  { frame: ' |       |' },
  { frame: ' |_______|' },
];

const NOME_INICIO = 'specifica';
const NOME_FIM = '-br';
const TAGLINE = 'ORQUESTRADOR CLI SDD PT-BR';

/**
 * Monta o banner de abertura em ASCII puro e devolve as linhas.
 *
 * @param painter pintor ja resolvido para o nivel de cor do stream.
 * @param glyphLevel nivel de glifo do stream. O banner e sempre ASCII, entao
 *   o parametro nao altera os caracteres; existe para uniformidade com os
 *   demais primitivos e para uso futuro.
 */
export function banner(painter: Painter, glyphLevel: GlyphLevel): string[] {
  void glyphLevel;

  const nome = painter.bold(painter.primary(NOME_INICIO) + painter.paprica(NOME_FIM));
  // O texto entra nas linhas 3 e 4, na altura optica do centro do icone.
  const aside = ['', '', nome, painter.muted(TAGLINE), ''];

  return ICONE.map((linha, i) => {
    const icone = linha.mid
      ? painter.petroleo(linha.frame) + painter.paprica(linha.mid) + painter.petroleo(linha.tail ?? '')
      : painter.petroleo(linha.frame);
    const texto = aside[i];
    return texto ? `${icone}   ${texto}` : icone;
  });
}

/**
 * Assinatura de uma linha, para prompts, rodapes e cabecalhos: `> specifica-br`.
 */
export function signature(painter: Painter): string {
  return painter.paprica('>') + ' ' + painter.primary(NOME_INICIO) + painter.paprica(NOME_FIM);
}

const ROTULOS: Record<StatusKind, string> = {
  ok: '[OK]',
  aviso: '[AVISO]',
  erro: '[ERRO]',
  info: '[INFO]',
};

/* Largura da calha em que os rotulos se alinham. O preenchimento ate ela e
   texto neutro, escrito FORA da marcacao de cor (RF-001). */
const CALHA = 7;

/**
 * Devolve a linha de estado: o rotulo por extenso pintado no papel semantico,
 * preenchido a direita ate a calha de sete colunas, seguido de um unico espaco
 * e da mensagem (cli-layout.md: nunca dois espacos, nunca zero). O texto da
 * mensagem comeca sempre na coluna 9, com ou sem cor (RF-001, RNF-001), e o
 * preenchimento fica fora de qualquer sequencia de escape. Nenhum emoji e
 * emitido em nenhum nivel (RF-013).
 *
 * Quando a mensagem e vazia (ou so espacos), devolve apenas o rotulo pintado,
 * sem preenchimento e sem espaco a direita, para nao abrir lacuna dentro do
 * separador horizontal que o compoe (RF-002).
 */
export function status(kind: StatusKind, mensagem: string, painter: Painter): string {
  const cor: Record<StatusKind, (texto: string) => string> = {
    ok: painter.ok,
    aviso: painter.aviso,
    erro: painter.erro,
    info: painter.info,
  };
  const rotulo = ROTULOS[kind];
  if (mensagem.trim() === '') {
    return cor[kind](rotulo);
  }
  const preenchimento = ' '.repeat(Math.max(0, CALHA - rotulo.length));
  return cor[kind](rotulo) + preenchimento + ' ' + mensagem;
}
