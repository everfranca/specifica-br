/**
 * Escapa os metacaracteres de expressao regular de um texto vindo de fonte externa
 * (aqui, o nome de um MCP declarado no arquivo da task), para que um nome com `.`
 * ou `*` seja buscado literalmente e nao como padrao.
 */
export function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Le um campo numerico de fonte externa devolvendo `0` quando ausente ou nao
 * finito, para que um evento parcial nunca corrompa a contabilidade do lote.
 */
export function numeroOuZero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}
