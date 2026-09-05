/**
 * Determinacao do horario de renovacao da cota a partir do texto que a
 * ferramenta de IA escreve (RF-015, CT-044).
 *
 * Modulo puro por construcao (techspec secao 4.5): nao le relogio, nao faz I/O
 * e nao conhece a camada de terminal. O instante de referencia chega por
 * parametro. E o que permite testa-lo por tabela.
 */

import { detectRateLimit } from './tool-adapters/rate-limit.js';

/** Sequencias de controle CSI, removidas antes de qualquer casamento. */
const ANSI_CSI = /\u001B\[[0-9;?]*[ -\/]*[@-~]/g;

/** Sequencias de controle OSC, removidas antes de qualquer casamento. */
const ANSI_OSC = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

/** Teto absoluto de RNF-007: nenhuma espera passa de 12 horas. */
const TETO_ABSOLUTO_MS = 12 * 60 * 60 * 1000;

/** Termos que associam um epoch cru a uma renovacao de cota (CT-044, forma 1). */
const ASSOCIACAO = /reset|renew|available|try again/i;

const ISO_8601 = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/;
const EPOCH_SEGUNDOS = /\b(\d{10})\b/;
const HORARIO_DO_DIA = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b\s*(am|pm)?/i;
const QUANTIDADE_IN = /\bin\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/i;
const QUANTIDADE_UNTIL = /\b(\d+)\s*(minutes?|hours?)\s+(?:until|before)\b/i;

/** Remove as sequencias ANSI do texto bruto, antes de qualquer regex. */
function removerAnsi(texto: string): string {
  return texto.replace(ANSI_CSI, '').replace(ANSI_OSC, '');
}

/**
 * Forma 1 da tabela de CT-044: instante absoluto. O ISO 8601 vale por si; o
 * epoch em segundos so vale quando a linha o associa a uma renovacao.
 */
function porInstanteAbsoluto(linhas: string[]): Date | null {
  for (const linha of linhas) {
    const iso = ISO_8601.exec(linha);
    if (iso) {
      const instante = new Date(iso[0]);
      if (!Number.isNaN(instante.getTime())) {
        return instante;
      }
    }

    if (!ASSOCIACAO.test(linha)) {
      continue;
    }

    const epoch = EPOCH_SEGUNDOS.exec(linha);
    if (epoch) {
      return new Date(Number(epoch[1]) * 1000);
    }
  }

  return null;
}

/**
 * Forma 2 da tabela de CT-044: horario do dia, aceito apenas na mesma linha do
 * casamento de limite de uso, resolvido para a proxima ocorrencia futura.
 */
function porHorarioDoDia(linhas: string[], agora: number): Date | null {
  for (const linha of linhas) {
    if (!detectRateLimit(linha)) {
      continue;
    }

    const casamento = HORARIO_DO_DIA.exec(linha);
    if (!casamento) {
      continue;
    }

    let hora = Number(casamento[1]);
    const minuto = Number(casamento[2]);
    const sufixo = casamento[3]?.toLowerCase();

    if (sufixo === 'pm' && hora < 12) {
      hora += 12;
    }
    if (sufixo === 'am' && hora === 12) {
      hora = 0;
    }

    const instante = new Date(agora);
    instante.setHours(hora, minuto, 0, 0);
    if (instante.getTime() <= agora) {
      instante.setDate(instante.getDate() + 1);
    }

    return instante;
  }

  return null;
}

/** Forma 3 da tabela de CT-044: quantidade restante, resolvida em `agora + duracao`. */
function porQuantidadeRestante(linhas: string[], agora: number): Date | null {
  for (const linha of linhas) {
    const casamento = QUANTIDADE_IN.exec(linha) ?? QUANTIDADE_UNTIL.exec(linha);
    if (!casamento) {
      continue;
    }

    const quantidade = Number(casamento[1]);
    const emHoras = casamento[2].toLowerCase().startsWith('h');
    const duracaoMs = quantidade * (emHoras ? 3600 : 60) * 1000;

    return new Date(agora + duracaoMs);
  }

  return null;
}

/**
 * Extrai o horario de renovacao da cota do texto da ferramenta, nas tres formas
 * de CT-044, na ordem da tabela: a primeira que casa vence.
 *
 * Nao lanca. Devolve `null` (horario desconhecido) quando nenhuma forma casou,
 * quando o instante resolvido esta no passado, ou quando esta a mais de 12 horas
 * a frente (RNF-007). Um horario desconhecido nunca produz espera cega: cai para
 * a sondagem periodica de RF-016.
 *
 * @param texto Texto bruto da ferramenta (`stdout + "\n" + stderr`).
 * @param agora Instante de referencia, em milissegundos epoch.
 * @returns O instante de renovacao, ou `null` quando desconhecido.
 */
export function determinarRenovacao(texto: string, agora: number): Date | null {
  const linhas = removerAnsi(texto).split(/\r?\n/);
  const candidato =
    porInstanteAbsoluto(linhas) ??
    porHorarioDoDia(linhas, agora) ??
    porQuantidadeRestante(linhas, agora);

  if (candidato === null) {
    return null;
  }

  const instanteMs = candidato.getTime();
  if (!Number.isFinite(instanteMs)) {
    return null;
  }
  if (instanteMs <= agora) {
    return null;
  }
  if (instanteMs - agora > TETO_ABSOLUTO_MS) {
    return null;
  }

  return candidato;
}
