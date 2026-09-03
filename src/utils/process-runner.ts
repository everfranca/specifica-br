import { spawn as nodeSpawn } from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import type { RunOptions, RunResult } from '../types/process-runner.js';

type SpawnFn = typeof nodeSpawn;

/**
 * Dependencias injetaveis do `ProcessRunner`. Existem para tornar `process.platform`
 * e a funcao de `spawn` substituiveis nos testes, sem depender do sistema real.
 */
export interface ProcessRunnerDeps {
  platform?: NodeJS.Platform;
  spawnFn?: SpawnFn;
}

const WINDOWS_DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';
const SIGKILL_GRACE_MS = 5000;

/**
 * Unico ponto do binario que cria processos filhos.
 *
 * Carrega tres decisoes de seguranca da secao 7 da techspec, todas nao negociaveis:
 * `shell: false` em toda invocacao (nenhuma string de comando montada por
 * concatenacao); varredura explicita de `PATH` sem busca no diretorio corrente
 * (um `claude.cmd` plantado no repositorio nunca e executado); e leitura de saida
 * dentro do binario, sem `jq`, `bc` ou `column` (RNF-007).
 */
class ProcessRunner {
  private readonly platform: NodeJS.Platform;
  private readonly spawnFn: SpawnFn;

  constructor(deps: ProcessRunnerDeps = {}) {
    this.platform = deps.platform ?? process.platform;
    this.spawnFn = deps.spawnFn ?? nodeSpawn;
  }

  private get isWindows(): boolean {
    return this.platform === 'win32';
  }

  private async isExecutableFile(candidato: string): Promise<boolean> {
    try {
      const stats = await fs.stat(candidato);

      if (!stats.isFile()) {
        return false;
      }

      if (this.isWindows) {
        return true;
      }

      await fs.access(candidato, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolucao explicita do executavel, varrendo `PATH` (e `PATHEXT` no Windows).
   *
   * Nunca inclui o diretorio corrente na varredura: uma entrada vazia em `PATH`
   * significa diretorio corrente em alguns shells e e descartada. Esta e a
   * protecao da secao 7 da techspec contra um `claude.cmd` plantado no repositorio.
   *
   * @param comando Nome do executavel ou caminho ja contendo separador.
   * @param env Ambiente de onde ler `PATH`/`PATHEXT`. Default: `process.env`.
   * @returns Caminho absoluto do executavel, ou `null` quando nao resolvido.
   *   Nunca lanca: quem transforma ausencia em `[ ERRO]` e o preflight (task-7).
   */
  public async which(comando: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
    if (comando.includes('/') || (this.isWindows && comando.includes('\\'))) {
      const absoluto = path.resolve(comando);
      return (await this.isExecutableFile(absoluto)) ? absoluto : null;
    }

    const rawPath = env.PATH ?? env.Path ?? '';

    if (!rawPath) {
      return null;
    }

    const diretorios = rawPath.split(path.delimiter).filter((entrada) => entrada.length > 0);

    const extensoes = this.isWindows
      ? (env.PATHEXT ?? WINDOWS_DEFAULT_PATHEXT).split(';').filter((ext) => ext.length > 0)
      : [];

    for (const diretorio of diretorios) {
      const base = path.join(diretorio, comando);
      const candidatos = this.isWindows ? [base, ...extensoes.map((ext) => base + ext)] : [base];

      for (const candidato of candidatos) {
        if (await this.isExecutableFile(candidato)) {
          return candidato;
        }
      }
    }

    return null;
  }

  /**
   * Executa `comando args` com `shell: false`, acumulando `stdout` e `stderr`.
   *
   * @returns `RunResult` normalizado. Executavel nao resolvido ou `spawn` que
   *   falha devolvem `spawnFailed: true` e `exitCode: -1`, sem lancar excecao.
   */
  public async run(comando: string, args: string[], opcoes: RunOptions = {}): Promise<RunResult> {
    const env = opcoes.env ?? process.env;
    const resolvido = await this.which(comando, env);

    const falhaDeSpawn: RunResult = {
      exitCode: -1,
      signal: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      aborted: false,
      spawnFailed: true,
    };

    if (!resolvido) {
      return falhaDeSpawn;
    }

    let executavel = resolvido;
    let argumentos = args;

    // No Windows, arquivos .bat e .cmd nao podem ser lancados diretamente por
    // spawn sem um interpretador (documentacao oficial de node:child_process), e
    // a CLI da ferramenta de IA instalada por npm costuma ser um claude.cmd.
    // Invocamos via ComSpec com os argumentos em array: preserva a propriedade
    // de seguranca da secao 7 (nenhuma string de comando concatenada, shell: false).
    if (this.isWindows && /\.(bat|cmd)$/i.test(resolvido)) {
      executavel = (env.ComSpec as string | undefined) || process.env.ComSpec || 'cmd.exe';
      argumentos = ['/d', '/s', '/c', resolvido, ...args];
    }

    const stdinModo: 'ignore' | 'inherit' = opcoes.stdin ?? 'ignore';
    const stdio: ('ignore' | 'inherit' | 'pipe')[] = [stdinModo, 'pipe', 'pipe'];

    const spawnOptions: SpawnOptions = {
      cwd: opcoes.cwd,
      env,
      shell: false,
      stdio,
    };

    return await new Promise<RunResult>((resolver) => {
      let child: ChildProcess;

      try {
        child = this.spawnFn(executavel, argumentos, spawnOptions);
      } catch {
        resolver(falhaDeSpawn);
        return;
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let aborted = false;
      let settled = false;
      let sigtermTimer: NodeJS.Timeout | undefined;
      let sigkillTimer: NodeJS.Timeout | undefined;
      let sigkillDoAborto: NodeJS.Timeout | undefined;

      const limparTimers = (): void => {
        if (sigtermTimer) {
          clearTimeout(sigtermTimer);
        }
        if (sigkillTimer) {
          clearTimeout(sigkillTimer);
        }
        if (sigkillDoAborto) {
          clearTimeout(sigkillDoAborto);
        }
        sigtermTimer = undefined;
        sigkillTimer = undefined;
        sigkillDoAborto = undefined;
        if (opcoes.signal) {
          opcoes.signal.removeEventListener('abort', aoAbortar);
        }
      };

      // Cancelamento explicito: mesma disciplina do timeout (SIGTERM e, apos o
      // periodo de cortesia, SIGKILL). No Windows `kill` encerra o filho pelo
      // handle, que e a unica via disponivel sem grupo de processo POSIX.
      function aoAbortar(): void {
        if (settled) {
          return;
        }
        aborted = true;
        child.kill('SIGTERM');
        sigkillDoAborto = setTimeout(() => {
          child.kill('SIGKILL');
        }, SIGKILL_GRACE_MS);
        if (typeof sigkillDoAborto.unref === 'function') {
          sigkillDoAborto.unref();
        }
      }

      child.stdout?.setEncoding('utf-8');
      child.stderr?.setEncoding('utf-8');

      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
        if (opcoes.onStderrChunk) {
          opcoes.onStderrChunk(chunk);
        }
      });

      child.on('error', () => {
        if (settled) {
          return;
        }
        settled = true;
        limparTimers();
        resolver({
          exitCode: -1,
          signal: null,
          stdout,
          stderr,
          timedOut,
          aborted,
          spawnFailed: true,
        });
      });

      // Resolve em `close`, nao em `exit`: so `close` garante todos os fluxos de
      // stdio drenados. Resolver em `exit` pode devolver `stdout` truncado, e o
      // `stdout` desta feature carrega o JSON de CT-020.
      child.on('close', (code, signal) => {
        if (settled) {
          return;
        }
        settled = true;
        limparTimers();
        resolver({
          exitCode: code ?? -1,
          signal: (signal as NodeJS.Signals | null) ?? null,
          stdout,
          stderr,
          timedOut,
          aborted,
          spawnFailed: false,
        });
      });

      if (opcoes.signal) {
        if (opcoes.signal.aborted) {
          aoAbortar();
        } else {
          opcoes.signal.addEventListener('abort', aoAbortar, { once: true });
        }
      }

      if (opcoes.timeoutMs && opcoes.timeoutMs > 0) {
        sigtermTimer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          sigkillTimer = setTimeout(() => {
            child.kill('SIGKILL');
          }, SIGKILL_GRACE_MS);
          if (typeof sigkillTimer.unref === 'function') {
            sigkillTimer.unref();
          }
        }, opcoes.timeoutMs);
        if (typeof sigtermTimer.unref === 'function') {
          sigtermTimer.unref();
        }
      }
    });
  }

  /**
   * Conveniencia para CT-023 (`claude --version`): a primeira linha do `stdout`,
   * ou string vazia em falha, timeout ou `spawnFailed`.
   */
  public async runCapturingFirstLine(
    comando: string,
    args: string[],
    opcoes: RunOptions = {}
  ): Promise<string> {
    const resultado = await this.run(comando, args, opcoes);

    if (resultado.spawnFailed || resultado.timedOut || resultado.exitCode !== 0) {
      return '';
    }

    return resultado.stdout.split(/\r?\n/, 1)[0] ?? '';
  }
}

export { ProcessRunner };
export const processRunner = new ProcessRunner();
