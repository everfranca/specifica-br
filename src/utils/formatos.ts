/**
 * Formatacao de duracao e de milhar para a camada de apresentacao.
 *
 * Modulo puro por construcao (techspec secao 2.2): nao importa de `terminal/`,
 * nao le relogio e nao faz I/O. E o que permite testa-lo por tabela.
 */

const FORMATADOR_MILHAR = new Intl.NumberFormat('pt-BR');

function pad2(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * Converte segundos para a forma humana da tabela de RF-004: abaixo de um
 * minuto so segundos; de um minuto a menos de uma hora, minutos e segundos com
 * dois digitos; de uma hora em diante, horas e minutos, sem segundos.
 *
 * Nao lanca: entrada negativa, `NaN`, `Infinity` ou `undefined` devolve `'0s'`.
 *
 * @param segundos Duracao medida, em segundos.
 * @returns A duracao na forma humana.
 */
export function formatarDuracao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) {
    return '0s';
  }
  const total = Math.floor(segundos);
  if (total < 60) {
    return `${total}s`;
  }
  if (total < 3600) {
    return `${Math.floor(total / 60)}m ${pad2(total % 60)}s`;
  }
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  return `${horas}h ${pad2(minutos)}m`;
}

/**
 * Devolve o inteiro com separacao de milhar pt-BR (`1234567` -> `1.234.567`).
 *
 * Nao lanca: entrada nao finita devolve `'0'`.
 *
 * @param valor Numero a formatar.
 * @returns O inteiro formatado.
 */
export function formatarMilhar(valor: number): string {
  if (!Number.isFinite(valor)) {
    return '0';
  }
  return FORMATADOR_MILHAR.format(Math.trunc(valor));
}
