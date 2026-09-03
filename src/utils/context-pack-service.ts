import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import type { BuildContextPackArgsInput, TaskResult } from '../types/tool-adapter.js';
import type { EffortLevel, PackResult } from '../types/executar-tasks.js';
import type { AccountingService } from './accounting.js';
import type { RunLoggerService } from './run-logger.js';
import { CONTEXT_PACK_PROMPT, CONTEXT_PACK_TEMPLATE } from './context-pack-prompt.js';

const NOME_DESTILADO = 'contexto-execucao.md';

/**
 * Subconjunto do adapter da ferramenta (task-5) consumido aqui. `runPack` ja
 * normaliza a resposta como `parseResult` (CT-020); esta task nao reimplementa
 * `buildContextPackArgs`, `runPack` nem `parseResult`.
 */
export interface ContextPackToolAdapter {
  runPack(
    prompt: string,
    entrada: BuildContextPackArgsInput,
    cwd: string,
    onStderrChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<TaskResult>;
}

/** Opcoes de `executar-tasks` que afetam o Contexto de Execucao (CT-021). */
export interface ContextPackOpcoes {
  contextPack: boolean;
  packModel: string;
  packEffort: EffortLevel;
  packMaxTokens: number;
  cacheTuning: boolean;
}

export interface ContextPackContexto {
  featureDir: string;
  projectRoot: string;
  cwd: string;
  opcoes: ContextPackOpcoes;
  /**
   * Destino das mensagens `[ AVIS]`/`[ INFO]` do mecanismo. Default: `stderr` do
   * processo. O `stderr` do processo filho nao passa por aqui: vai direto para
   * `RunLoggerService.appendStderr` (CT-012).
   */
  onMensagem?: (mensagem: string) => void;
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

  constructor(
    private readonly adapter: ContextPackToolAdapter,
    private readonly accounting: AccountingService,
    private readonly logger: RunLoggerService
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
    this.emitir(contexto, '[ INFO] Contexto de Execucao em dia - reaproveitando o destilado existente');

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

    const entrada: BuildContextPackArgsInput = {
      featureDir,
      packModel: opcoes.packModel,
      packEffort: opcoes.packEffort,
      cacheTuning: opcoes.cacheTuning,
    };

    const resultado = await this.adapter.runPack(
      prompt,
      entrada,
      cwd,
      (chunk) => this.logger.appendStderr(chunk),
      this.cancelamento.signal
    );

    const arquivoExiste = await fs.pathExists(destilado);
    const { tokensDaTask, custoDaTask } = this.accounting.accumulate(resultado);
    this.jaTentouConstruir = true;

    const sucesso = resultado.exitCode === 0 && !resultado.isError && arquivoExiste;

    if (!sucesso) {
      this.emitir(
        contexto,
        '[ AVIS] falha ao construir o Contexto de Execucao - seguindo sem ele'
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
        `[ AVIS] Contexto de Execucao acima do teto: ~${estTokens} > ${teto} tokens. O excedente sera pago em cada task.`
      );
    }

    await this.logger.logEvent({
      event: 'pack_build',
      ts: '',
      motivo: deriva.motivo,
      fonte_alterada: deriva.fonteAlterada,
      arquivo: destilado,
      session_id: resultado.sessionId,
      pack_model: opcoes.packModel,
      pack_effort: opcoes.packEffort,
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

  private emitir(contexto: ContextPackContexto, mensagem: string): void {
    if (contexto.onMensagem) {
      contexto.onMensagem(mensagem);
      return;
    }

    process.stderr.write(`${mensagem}\n`);
  }
}
