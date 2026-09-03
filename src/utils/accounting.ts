import type { RunAccounting } from '../types/executar-tasks.js';
import type { TaskResult } from '../types/tool-adapter.js';

const FORMATADOR_MILHAR = new Intl.NumberFormat('pt-BR');

/**
 * Acumula os quatro contadores de token e o custo da execucao e formata numeros
 * em pt-BR. Implementa RF-008.
 *
 * Consome o `TaskResult` ja normalizado pela task-5: a regra `modelUsage` sobre
 * `usage` nao e reimplementada aqui.
 */
class AccountingService {
  private raciocinioReportadoAlgumaVez = false;

  private readonly acumulado: RunAccounting = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    reasoningTokens: 0,
    tokensGastosAcumulado: 0,
    custoAcumuladoUsd: 0,
  };

  /**
   * Soma os contadores de uma task ao acumulado da execucao.
   *
   * @param resultado Resultado normalizado da task.
   * @returns Tokens e custo isolados desta task.
   */
  public accumulate(resultado: TaskResult): { tokensDaTask: number; custoDaTask: number } {
    const tokensDaTask =
      resultado.inputTokens +
      resultado.outputTokens +
      resultado.cacheCreationInputTokens +
      resultado.cacheReadInputTokens +
      (resultado.reasoningTokens ?? 0);

    if (resultado.reasoningTokens !== null) {
      this.raciocinioReportadoAlgumaVez = true;
    }

    this.acumulado.inputTokens += resultado.inputTokens;
    this.acumulado.outputTokens += resultado.outputTokens;
    this.acumulado.cacheCreationInputTokens += resultado.cacheCreationInputTokens;
    this.acumulado.cacheReadInputTokens += resultado.cacheReadInputTokens;
    this.acumulado.reasoningTokens += resultado.reasoningTokens ?? 0;
    this.acumulado.tokensGastosAcumulado += tokensDaTask;
    this.acumulado.custoAcumuladoUsd += resultado.costUsd;

    return { tokensDaTask, custoDaTask: resultado.costUsd };
  }

  /**
   * Verdadeiro quando ao menos uma task reportou tokens de raciocinio. Distingue
   * "nao reportado" de "zero" na exibicao do resumo (RF-004): `null` em todas as
   * tasks nunca vira `0` na tela.
   */
  public get raciocinioReportado(): boolean {
    return this.raciocinioReportadoAlgumaVez;
  }

  /**
   * Verdadeiro quando houve consumo de tokens e nenhum custo foi reportado
   * (RF-008). Provedor por assinatura reporta `cost: 0` em todos os passos, e o
   * teto de custo nunca poderia disparar - o encerramento avisa uma unica vez.
   */
  public get custoZeroNaoReportado(): boolean {
    return this.acumulado.tokensGastosAcumulado > 0 && this.acumulado.custoAcumuladoUsd === 0;
  }

  /** Copia defensiva do acumulado da execucao. */
  public get total(): RunAccounting {
    return { ...this.acumulado };
  }

  /** Custo para exibicao na tela: quatro casas decimais, como o script de origem. */
  public formatCustoExibicao(valor: number): string {
    return valor.toFixed(4);
  }

  /** Custo para o registro JSONL: seis casas decimais, como o script de origem. */
  public formatCustoRegistro(valor: number): string {
    return valor.toFixed(6);
  }

  /**
   * Formata um inteiro com a separacao de milhar pt-BR, substituindo
   * `printf "%'d"` e a funcao `milhar` em jq (secao 5.1).
   */
  public formatMilhar(inteiro: number): string {
    return FORMATADOR_MILHAR.format(inteiro);
  }

  /**
   * Indica se a janela de orcamento ja foi alcancada. Consultado ANTES de iniciar
   * a proxima task, nunca no meio dela (RF-008). O servico nao interrompe nada.
   *
   * @param windowBudgetTokens Teto da janela; `0` desliga a trava.
   */
  public excederiaJanela(windowBudgetTokens: number): boolean {
    return windowBudgetTokens > 0 && this.acumulado.tokensGastosAcumulado >= windowBudgetTokens;
  }
}

export { AccountingService };
