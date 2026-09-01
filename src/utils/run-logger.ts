import fs from 'fs-extra';
import path from 'node:path';
import { createWriteStream, type WriteStream } from 'node:fs';
import type { RunEvent } from '../types/executar-tasks.js';

const WRITE_DENIED = (logsDirLabel: string): string =>
  `sem permissao de escrita em ${logsDirLabel}`;

/** Rotulo estavel usado nas mensagens de erro, independente do caminho absoluto real. */
const LOGS_DIR_LABEL = '~/.specifica-br/logs/<projeto>/';

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/**
 * Produz o `RUN_ID` no formato `YYYYMMDD_HHmmss` em horario local (nao UTC),
 * com zero a esquerda em todos os campos, identico ao script de origem.
 *
 * @param agora Instante de referencia. Default: agora.
 */
export function buildRunId(agora: Date = new Date()): string {
  const ano = String(agora.getFullYear()).padStart(4, '0');
  const mes = doisDigitos(agora.getMonth() + 1);
  const dia = doisDigitos(agora.getDate());
  const hora = doisDigitos(agora.getHours());
  const minuto = doisDigitos(agora.getMinutes());
  const segundo = doisDigitos(agora.getSeconds());

  return `${ano}${mes}${dia}_${hora}${minuto}${segundo}`;
}

/**
 * Cria e mantem os dois arquivos de registro de uma execucao em
 * `~/.specifica-br/logs/<projeto>/`: os eventos estruturados em `.jsonl` e o
 * `stderr` bruto dos processos filhos em `.stderr`.
 *
 * Implementa RF-009, RF-023, CT-011 e CT-012. Nenhum registro e gravado dentro
 * do projeto do usuario, e nenhum valor de variavel de ambiente, token, chave ou
 * credencial e escrito em qualquer destino (secao 6.1).
 */
class RunLoggerService {
  private jsonlStream: WriteStream | null = null;
  private stderrStream: WriteStream | null = null;

  /**
   * Cria o diretorio de registros quando ausente, confirma que e gravavel e abre
   * os dois arquivos em `append`. O `.stderr` e criado mesmo que nada seja
   * escrito nele (CT-012).
   *
   * @throws {Error} Mensagem nominal de RF-023 quando o diretorio nao pode ser
   *   criado nem gravado.
   */
  public async open(logsDir: string, runId: string): Promise<void> {
    try {
      await fs.ensureDir(logsDir);
      await fs.access(logsDir, fs.constants.W_OK);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(WRITE_DENIED(LOGS_DIR_LABEL));
      }

      throw error;
    }

    const jsonlPath = path.join(logsDir, `run_${runId}.jsonl`);
    const stderrPath = path.join(logsDir, `run_${runId}.stderr`);

    this.jsonlStream = createWriteStream(jsonlPath, { flags: 'a' });
    this.stderrStream = createWriteStream(stderrPath, { flags: 'a' });

    await Promise.all([
      this.aguardarAbertura(this.jsonlStream),
      this.aguardarAbertura(this.stderrStream),
    ]);
  }

  /**
   * Serializa o evento e grava uma linha terminada em `\n`. O campo `ts` recebe
   * `new Date().toISOString()` quando ausente.
   */
  public async logEvent(evento: RunEvent): Promise<void> {
    if (!this.jsonlStream) {
      throw new Error('RunLoggerService.logEvent chamado antes de open');
    }

    const completo = evento.ts ? evento : { ...evento, ts: new Date().toISOString() };
    const linha = `${JSON.stringify(completo)}\n`;
    const stream = this.jsonlStream;

    await new Promise<void>((resolve, reject) => {
      stream.write(linha, (erro) => (erro ? reject(erro) : resolve()));
    });
  }

  /**
   * Anexa texto ao arquivo `.stderr`. Destino do `onStderrChunk` do
   * `ProcessRunner`. Nunca imprime na tela (secao 6.1).
   */
  public appendStderr(texto: string): void {
    if (!this.stderrStream) {
      throw new Error('RunLoggerService.appendStderr chamado antes de open');
    }

    this.stderrStream.write(texto);
  }

  /** Fecha os dois descritores. Nao lanca se ja fechados. */
  public async close(): Promise<void> {
    await Promise.all([
      this.fecharStream(this.jsonlStream),
      this.fecharStream(this.stderrStream),
    ]);

    this.jsonlStream = null;
    this.stderrStream = null;
  }

  /**
   * Le os `run_*.jsonl` anteriores do mesmo projeto e devolve os eventos
   * parseados, ignorando linhas invalidas sem lancar. Insumo da guarda de tasks
   * nao certificadas de RF-018 (aplicada na task-10).
   */
  public async readPreviousRuns(logsDir: string): Promise<RunEvent[]> {
    if (!(await fs.pathExists(logsDir))) {
      return [];
    }

    const entradas = await fs.readdir(logsDir);
    const arquivos = entradas.filter((nome) => /^run_.*\.jsonl$/.test(nome)).sort();
    const eventos: RunEvent[] = [];

    for (const nome of arquivos) {
      let conteudo: string;

      try {
        conteudo = await fs.readFile(path.join(logsDir, nome), 'utf-8');
      } catch {
        continue;
      }

      for (const linha of conteudo.split('\n')) {
        const texto = linha.trim();

        if (texto === '') {
          continue;
        }

        try {
          eventos.push(JSON.parse(texto) as RunEvent);
        } catch {
          continue;
        }
      }
    }

    return eventos;
  }

  private aguardarAbertura(stream: WriteStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const aoAbrir = (): void => {
        stream.removeListener('error', aoErro);
        resolve();
      };
      const aoErro = (erro: NodeJS.ErrnoException): void => {
        stream.removeListener('open', aoAbrir);

        if (erro.code === 'EACCES' || erro.code === 'EPERM') {
          reject(new Error(WRITE_DENIED(LOGS_DIR_LABEL)));
          return;
        }

        reject(erro);
      };

      stream.once('open', aoAbrir);
      stream.once('error', aoErro);
    });
  }

  private fecharStream(stream: WriteStream | null): Promise<void> {
    if (!stream || stream.closed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      stream.end(() => resolve());
    });
  }
}

export { RunLoggerService };
