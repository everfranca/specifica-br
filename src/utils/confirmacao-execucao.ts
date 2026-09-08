/**
 * Confirmacao de execucao do `executar-tasks` (RF-025).
 *
 * Helper readline proprio, dependencia zero: a pergunta e uma linha so, escrita
 * com a paleta da marca, e a leitura e por linha (com `Enter`), sem raw mode.
 * A leitura manual de `line` existe porque um EOF com buffer vazio nao pode
 * parecer um Enter: sem resposta, nunca se inicia um lote.
 *
 * O helper nao sabe de TTY nem de CI: quem decide SE se pergunta e
 * `devePerguntar`, testavel sem tocar o terminal. Quem pergunta nao decide.
 */

import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { Painter } from './terminal/index.js';

export type DecisaoDeConfirmacao = 'confirmado' | 'recusado' | 'interrompido';

export interface CondicoesDeConfirmacao {
  yes: boolean;
  dryRun: boolean;
  stdinIsTTY: boolean;
  ci: boolean;
}

export interface PerguntaDeConfirmacao {
  tasks: number;
  ferramenta: string;
  model: string;
  effort: string;
  acessoTotal: boolean;
}

export interface CanaisDeConfirmacao {
  entrada: NodeJS.ReadableStream;
  saida: NodeJS.WritableStream;
  painter: Painter;
}

/* Conjuntos fechados de resposta, todos em minusculas: a comparacao normaliza
   a caixa antes de consultar. A string vazia confirma porque o padrao da
   pergunta e `Y` — Enter e a resposta de quem concorda. Acentos ficam de fora
   (RNF-003). */
const CONFIRMACOES: ReadonlySet<string> = new Set(['', 'y', 'yes', 's', 'sim']);
const RECUSAS: ReadonlySet<string> = new Set(['n', 'no', 'nao']);

/**
 * Tabela-verdade do gate (secao 3.1 de RF-025): pergunta apenas em terminal
 * interativo, fora de CI, sem `--yes` e sem `--dry-run`. Um lote disparado sem
 * quem responda nao pode ficar pendurado a espera de uma tecla.
 */
export function devePerguntar(condicoes: CondicoesDeConfirmacao): boolean {
  return !condicoes.yes && !condicoes.dryRun && condicoes.stdinIsTTY && !condicoes.ci;
}

/**
 * Texto da pergunta, sem o `> ` nem a dica `(Y/n)` — esses sao da camada de
 * escrita, que os pinta. O `(acesso total)` entra no texto porque faz parte do
 * risco que o usuario esta avaliando, e nao da acao de responder.
 */
export function montarPergunta(pergunta: PerguntaDeConfirmacao): string {
  const base = `iniciar a execucao? ${pergunta.tasks} tasks com ${pergunta.ferramenta}/${pergunta.model}/${pergunta.effort}`;
  return pergunta.acessoTotal ? `${base} (acesso total)` : base;
}

function decisaoDaResposta(resposta: string): DecisaoDeConfirmacao | null {
  const texto = resposta.trim().toLowerCase();
  if (CONFIRMACOES.has(texto)) {
    return 'confirmado';
  }
  if (RECUSAS.has(texto)) {
    return 'recusado';
  }
  return null;
}

/**
 * Escreve a pergunta e le uma linha; repete enquanto a resposta nao for
 * reconhecida. `Enter` confirma (padrao `Y`). `Ctrl+C` e EOF sem resposta
 * devolvem `interrompido`: na duvida, nao gasta. A interface readline e
 * fechada em todos os caminhos, e o cursor nunca e tocado (RNF-004).
 */
export async function confirmarExecucao(
  textoDaPergunta: string,
  io: CanaisDeConfirmacao
): Promise<DecisaoDeConfirmacao> {
  const escreverPergunta = (): void => {
    io.saida.write(
      io.painter.paprica('> ') +
        io.painter.primary(textoDaPergunta) +
        io.painter.secondary(' (Y/n)')
    );
  };

  const rl = createInterface({
    input: io.entrada as Readable,
    output: io.saida as Writable,
    terminal: false,
  });

  return new Promise<DecisaoDeConfirmacao>((resolve) => {
    let encerrado = false;
    const aoSigint = (): void => finalizar('interrompido');
    const aoFechamento = (): void => finalizar('interrompido');
    const finalizar = (decisao: DecisaoDeConfirmacao): void => {
      if (encerrado) {
        return;
      }
      encerrado = true;
      process.removeListener('SIGINT', aoSigint);
      io.entrada.removeListener('close', aoFechamento);
      rl.close();
      resolve(decisao);
    };

    rl.on('line', (linha: string) => {
      const decisao = decisaoDaResposta(linha);
      if (decisao === null) {
        escreverPergunta();
        return;
      }
      finalizar(decisao);
    });
    // So dispara com `terminal: true`; fica registrado porque o `Ctrl+C` de
    // verdade chega por SIGINT de processo, tratado ao lado.
    rl.on('SIGINT', aoSigint);
    rl.on('close', aoFechamento);
    // Um stdin destruido sem `end` (stream encerrado a bruto) nao emite o
    // `close` do readline; o fechamento do proprio stream resolve na mesma.
    io.entrada.on('close', aoFechamento);
    // Em modo cozido o Ctrl+C vira SIGINT de processo, e o handler do comando
    // (RF-024) tambem e chamado; este aqui so resolve a pergunta pendente.
    process.once('SIGINT', aoSigint);

    escreverPergunta();
  });
}
