import type { ToolSlug } from '../types/config.js';
import type { ContextInjection } from '../types/executar-tasks.js';
import type { ToolAdapter } from '../types/tool-adapter.js';
import { OpenCodeExecutorConfigService } from './opencode-executor-config.js';
import type { RunnerExecutorConfig } from './task-runner.js';
import { getAdapter } from './tool-adapters/tool-registry.js';

export interface MontarAdapterInput {
  ferramenta: ToolSlug;
  home: string;
  /** Canal dos avisos nominais do adapter (RF-007, RF-009). */
  onAviso: (mensagem: string) => void;
  /** Seam de teste: permite trocar a criacao do servico sem tocar no home real. */
  criarConfigService?: (home: string) => OpenCodeExecutorConfigService;
}

export interface AdapterMontado {
  adapter: ToolAdapter;
  /**
   * Instancia **unica** do ciclo de vida do arquivo de apoio; `null` em toda
   * ferramenta que nao seja o OpenCode.
   */
  servico: OpenCodeExecutorConfigService | null;
}

/**
 * Fase 1 da fiacao: constroi o adapter da ferramenta com as dependencias que so
 * a execucao real conhece.
 *
 * A garantia central e a instancia **unica** de `OpenCodeExecutorConfigService`:
 * a mesma que grava o arquivo de apoio e a que o adapter consulta em `buildEnv`
 * para exportar `OPENCODE_CONFIG` (ENV-002). Duas instancias fariam a variavel
 * nunca ser escrita, e o filho rodaria sem o agente `specifica-executor`
 * (RF-007) e sem a chave `instructions` (CT-030).
 *
 * Roda antes de `ajustarPorCapacidades`, que precisa das capacidades do adapter
 * para produzir as opcoes efetivas consumidas na fase 2.
 *
 * @throws {Error} A recusa nominal de RF-019 para ferramenta sem contrato validado.
 */
export function montarAdapter(entrada: MontarAdapterInput): AdapterMontado {
  const { ferramenta, home, onAviso } = entrada;

  if (ferramenta !== 'opencode') {
    return { adapter: getAdapter(ferramenta, { onAviso }), servico: null };
  }

  const criar =
    entrada.criarConfigService ?? ((dir: string) => new OpenCodeExecutorConfigService(dir));
  const servico = criar(home);

  return {
    adapter: getAdapter(ferramenta, { configService: servico, onAviso }),
    servico,
  };
}

/** O subconjunto das opcoes efetivas de que a gravacao depende. */
export interface ArquivoDeApoioOpcoes {
  contextInjection: ContextInjection;
  allow: string[];
}

export interface ArquivoDeApoioPreparado {
  /** `null` em toda ferramenta que nao seja o OpenCode. */
  executorConfig: RunnerExecutorConfig | null;
  /** Avisos das regras de `--allow` que a traducao descartou. */
  avisosDoAllow: string[];
}

/**
 * Fase 2 da fiacao: recolhe os restos de lotes mortos, grava o arquivo de apoio
 * deste lote (CT-035) e devolve o ciclo de vida que o runner usa para regravar e
 * remover.
 *
 * Acontece antes do preflight, que e quem verifica a presenca e a legibilidade
 * do arquivo.
 *
 * @throws {Error} `ERRO_ARQUIVO_DE_APOIO` quando a gravacao falha; quem converte
 *   em aborto nominal e o comando.
 */
export async function prepararArquivoDeApoio(
  servico: OpenCodeExecutorConfigService | null,
  entrada: { runId: string; pid: number; opcoes: ArquivoDeApoioOpcoes }
): Promise<ArquivoDeApoioPreparado> {
  if (servico === null) {
    return { executorConfig: null, avisosDoAllow: [] };
  }

  const { runId, pid, opcoes } = entrada;
  await servico.limparRestos();

  // O destilado ainda nao existe neste ponto: a chave `instructions` entra na
  // regravacao do passo 11, quando o caminho e conhecido (CT-030, CT-035).
  const gravar = (destiladoPath: string | null): Promise<unknown> =>
    servico.ensure({
      runId,
      pid,
      formaDeInjecao: opcoes.contextInjection,
      destiladoPath,
      allow: opcoes.allow,
    });

  const gravado = await servico.ensure({
    runId,
    pid,
    formaDeInjecao: opcoes.contextInjection,
    destiladoPath: null,
    allow: opcoes.allow,
  });

  return {
    executorConfig: {
      aplicarDestilado: async (destiladoPath) => {
        await gravar(destiladoPath);
      },
      remover: () => servico.remover(),
    },
    avisosDoAllow: gravado.avisos,
  };
}
