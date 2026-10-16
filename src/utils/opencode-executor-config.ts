import fs from 'fs-extra';
import path from 'node:path';
import { resolveHome } from './path-resolver.js';
import {
  OPENCODE_AGENTE_EXECUTOR,
  OPENCODE_CONFIG_SCHEMA,
  type ContextInjection,
  type ExecutorConfig,
  type ExecutorPermissionRule,
} from '../types/executar-tasks.js';

const DIR_APOIO = ['.specifica-br', 'opencode'];
const DESCRICAO_DO_AGENTE = 'Executor de tasks do specifica-br (uso nao-interativo)';
const IDADE_MAXIMA_MS = 24 * 60 * 60 * 1000;

/** Mensagem unica de falha do arquivo de apoio (RF-017, RNF-003). */
export const ERRO_ARQUIVO_DE_APOIO =
  'arquivo de apoio de execucao do specifica-br ausente ou ilegivel';

/** `Ferramenta`, sem parenteses. `_` fica de fora de proposito: e o que exclui `mcp__servidor__ferramenta`. */
const FORMA_SIMPLES = /^[A-Za-z][A-Za-z0-9-]*$/;

/** `Ferramenta(padrao)`, com o padrao capturado verbatim. */
const FORMA_COM_PADRAO = /^([A-Za-z][A-Za-z0-9-]*)\((.+)\)$/;

/** Nome de ferramenta informado para nome de acao V2, em minusculas. */
const ACOES_V2: Record<string, string> = {
  read: 'read',
  edit: 'edit',
  shell: 'shell',
  subagent: 'subagent',
  grep: 'grep',
  glob: 'glob',
  webfetch: 'webfetch',
  websearch: 'websearch',
  skill: 'skill',
  bash: 'shell',
  task: 'subagent',
  write: 'edit',
  patch: 'edit',
};

/** Resultado da traducao de `--allow`: regras permissivas e avisos nominais. */
export interface TraducaoDeAllow {
  regras: ExecutorPermissionRule[];
  avisos: string[];
}

/**
 * Traduz os valores de `--allow` em regras permissivas do agente (CT-035).
 *
 * `Ferramenta` vira `{action, resource: "*", effect: "allow"}` e
 * `Ferramenta(padrao)` vira `{action, resource: "<padrao> verbatim",
 * effect: "allow"}`, sempre com o nome de acao V2 em minusculas. Qualquer
 * outra forma nao gera regra e produz um aviso nominal, uma linha por regra,
 * nunca em silencio.
 *
 * Invariante de seguranca: o unico veredito produzido aqui e `allow`. Por
 * construcao a traducao nao consegue reduzir permissao alguma.
 *
 * @param allow Valores informados pelo usuario, na ordem em que ele os informou.
 * @returns Regras ordenadas e os avisos das formas descartadas.
 */
export function traduzirAllow(allow: string[]): TraducaoDeAllow {
  const regras: ExecutorPermissionRule[] = [];
  const avisos: string[] = [];

  for (const bruta of allow) {
    const regra = bruta.trim();

    if (regra === '') {
      continue;
    }

    const comPadrao = FORMA_COM_PADRAO.exec(regra);

    if (comPadrao) {
      const acao = ACOES_V2[comPadrao[1].toLowerCase()];

      if (acao === undefined) {
        avisos.push(`regra de permissao ${regra} sem equivalente no OpenCode - ignorada durante o lote`);
        continue;
      }

      regras.push({ action: acao, resource: comPadrao[2], effect: 'allow' });
      continue;
    }

    if (FORMA_SIMPLES.test(regra)) {
      const acao = ACOES_V2[regra.toLowerCase()];

      if (acao === undefined) {
        avisos.push(`regra de permissao ${regra} sem equivalente no OpenCode - ignorada durante o lote`);
        continue;
      }

      regras.push({ action: acao, resource: '*', effect: 'allow' });
      continue;
    }

    avisos.push(`regra de permissao ${regra} sem equivalente no OpenCode - ignorada durante o lote`);
  }

  return { regras, avisos };
}

/** Entrada de `OpenCodeExecutorConfigService.ensure` (CT-035). */
export interface EnsureExecutorConfigInput {
  runId: string;
  pid: number;
  formaDeInjecao: ContextInjection;
  destiladoPath: string | null;
  allow: string[];
}

/** Saida de `ensure`: o caminho gravado e os avisos da traducao de `--allow`. */
export interface EnsureExecutorConfigResult {
  caminho: string;
  avisos: string[];
}

/**
 * Monta o conteudo do arquivo de apoio de execucao do OpenCode (CT-035).
 *
 * O `permissions` do agente comeca sempre pela regra curinga allow-all e
 * recebe as regras traduzidas de `--allow` depois dela, na ordem informada
 * pelo usuario: como a avaliacao V2 aplica a ultima regra que casa, o que vem
 * depois vence.
 *
 * @param entrada Identificacao do lote, forma de injecao, destilado e `--allow`.
 * @returns A configuracao e os avisos das regras nao traduziveis.
 */
export function montarExecutorConfig(entrada: EnsureExecutorConfigInput): {
  config: ExecutorConfig;
  avisos: string[];
} {
  const { regras, avisos } = traduzirAllow(entrada.allow);

  const permissions: ExecutorPermissionRule[] = [
    { action: '*', resource: '*', effect: 'allow' },
    ...regras,
  ];

  let instructions: string[] | null = null;

  switch (entrada.formaDeInjecao) {
    case 'instructions':
      if (entrada.destiladoPath !== null && entrada.destiladoPath.trim() !== '') {
        instructions = [path.resolve(entrada.destiladoPath)];
      }
      break;
    case 'prompt':
      break;
    default: {
      const _exaustivo: never = entrada.formaDeInjecao;
      return _exaustivo;
    }
  }

  const config: ExecutorConfig = {
    $schema: OPENCODE_CONFIG_SCHEMA,
    ...(instructions === null ? {} : { instructions }),
    agents: {
      [OPENCODE_AGENTE_EXECUTOR]: {
        description: DESCRICAO_DO_AGENTE,
        mode: 'primary',
        permissions,
      },
    },
  };

  return { config, avisos };
}

/**
 * Ciclo de vida do arquivo de apoio de execucao do OpenCode (CT-035).
 *
 * O arquivo vive em `~/.specifica-br/opencode/` e nunca dentro do projeto do
 * usuario (RNF-002). E o unico mecanismo capaz de entregar permissao total ao
 * lote (RF-007): a permissao do agente entra depois da global e da do projeto
 * na concatenacao avaliada por `findLast`, e `--auto` sozinho nao venceria um
 * `deny` explicito, porque `ask()` nega antes de perguntar.
 */
export class OpenCodeExecutorConfigService {
  public readonly dir: string;
  private caminhoAtual: string | null = null;

  /**
   * @param home Diretorio do usuario. Default: `resolveHome()`, que ja trata
   *   `HOME` e `USERPROFILE`. Parametrizado para permitir teste sem tocar no
   *   home real da maquina.
   */
  constructor(home: string = resolveHome()) {
    this.dir = path.join(home, ...DIR_APOIO);
  }

  /** Caminho absoluto do arquivo deste lote, por `RUN_ID` e PID. */
  public caminhoDe(runId: string, pid: number): string {
    return path.join(this.dir, `executor-${runId}-${pid}.json`);
  }

  /** Caminho do temporario da escrita atomica, no mesmo diretorio do destino. */
  private temporarioDe(runId: string, pid: number): string {
    return path.join(this.dir, `executor-${runId}-${pid}.json.tmp`);
  }

  /** Caminho gravado pela ultima chamada de `ensure`, ou `null` antes dela. */
  public get caminho(): string | null {
    return this.caminhoAtual;
  }

  /**
   * Cria `~/.specifica-br/opencode/` e grava o arquivo de apoio de forma
   * atomica: escreve em `<destino>.tmp` e aplica `rename` sobre o destino. Uma
   * interrupcao no meio da escrita nunca deixa JSON truncado no lugar do
   * arquivo bom. Rechamar sobrescreve o mesmo caminho, com a mesma disciplina.
   *
   * @param entrada Identificacao do lote, forma de injecao, destilado e `--allow`.
   * @returns O caminho gravado e os avisos das regras `--allow` descartadas.
   * @throws {Error} `ERRO_ARQUIVO_DE_APOIO` em qualquer falha de criacao de
   *   diretorio ou de escrita.
   */
  public async ensure(
    entrada: EnsureExecutorConfigInput
  ): Promise<EnsureExecutorConfigResult> {
    const { config, avisos } = montarExecutorConfig(entrada);
    const destino = this.caminhoDe(entrada.runId, entrada.pid);
    const temporario = this.temporarioDe(entrada.runId, entrada.pid);

    try {
      await fs.ensureDir(this.dir);
      await fs.writeFile(temporario, JSON.stringify(config, null, 2), 'utf-8');
      await fs.rename(temporario, destino);
    } catch {
      await fs.remove(temporario).catch(() => undefined);
      throw new Error(ERRO_ARQUIVO_DE_APOIO);
    }

    this.caminhoAtual = destino;
    return { caminho: destino, avisos };
  }

  /**
   * Remove o arquivo deste lote em melhor esforco. Falha de remocao e
   * silenciosa: um resto no diretorio do usuario nao justifica derrubar o
   * encerramento do lote, e `limparRestos` o recolhe depois.
   */
  public async remover(): Promise<void> {
    const alvo = this.caminhoAtual;

    if (alvo === null) {
      return;
    }

    this.caminhoAtual = null;
    await fs.remove(alvo).catch(() => undefined);
  }

  /**
   * Remove, em melhor esforco, todo `executor-*.json` do diretorio com `mtime`
   * anterior a 24 horas. Recolhe os restos deixados por lotes mortos sem tocar
   * nos arquivos de lotes simultaneos, que sao sempre recentes.
   *
   * @param agora Instante de referencia em milissegundos. Default: `Date.now()`.
   */
  public async limparRestos(agora: number = Date.now()): Promise<void> {
    let entradas: string[];

    try {
      entradas = await fs.readdir(this.dir);
    } catch {
      return;
    }

    for (const entrada of entradas) {
      if (!entrada.startsWith('executor-') || !entrada.endsWith('.json')) {
        continue;
      }

      const arquivo = path.join(this.dir, entrada);

      try {
        const info = await fs.stat(arquivo);

        if (agora - info.mtimeMs > IDADE_MAXIMA_MS) {
          await fs.remove(arquivo);
        }
      } catch {
        continue;
      }
    }
  }
}
