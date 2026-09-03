/**
 * Leitura tolerante de JSON com comentarios (CT-036).
 *
 * O OpenCode carrega `opencode.json` e `opencode.jsonc` com um parser de JSONC: um
 * arquivo com comentario ou virgula final e valido para ele. Se o preflight usasse
 * `JSON.parse`, um projeto perfeitamente funcional seria abortado com ERRO falso
 * antes da primeira task. A tolerancia daqui existe para que o preflight so
 * classifique como ERRO aquilo que a propria ferramenta rejeitaria.
 */

/**
 * Interpreta um texto JSONC e devolve o valor lido.
 *
 * A funcao nunca lanca por conta propria: a unica excecao que se propaga e a do
 * `JSON.parse` final, quando o texto continua invalido depois de removidos os
 * comentarios e as virgulas finais. O retorno e `unknown` de proposito - quem chama
 * estreita por verificacao de campo.
 *
 * @param texto - Conteudo bruto do arquivo de configuracao
 * @returns O valor interpretado, ainda nao estreitado
 * @throws {SyntaxError} Quando o texto nao e JSON valido apos a normalizacao
 */
export function parseJsonc(texto: string): unknown {
  return JSON.parse(removerVirgulasFinais(removerComentarios(texto)));
}

/**
 * Remove comentarios de linha e de bloco preservando o conteudo das strings.
 *
 * A varredura mantem o estado "dentro de string" porque um `replace` ingenuo sobre
 * `//` destruiria `"https://mcp.exemplo.com"` e criaria justamente o falso positivo
 * que a tolerancia existe para eliminar.
 */
function removerComentarios(texto: string): string {
  let saida = '';
  let dentroDeString = false;
  let escapado = false;

  for (let i = 0; i < texto.length; i += 1) {
    const atual = texto[i];

    if (dentroDeString) {
      saida += atual;
      if (escapado) {
        escapado = false;
      } else if (atual === '\\') {
        escapado = true;
      } else if (atual === '"') {
        dentroDeString = false;
      }
      continue;
    }

    if (atual === '"') {
      dentroDeString = true;
      saida += atual;
      continue;
    }

    if (atual === '/' && texto[i + 1] === '/') {
      const fim = texto.indexOf('\n', i);
      i = fim === -1 ? texto.length : fim - 1;
      continue;
    }

    if (atual === '/' && texto[i + 1] === '*') {
      const fim = texto.indexOf('*/', i + 2);
      i = fim === -1 ? texto.length : fim + 1;
      continue;
    }

    saida += atual;
  }

  return saida;
}

/**
 * Remove a virgula seguida apenas de espacos e de `}` ou `]`.
 *
 * A varredura tambem e feita com estado por seguranca: uma string de dado como
 * `"lista,]"` nao pode ser reescrita por uma regra que existe para pontuacao.
 */
function removerVirgulasFinais(texto: string): string {
  let saida = '';
  let dentroDeString = false;
  let escapado = false;

  for (let i = 0; i < texto.length; i += 1) {
    const atual = texto[i];

    if (dentroDeString) {
      saida += atual;
      if (escapado) {
        escapado = false;
      } else if (atual === '\\') {
        escapado = true;
      } else if (atual === '"') {
        dentroDeString = false;
      }
      continue;
    }

    if (atual === '"') {
      dentroDeString = true;
      saida += atual;
      continue;
    }

    if (atual === ',') {
      let j = i + 1;
      while (j < texto.length && /\s/.test(texto[j])) {
        j += 1;
      }
      if (texto[j] === '}' || texto[j] === ']') {
        continue;
      }
    }

    saida += atual;
  }

  return saida;
}
