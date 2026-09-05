import path from 'node:path';
import fs from 'fs-extra';
import type {
  BuildContextPackArgsInput,
  TaskResult,
  ToolCapabilities,
} from '../types/tool-adapter.js';
import type {
  EffortLevel,
  OrigemHorario,
  PackResult,
  Relogio,
} from '../types/executar-tasks.js';
import type { StatusKind } from './terminal/index.js';
import type { AccountingService } from './accounting.js';
import type { RunLoggerService } from './run-logger.js';
import type { EntradaDeEspera, ResultadoDeEspera } from './espera-limite.js';
import { relogioDoSistema } from './espera-limite.js';
import { determinarRenovacao } from './renovacao-de-cota.js';
import { formatarDuracao, formatarMilhar } from './formatos.js';
import { CONTEXT_PACK_PROMPT, CONTEXT_PACK_TEMPLATE } from './context-pack-prompt.js';

const NOME_DESTILADO = 'contexto-execucao.md';

/**
 * Subconjunto do adapter da ferramenta (task-5) consumido aqui. `runPack` ja
 * normaliza a resposta como `parseResult` (CT-020); esta task nao reimplementa
 * `buildContextPackArgs`, `runPack` nem `parseResult`.
 */
export interface ContextPackToolAdapter {
  readonly capacidades: ToolCapabilities;

  runPack(
    prompt: string,
    entrada: BuildContextPackArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult>;

  /** Mesmo criterio de CT-044 usado pelo loop de tasks. */
  detectRateLimit(rawOutput: string): boolean;
}

/**
 * Politica de espera do lote consumida aqui (CT-048). A instancia e a MESMA
 * injetada no `TaskRunner`: e isso que faz o teto de `--max-wait` valer para o
 * lote inteiro, somando as esperas das tasks e as da construcao (RF-016, RF-021).
 */
export interface EsperaDeLimiteDeUso {
  aguardar(entrada: EntradaDeEspera): Promise<ResultadoDeEspera>;
}

/**
 * Opcoes de `executar-tasks` que afetam o Contexto de Execucao (CT-021).
 *
 * RF-012: `model` e `effort` sao os do lote - nao existe mais par proprio do
 * destilado. Apenas o teto de tamanho permanece como opcao propria.
 */
export interface ContextPackOpcoes {
  contextPack: boolean;
  model: string;
  effort: EffortLevel;
  packMaxTokens: number;
  cacheTuning: boolean;
}

export interface ContextPackContexto {
  featureDir: string;
  projectRoot: string;
  cwd: string;
  opcoes: ContextPackOpcoes;
  /**
   * Canal unico de mensagens de estado (RF-003, CT-046). O servico publica
   * `(kind, texto)` SEM rotulo embutido: quem monta o rotulo, encerra o
   * indicador de progresso e escreve a linha e a camada de apresentacao. O
   * `stderr` do processo filho nao passa por aqui: vai direto para
   * `RunLoggerService.appendStderr` (CT-012).
   */
  onMensagem?: (kind: StatusKind, texto: string) => void;
}

interface DecisaoDeriva {
  reconstruir: boolean;
  motivo: string;
  fonteAlterada: string | null;
}

/**
 * Mecanismo do Contexto de Execucao (passo 7 da techspec): decide reaproveitar ou
 * reconstruir o destilado da feature, invoca o adapter para construi-lo, mede o
 * teto de tamanho e comunica cada desvio.
 *
 * Implementa CT-013 (regra de deriva e desligamento), CT-021 (tres condicoes de
 * sucesso, formula de estimativa, placeholders) e os eventos `pack_reused`,
 * `pack_build` e `pack_build_failed` de CT-011. Nenhuma falha deste servico e
 * bloqueante: o lote nunca e abortado por causa do Contexto de Execucao (RF-007).
 */
export class ContextPackService {
  private jaTentouConstruir = false;
  private ultimoResultado: PackResult | null = null;
  private abortSolicitado = false;
  private readonly cancelamento = new AbortController();

  /**
   * @param espera Instancia unica da politica de espera do lote (CT-048).
   *   `null` desliga a espera na construcao: a falha por limite de uso segue o
   *   caminho de falha vigente, sem reexecucao.
   * @param relogio Porta de tempo (CT-048), substituida nos testes.
   */
  constructor(
    private readonly adapter: ContextPackToolAdapter,
    private readonly accounting: AccountingService,
    private readonly logger: RunLoggerService,
    private readonly espera: EsperaDeLimiteDeUso | null = null,
    private readonly relogio: Relogio = relogioDoSistema
  ) {}

  /**
   * Regra de deriva de CT-013. Reconstroi quando o destilado nao existe ou quando
   * o `mtimeMs` de qualquer fonte existente e maior que o dele. A primeira fonte
   * mais recente, na ordem de precedencia, determina o resultado. Fonte ausente e
   * ignorada, sem erro.
   */
  public async precisaReconstruir(
    featureDir: string,
    projectRoot: string
  ): Promise<DecisaoDeriva> {
    const destilado = path.join(featureDir, NOME_DESTILADO);

    if (!(await fs.pathExists(destilado))) {
      return { reconstruir: true, motivo: 'inexistente', fonteAlterada: null };
    }

    const destiladoMtime = (await fs.stat(destilado)).mtimeMs;
    const fontes = [
      path.join(featureDir, 'techspec.md'),
      path.join(featureDir, 'prd.md'),
      path.join(projectRoot, 'specs', 'core', 'architecture.md'),
    ];

    for (const fonte of fontes) {
      if (!(await fs.pathExists(fonte))) {
        continue;
      }

      if ((await fs.stat(fonte)).mtimeMs > destiladoMtime) {
        return { reconstruir: true, motivo: 'fonte_mais_recente', fonteAlterada: fonte };
      }
    }

    return { reconstruir: false, motivo: 'em_dia', fonteAlterada: null };
  }

  /**
   * Fluxo completo do passo 7. `--no-context-pack` devolve `desligado` sem tocar a
   * CLI nem gravar evento. A construcao ocorre no maximo uma vez por execucao: so
   * uma deriva nova (`fonte_mais_recente`) admite uma segunda construcao.
   */
  public async ensure(contexto: ContextPackContexto): Promise<PackResult> {
    const { featureDir, projectRoot, opcoes } = contexto;

    if (!opcoes.contextPack) {
      return this.resultadoSimples('desligado', 'desligado');
    }

    if (this.abortSolicitado) {
      return this.resultadoSimples('falhou', 'interrompido');
    }

    const deriva = await this.precisaReconstruir(featureDir, projectRoot);
    const destilado = path.join(featureDir, NOME_DESTILADO);

    if (!deriva.reconstruir) {
      return this.reaproveitar(contexto, destilado);
    }

    const derivaNova = deriva.motivo === 'fonte_mais_recente';
    if (this.jaTentouConstruir && !derivaNova) {
      return (
        this.ultimoResultado ?? this.resultadoSimples('falhou', 'ja_tentado', deriva.fonteAlterada)
      );
    }

    return this.construir(contexto, deriva, destilado);
  }

  /**
   * Caminho a passar em `--append-system-prompt-file` (CT-020). `null` em falha e
   * em desligado, garantindo que o argv da task nunca recebe caminho inexistente.
   */
  public caminhoParaInjecao(resultado: PackResult): string | null {
    if (resultado.decisao === 'reaproveitado' || resultado.decisao === 'construido') {
      return resultado.caminho;
    }

    return null;
  }

  /**
   * Interrupcao (caso extremo 33). Marca o pedido de aborto e cancela a
   * construcao em andamento: o `AbortSignal` mata o filho por SIGTERM/SIGKILL.
   * Nao dependemos do grupo de processo POSIX, que nao existe no Windows
   * (RNF-007). A restauracao do cursor, o evento `interrompido` e o codigo de
   * saida sao da task-10.
   */
  public abort(): void {
    this.abortSolicitado = true;
    this.cancelamento.abort();
  }

  private async reaproveitar(
    contexto: ContextPackContexto,
    destilado: string
  ): Promise<PackResult> {
    const bytes = (await fs.stat(destilado)).size;
    const estTokens = Math.floor((bytes * 10) / 35);

    await this.logger.logEvent({ event: 'pack_reused', ts: '', arquivo: destilado });
    this.emitir(
      contexto,
      'info',
      'Contexto de Execucao em dia - reaproveitando o destilado existente'
    );

    return {
      decisao: 'reaproveitado',
      caminho: path.resolve(destilado),
      bytes,
      estTokens,
      acimaDoTeto: false,
      motivo: 'em_dia',
      fonteAlterada: null,
      tokensGastos: 0,
    };
  }

  /**
   * Passo 3 da secao 5.1: constroi o destilado com o modelo e o esforco DO LOTE
   * (RF-012), refaz a construcao apos uma espera bem-sucedida por limite de uso
   * (RF-021) e publica o desfecho pelo canal unico (RF-003).
   */
  private async construir(
    contexto: ContextPackContexto,
    deriva: DecisaoDeriva,
    destilado: string
  ): Promise<PackResult> {
    const { featureDir, cwd, opcoes } = contexto;

    const prompt = CONTEXT_PACK_PROMPT.split('{{FEATURE_DIR}}')
      .join(featureDir)
      .split('{{TEMPLATE_PATH}}')
      .join(CONTEXT_PACK_TEMPLATE);

    // RF-012: o par vem do lote. Os NOMES de campo de `BuildContextPackArgsInput`
    // sao preservados (CT-020/CT-021): muda a origem do valor, nao o contrato.
    const entrada: BuildContextPackArgsInput = {
      featureDir,
      packModel: opcoes.model,
      packEffort: opcoes.effort,
      cacheTuning: opcoes.cacheTuning,
    };

    let tentativa = 1;
    let resultado: TaskResult;
    let duracaoSegundos: number;

    for (;;) {
      const inicio = this.relogio.agora();

      resultado = await this.adapter.runPack(
        prompt,
        entrada,
        cwd,
        (chunk) => this.logger.appendStderr(chunk),
        this.cancelamento.signal
      );

      duracaoSegundos = Math.max(0, Math.round((this.relogio.agora() - inicio) / 1000));

      const barrada = await this.tratarLimiteDeUso(contexto, resultado, tentativa);

      if (barrada === null) {
        break;
      }

      if (barrada.desistiu) {
        this.jaTentouConstruir = true;
        // RF-021: o lote nao prossegue sem o destilado nem reaproveita destilado
        // desatualizado. Quem encerra com codigo 1 e o comando.
        this.ultimoResultado = {
          decisao: 'falhou',
          caminho: null,
          bytes: 0,
          estTokens: 0,
          acimaDoTeto: false,
          motivo: 'limite_de_uso',
          fonteAlterada: deriva.fonteAlterada,
          tokensGastos: barrada.tokensGastos,
        };
        return this.ultimoResultado;
      }

      tentativa += 1;
    }

    const arquivoExiste = await fs.pathExists(destilado);
    const { tokensDaTask, custoDaTask } = this.accounting.accumulate(resultado);
    this.jaTentouConstruir = true;

    const sucesso = resultado.exitCode === 0 && !resultado.isError && arquivoExiste;

    if (!sucesso) {
      this.emitir(
        contexto,
        'aviso',
        'falha ao construir o Contexto de Execucao - seguindo sem ele'
      );

      const motivo = !arquivoExiste
        ? 'arquivo_nao_gerado'
        : resultado.isError
          ? 'is_error'
          : 'exit_code';

      await this.logger.logEvent({
        event: 'pack_build_failed',
        ts: '',
        motivo,
        subtype: resultado.subtype,
        exit_code: resultado.exitCode,
        tokens_gastos: tokensDaTask,
      });

      this.ultimoResultado = {
        decisao: 'falhou',
        caminho: null,
        bytes: 0,
        estTokens: 0,
        acimaDoTeto: false,
        motivo,
        fonteAlterada: deriva.fonteAlterada,
        tokensGastos: tokensDaTask,
      };
      return this.ultimoResultado;
    }

    const bytes = (await fs.stat(destilado)).size;
    const estTokens = Math.floor((bytes * 10) / 35);
    const teto = opcoes.packMaxTokens;
    const acimaDoTeto = teto > 0 && estTokens > teto;

    if (acimaDoTeto) {
      this.emitir(
        contexto,
        'aviso',
        `Contexto de Execucao acima do teto: ~${estTokens} > ${teto} tokens. O excedente sera pago em cada task.`
      );
    }

    const { reportado, divergente, temRelato } = this.avaliarModeloEfetivo(
      opcoes.model,
      resultado.modelosReportados
    );

    // RF-013: o aviso sai se e somente se a ferramenta DECLARA a capacidade de
    // relatar o modelo efetivo. Sem a declaracao, o valor reportado e o eco do
    // pedido, e a divergencia aparente nao significa nada.
    if (temRelato && divergente) {
      this.emitir(
        contexto,
        'aviso',
        `Contexto de Execucao construido em ${reportado}, e não em ${opcoes.model}`
      );
    }

    await this.logger.logEvent({
      event: 'pack_build',
      ts: '',
      motivo: deriva.motivo,
      fonte_alterada: deriva.fonteAlterada,
      arquivo: destilado,
      session_id: resultado.sessionId,
      pack_model: opcoes.model,
      pack_effort: opcoes.effort,
      // CT-047: gravado SEMPRE, com o valor devolvido pela ferramenta. A
      // capacidade governa apenas o aviso; omitir o campo apagaria a informacao
      // de que a ferramenta ecoou o pedido.
      pack_model_efetivo: resultado.modelosReportados,
      pack_model_divergente: divergente,
      duracao_segundos: duracaoSegundos,
      num_turns: resultado.numTurns,
      bytes_pack: bytes,
      est_tokens_pack: estTokens,
      pack_max_tokens: teto,
      pack_over_ceiling: acimaDoTeto,
      input_tokens: resultado.inputTokens,
      output_tokens: resultado.outputTokens,
      cache_creation_input_tokens: resultado.cacheCreationInputTokens,
      cache_read_input_tokens: resultado.cacheReadInputTokens,
      tokens_gastos: tokensDaTask,
      tokens_gastos_acumulado_depois: this.accounting.total.tokensGastosAcumulado,
      custo_usd: this.accounting.formatCustoRegistro(custoDaTask),
    });

    // RF-013: sem relato confiavel a linha apresenta o modelo SOLICITADO e o
    // identifica como tal - nunca o apresenta como efetivo.
    const modeloExibido = temRelato ? reportado : `${opcoes.model} (solicitado)`;
    this.emitir(
      contexto,
      'ok',
      `Contexto de Execucao construido em ${modeloExibido} - ${formatarMilhar(bytes)} bytes - ${formatarDuracao(duracaoSegundos)}`
    );

    this.ultimoResultado = {
      decisao: 'construido',
      caminho: path.resolve(destilado),
      bytes,
      estTokens,
      acimaDoTeto,
      motivo: deriva.motivo,
      fonteAlterada: deriva.fonteAlterada,
      tokensGastos: tokensDaTask,
    };
    return this.ultimoResultado;
  }

  /**
   * Passo 3a da secao 5.1. Aplica o MESMO criterio de CT-044 usado pelo loop de
   * tasks: o conteudo do fluxo de erro nao classifica a execucao como falha.
   *
   * @returns `null` quando nao ha limite de uso a tratar - o chamador segue o
   *   caminho normal. Caso contrario, se a espera desistiu ou se a construcao
   *   deve ser refeita.
   */
  private async tratarLimiteDeUso(
    contexto: ContextPackContexto,
    resultado: TaskResult,
    tentativa: number
  ): Promise<{ desistiu: boolean; tokensGastos: number } | null> {
    if (this.espera === null) {
      return null;
    }

    const falhou = resultado.isError || resultado.exitCode !== 0;
    if (!falhou) {
      return null;
    }

    const textoBruto = `${resultado.rawStdout}\n${resultado.rawStderr}`;
    if (!this.adapter.detectRateLimit(textoBruto)) {
      return null;
    }

    // RF-017: os tokens da tentativa barrada SAO contabilizados - foram gastos
    // de fato -, mas a tentativa nao produz `pack_build` nem `pack_build_failed`.
    const { tokensDaTask } = this.accounting.accumulate(resultado);
    const renovacao = determinarRenovacao(textoBruto, this.relogio.agora());
    const origem: OrigemHorario = renovacao === null ? 'sondagem' : 'informado';

    await this.logger.logEvent({
      event: 'rate_limited',
      ts: '',
      task: NOME_DESTILADO,
      tentativa,
      renovacao_prevista: renovacao === null ? null : renovacao.toISOString(),
      origem_horario: origem,
      contexto: 'context_pack',
    });

    const decisao = await this.espera.aguardar({
      textoBruto,
      contexto: 'context_pack',
      task: null,
      posicao: 0,
      total: 0,
      tentativa,
      signal: this.cancelamento.signal,
    });

    if (decisao.retomar && !this.abortSolicitado) {
      return { desistiu: false, tokensGastos: tokensDaTask };
    }

    this.emitir(
      contexto,
      'aviso',
      `${decisao.motivoDaDesistencia ?? 'limite de uso'} - encerrando o lote`
    );
    return { desistiu: true, tokensGastos: tokensDaTask };
  }

  /**
   * Regra de divergencia de CT-045, literal:
   * `divergente = !reportado.toLowerCase().includes(solicitado.toLowerCase())`.
   * O relato vem como identificador completo (`claude-opus-4-6`) e a solicitacao
   * como apelido (`opus`); comparacao por igualdade produziria aviso em todo
   * lote correto.
   *
   * Relato vazio nao e relato: `temRelato` cai para `false`, o que leva a linha
   * de conclusao a apresentar o modelo solicitado (RF-013) e suprime a
   * divergencia. A gravacao de `pack_model_efetivo` nao passa por aqui.
   */
  private avaliarModeloEfetivo(
    solicitado: string,
    reportado: string
  ): { reportado: string; divergente: boolean; temRelato: boolean } {
    const temRelato = this.adapter.capacidades.relatoDeModeloEfetivo && reportado !== '';
    const divergente =
      reportado === ''
        ? false
        : !reportado.toLowerCase().includes(solicitado.toLowerCase());

    return { reportado, divergente, temRelato };
  }

  private resultadoSimples(
    decisao: PackResult['decisao'],
    motivo: string,
    fonteAlterada: string | null = null
  ): PackResult {
    return {
      decisao,
      caminho: null,
      bytes: 0,
      estTokens: 0,
      acimaDoTeto: false,
      motivo,
      fonteAlterada,
      tokensGastos: 0,
    };
  }

  /**
   * Canal unico de RF-003: publica `(kind, texto)` sem rotulo embutido. Sem
   * assinante, nada e escrito - este servico nunca escreve direto no fluxo de
   * saida, porque a escrita direta sobrescreve o indicador de progresso em vez
   * de substitui-lo.
   */
  private emitir(contexto: ContextPackContexto, kind: StatusKind, texto: string): void {
    contexto.onMensagem?.(kind, texto);
  }
}
