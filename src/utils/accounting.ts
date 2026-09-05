import type { RunAccounting } from '../types/executar-tasks.js';
import type { TaskResult } from '../types/tool-adapter.js';
import { formatarMilhar } from './formatos.js';

/**
 * Acumula os quatro contadores de token e o custo da execucao e formata numeros
 * em pt-BR. Implementa RF-008.
 *
 * Consome o `TaskResult` ja normalizado pela task-5: a regra `modelUsage` sobre
 * `usage` nao e reimplementada aqui.
 */
class AccountingService {
  private raciocinioReportadoAlgumaVez = false;

  /**
   * Marco a partir do qual a janela de execucao e medida (RF-019). Comeca em
   * `0` e passa a valer o acumulado corrente a cada renovacao da cota. E estado
   * interno: nenhum chamador o escreve, e a leitura sai por `tokensDaJanela`.
   */
  private linhaDeBaseDaJanela = 0;

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
    return formatarMilhar(inteiro);
  }

  /**
   * Tokens gastos desde a ultima renovacao da janela (RF-019). E a unica base
   * valida para a trava de janela e para os campos `tokens_disponiveis_*`: o
   * acumulado bruto continua descrevendo o lote inteiro e alimenta o resumo.
   */
  public get tokensDaJanela(): number {
    return this.acumulado.tokensGastosAcumulado - this.linhaDeBaseDaJanela;
  }

  /**
   * Zera a medicao da janela de execucao, acompanhando a renovacao da cota do
   * provedor (RF-019). Chamado apenas na retomada apos uma espera bem-sucedida.
   *
   * Os totais de tokens, custo e tempo do resumo e do `run_end` NAO sao
   * afetados: continuam somando o lote inteiro (Nota de Decisao D7).
   */
  public renovarJanelaDeExecucao(): void {
    this.linhaDeBaseDaJanela = this.acumulado.tokensGastosAcumulado;
  }

  /**
   * Indica se a janela de orcamento ja foi alcancada. Consultado ANTES de iniciar
   * a proxima task, nunca no meio dela (RF-008). O servico nao interrompe nada.
   *
   * A comparacao e feita contra a linha de base da janela, e nao contra o
   * acumulado bruto (RF-019).
   *
   * @param windowBudgetTokens Teto da janela; `0` desliga a trava.
   */
  public excederiaJanela(windowBudgetTokens: number): boolean {
    return windowBudgetTokens > 0 && this.tokensDaJanela >= windowBudgetTokens;
  }
}

export { AccountingService };
