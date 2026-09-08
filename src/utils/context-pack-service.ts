import path from 'node:path';
import fs from 'fs-extra';
import type {
  BuildContextPackArgsInput,
  TaskResult,
  ToolCapabilities,
} from '../types/tool-adapter.js';
import type {
  EffortLevel,
  EtapaInfo,
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

/** Rotulo da etapa longa publicado a apresentacao (RF-029). */
const ROTULO_ETAPA = 'Construindo o Contexto de Execucao';

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
    signal?: AbortSignal,
    timeoutMs?: number
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
  /**
   * Teto de tempo da construcao, em segundos (`--pack-timeout`). `0` desliga o
   * teto. Sem ele, um filho travado nunca e morto: nao ha feedback, nao ha
   * limite, e o unico recurso do usuario e o `Ctrl+C`.
   */
  packTimeoutSegundos: number;
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
  /**
   * Par de etapa longa (RF-029). Separado de `onMensagem` de proposito: uma
   * mensagem substitui o indicador; uma etapa o LIGA e so o encerra no
   * desfecho. Sem estes dois canais, a construcao do destilado nao produz byte
   * algum na tela enquanto roda.
   */
  onEtapaInicio?: (info: EtapaInfo) => void;
  onEtapaFim?: (kind: StatusKind, texto: string) => void;
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
  private avisouArchitectureAusente = false;
  private duracaoNaoContabilizada = 0;
  private readonly cancelamento = new AbortController();

  /**
   * Duracao, em segundos, das tentativas de construcao mortas por SIGTERM
   * (interrupcao ou teto de tempo). O consumo delas e real e nunca chega a
   * contabilidade: matar o filho zera o JSON final de onde vem cada numero.
   * O resumo usa este valor para nao afirmar custo zero em um lote que custou.
   */
  public get consumoNaoContabilizadoSegundos(): number {
    return this.duracaoNaoContabilizada;
  }

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
      return this.resultadoSimples('interrompido', 'interrompido');
    }

    await this.avisarArchitectureAusente(contexto);

    const deriva = await this.precisaReconstruir(featureDir, projectRoot);
    const destilado = path.join(featureDir, NOME_DESTILADO);

    if (!deriva.reconstruir) {
      return this.reaproveitar(contexto, destilado);
    }

    const derivaNova = deriva.motivo === 'fonte_mais_recente';
    if (this.jaTentouConstruir && !derivaNova) {
      // A falha ja aconteceu e o resultado em cache e devolvido de novo. O
      // desfecho volta a ser anunciado: uma falha silenciosa por task e pior
      // que uma repetida - sem esta linha, o usuario ve a primeira mensagem e
      // depois nada, e conclui que o destilado passou a ser usado.
      const cache = this.ultimoResultado;
      if (cache && cache.decisao !== 'construido' && cache.decisao !== 'reaproveitado') {
        this.emitir(
          contexto,
          'aviso',
          'seguindo sem o Contexto de Execucao - a construcao ja falhou nesta execucao e nao sera repetida'
        );
      }
      return (
        cache ?? this.resultadoSimples('falhou', 'ja_tentado', deriva.fonteAlterada)
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
      duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
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

    const tetoMs =
      opcoes.packTimeoutSegundos > 0 ? opcoes.packTimeoutSegundos * 1000 : 0;

    let tentativa = 1;
    let resultado: TaskResult;
    let duracaoSegundos: number;

    for (;;) {
      const inicio = this.relogio.agora();

      // RF-029: a linha de inicio sai ANTES da invocacao. Depois dela o
      // processo filho pode passar minutos sem escrever byte algum - com
      // `--output-format json` o stdout so existe quando o processo fecha -, e
      // e exatamente esse silencio que faz o usuario matar uma construcao que
      // estava funcionando.
      this.iniciarEtapa(contexto);

      resultado = await this.adapter.runPack(
        prompt,
        entrada,
        cwd,
        (chunk) => this.logger.appendStderr(chunk),
        this.cancelamento.signal,
        tetoMs
      );

      duracaoSegundos = Math.max(0, Math.round((this.relogio.agora() - inicio) / 1000));

      // O filho morto por SIGTERM nao tem desfecho a avaliar: sem esta guarda,
      // ele cairia no caminho normal e viraria `arquivo_nao_gerado`, afirmando
      // "o arquivo nao foi gerado" onde o correto e "o usuario interrompeu".
      const morto = await this.tratarMorteDoFilho(
        contexto,
        deriva,
        resultado,
        duracaoSegundos
      );
      if (morto) {
        return morto;
      }

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
          duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
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
      this.encerrarEtapa(
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
        duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
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
      // CT-051: a negacao de permissao na construcao deixa de existir so no
      // `.stderr`.
      permission_denials: resultado.permissionDenials,
      ferramentas_negadas: resultado.ferramentasNegadas,
    });

    // CT-051: a construcao roda com `--permission-mode acceptEdits` e `stdin`
    // fechado. Uma ferramenta nao-edicao de que o prompt precise e negada em
    // silencio, e o destilado sai mais pobre sem que nada diga por que.
    if ((resultado.permissionDenials ?? 0) > 0) {
      this.emitir(
        contexto,
        'aviso',
        `a construcao do Contexto de Execucao teve ${resultado.permissionDenials} permissao(oes) negada(s)${
          resultado.ferramentasNegadas ? ` (${resultado.ferramentasNegadas})` : ''
        } - o destilado pode estar incompleto`
      );
    }

    // RF-013: sem relato confiavel a linha apresenta o modelo SOLICITADO e o
    // identifica como tal - nunca o apresenta como efetivo.
    const modeloExibido = temRelato ? reportado : `${opcoes.model} (solicitado)`;
    this.encerrarEtapa(
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
      duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
    };
    return this.ultimoResultado;
  }

  /**
   * Interrupcao e teto de tempo (CT-050). Um filho morto por SIGTERM sai sem
   * JSON: `exitCode: 0` com stdout vazio no caso do `claude`, que trata o sinal.
   * Avaliar esse desfecho pelo caminho normal produz `pack_build_failed /
   * arquivo_nao_gerado` - uma afirmacao falsa sobre um processo que foi morto -
   * e um aviso de falha na tela logo depois do `Ctrl+C`.
   *
   * O consumo da tentativa e real e nao esta em lugar nenhum: todo numero vem do
   * JSON final. O que se registra e a DURACAO, para que o resumo nao afirme
   * custo zero.
   *
   * @returns O `PackResult` de encerramento, ou `null` quando o filho terminou
   *   normalmente e a avaliacao deve seguir.
   */
  private async tratarMorteDoFilho(
    contexto: ContextPackContexto,
    deriva: DecisaoDeriva,
    resultado: TaskResult,
    duracaoSegundos: number
  ): Promise<PackResult | null> {
    const interrompido = this.abortSolicitado || resultado.aborted === true;
    const estourouTeto = resultado.timedOut === true;

    if (!interrompido && !estourouTeto) {
      return null;
    }

    this.jaTentouConstruir = true;
    this.duracaoNaoContabilizada += duracaoSegundos;

    await this.logger.logEvent({
      event: 'pack_build_interrompido',
      ts: '',
      motivo: interrompido ? 'interrompido_pelo_usuario' : 'timeout',
      duracao_segundos: duracaoSegundos,
      consumo_nao_contabilizado: true,
    });

    // Depois de um `Ctrl+C` o aviso de falha seria enganoso: a construcao nao
    // falhou, foi morta. O teto de tempo, esse, precisa ser dito - e nominal.
    this.encerrarEtapa(
      contexto,
      'aviso',
      interrompido
        ? `construcao do Contexto de Execucao interrompida apos ${formatarDuracao(duracaoSegundos)}`
        : `teto de tempo da construcao do Contexto de Execucao esgotado apos ${formatarDuracao(duracaoSegundos)} - seguindo sem ele`
    );

    this.ultimoResultado = {
      decisao: interrompido ? 'interrompido' : 'falhou',
      caminho: null,
      bytes: 0,
      estTokens: 0,
      acimaDoTeto: false,
      motivo: interrompido ? 'interrompido' : 'timeout',
      fonteAlterada: deriva.fonteAlterada,
      tokensGastos: 0,
      duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
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
      duracaoNaoContabilizadaSegundos: this.duracaoNaoContabilizada,
    };
  }

  /**
   * `specs/core/architecture.md` e fonte da regra de deriva e do proprio
   * destilado. Executado fora da raiz do projeto, o arquivo simplesmente nao e
   * encontrado e era ignorado em silencio - o destilado saia mais pobre sem que
   * nada dissesse por que. O aviso sai uma unica vez por execucao.
   */
  private async avisarArchitectureAusente(contexto: ContextPackContexto): Promise<void> {
    if (this.avisouArchitectureAusente) {
      return;
    }
    this.avisouArchitectureAusente = true;
    const arquitetura = path.join(contexto.projectRoot, 'specs', 'core', 'architecture.md');
    if (await fs.pathExists(arquitetura)) {
      return;
    }
    this.emitir(
      contexto,
      'aviso',
      `specs/core/architecture.md nao encontrado a partir de ${contexto.projectRoot} - o Contexto de Execucao sera construido sem ele`
    );
  }

  /** Publica o inicio da etapa longa (RF-029), antes de invocar a ferramenta. */
  private iniciarEtapa(contexto: ContextPackContexto): void {
    contexto.onEtapaInicio?.({
      rotulo: ROTULO_ETAPA,
      model: contexto.opcoes.model,
      effort: contexto.opcoes.effort,
    });
  }

  /**
   * Encerra a etapa longa. Sem assinante do par de etapa, cai no canal unico de
   * mensagens: o desfecho nunca deixa de ser publicado.
   */
  private encerrarEtapa(
    contexto: ContextPackContexto,
    kind: StatusKind,
    texto: string
  ): void {
    if (contexto.onEtapaFim) {
      contexto.onEtapaFim(kind, texto);
      return;
    }
    this.emitir(contexto, kind, texto);
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
