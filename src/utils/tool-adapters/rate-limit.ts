const RATE_LIMIT_REGEX = /usage limit|rate.?limit|weekly limit|session limit/i;

/**
 * Deteccao de limite de uso de RF-019, sobre o texto bruto da saida, insensivel a
 * caixa. A logica e comum a qualquer ferramenta: opera sobre texto, nao sobre o
 * formato estruturado de nenhuma CLI em particular.
 */
export function detectRateLimit(rawOutput: string): boolean {
  return RATE_LIMIT_REGEX.test(rawOutput);
}
