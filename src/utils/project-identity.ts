import path from 'node:path';
import process from 'node:process';
import type { ProcessRunner } from './process-runner.js';
import type { ProjectIdentity } from '../types/process-runner.js';

const NOME_MAX = 64;
const NOME_FALLBACK = 'projeto-sem-nome';
const GIT_TIMEOUT_MS = 5000;

/**
 * Sanitiza um nome para uso seguro como nome de diretorio (CT-024).
 *
 * Funcao pura, exportada tambem como funcao livre para ser testavel sem
 * instanciar a classe.
 *
 * @param nome Nome bruto, possivelmente vindo de um remoto git malformado.
 * @returns Nome com apenas `[A-Za-z0-9._-]`, truncado em 64 caracteres, ou
 *   `projeto-sem-nome` quando o resultado fica vazio, `.` ou `..`.
 */
export function sanitizeProjectName(nome: string): string {
  const limpo = nome.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, NOME_MAX);

  if (limpo === '' || limpo === '.' || limpo === '..') {
    return NOME_FALLBACK;
  }

  return limpo;
}

/**
 * Resolve o identificador do projeto (CT-024, RF-010).
 *
 * Ordem: (1) nome do repositorio remoto do git; (2) nome do diretorio raiz do
 * repositorio git; (3) nome do diretorio de trabalho atual. A ausencia de git
 * nao e erro (DEP-004): ha fallback determinista para o nome do `cwd`.
 */
class ProjectIdentityService {
  private readonly runner: ProcessRunner;

  constructor(runner: ProcessRunner) {
    this.runner = runner;
  }

  /**
   * @see sanitizeProjectName
   */
  public sanitize(nome: string): string {
    return sanitizeProjectName(nome);
  }

  /**
   * Resolve a identidade do projeto para o `cwd` informado.
   *
   * @param cwd Diretorio de trabalho. Default: `process.cwd()`.
   * @returns Identidade com `nome` ja sanitizado. O nivel 3 nunca falha.
   */
  public async resolve(cwd: string = process.cwd()): Promise<ProjectIdentity> {
    const remoto = await this.runner.run('git', ['remote', 'get-url', 'origin'], {
      cwd,
      timeoutMs: GIT_TIMEOUT_MS,
    });

    if (!remoto.spawnFailed && !remoto.timedOut && remoto.exitCode === 0) {
      const bruto = this.nomeDoRemoto(remoto.stdout.trim());

      if (bruto) {
        return { nome: this.sanitize(bruto), origem: 'git-remote', bruto };
      }
    }

    const toplevel = await this.runner.run('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      timeoutMs: GIT_TIMEOUT_MS,
    });

    if (!toplevel.spawnFailed && !toplevel.timedOut && toplevel.exitCode === 0) {
      const raiz = toplevel.stdout.trim();

      if (raiz) {
        const bruto = path.basename(raiz);
        return { nome: this.sanitize(bruto), origem: 'git-toplevel', bruto };
      }
    }

    const bruto = path.basename(cwd);
    return { nome: this.sanitize(bruto), origem: 'cwd', bruto };
  }

  /**
   * Ultimo segmento do caminho da URL do remoto, sem o sufixo `.git`.
   * Divide por `/` e por `:` para cobrir tanto a forma HTTPS
   * (`https://host/org/repo.git`) quanto a SSH (`git@host:org/repo.git`).
   */
  private nomeDoRemoto(url: string): string {
    if (!url) {
      return '';
    }

    const semSufixo = url.replace(/\.git$/i, '');
    const segmentos = semSufixo.split(/[/:]/).filter((segmento) => segmento.length > 0);

    return segmentos.length > 0 ? segmentos[segmentos.length - 1] : '';
  }

  /**
   * Compoe `<logsBaseDir>/<nome>` e valida que o resultado e descendente de
   * `logsBaseDir` (linha "Path traversal" da secao 7 da techspec). Segunda
   * barreira depois da sanitizacao; ambas sao exigidas.
   *
   * @throws {Error} Quando o caminho resultante escapa de `logsBaseDir`.
   */
  public logsDirFor(identidade: ProjectIdentity, logsBaseDir: string): string {
    const alvo = path.join(logsBaseDir, identidade.nome);
    const baseResolvida = path.resolve(logsBaseDir);
    const alvoResolvido = path.resolve(alvo);

    if (alvoResolvido !== baseResolvida && !alvoResolvido.startsWith(baseResolvida + path.sep)) {
      throw new Error(
        `caminho de registros invalido: ${alvo} nao e descendente de ${logsBaseDir}`
      );
    }

    return alvo;
  }
}

export { ProjectIdentityService };
