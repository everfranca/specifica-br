import { Command } from 'commander';
import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';

import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';
import {
  createPainter,
  detectLevel,
  detectGlyphLevel,
  status,
} from '../utils/terminal/index.js';
import { createLayout } from '../utils/layouts/index.js';
import { GlobalConfigService } from '../utils/global-config-service.js';
import { FileService } from '../utils/file-service.js';
import { ProcessRunner } from '../utils/process-runner.js';
import { ProjectIdentityService } from '../utils/project-identity.js';
import { ToolResolver } from '../utils/tool-resolver.js';
import { getExecutavel, getToolDisplayName } from '../utils/tool-adapters/tool-registry.js';
import type { ToolAdapter } from '../types/tool-adapter.js';
import { TaskDiscoveryService } from '../utils/task-discovery.js';
import { AccountingService } from '../utils/accounting.js';
import { RunLoggerService, buildRunId } from '../utils/run-logger.js';
import { PreflightService, abaixoDoPiso } from '../utils/preflight-service.js';
import { ContextPackService } from '../utils/context-pack-service.js';
import type { ContextPackContexto } from '../utils/context-pack-service.js';
import { resolveHome, shortenPath } from '../utils/path-resolver.js';
import { formatarDuracao } from '../utils/formatos.js';
import { EsperaPorLimiteDeUso, relogioDoSistema } from '../utils/espera-limite.js';
import { validateOptions } from '../utils/executar-tasks-validation.js';
import {
  confirmarExecucao,
  devePerguntar,
  montarPergunta,
} from '../utils/confirmacao-execucao.js';
import { TaskRunner, ajustarPorCapacidades } from '../utils/task-runner.js';
import type { RunnerExecutorConfig } from '../utils/task-runner.js';
import { montarAdapter, prepararArquivoDeApoio } from '../utils/executar-tasks-wiring.js';
import type { AdapterMontado } from '../utils/executar-tasks-wiring.js';
import type {
  ExecutarTasksOptions,
  PreflightContexto,
} from '../types/executar-tasks.js';
import type { ToolSlug } from '../types/config.js';

/** Erro esperado que aborta a execucao com codigo 1 e mensagem nominal. */
class AbortoExecucao extends Error {}

/** Acumula os valores das opcoes repetiveis (`--allow`, `--require-cmd`). */
function colecionar(valor: string, acumulado: string[]): string[] {
  acumulado.push(valor);
  return acumulado;
}

function descricaoPermissoes(opcoes: ExecutarTasksOptions): string {
  const modo =
    opcoes.permissionMode || (opcoes.autoApprove ? 'bypassPermissions' : '');
  if (!modo) {
    return 'nenhuma (o preflight classifica como ERRO)';
  }
  if (modo === 'bypassPermissions') {
    return 'ACESSO TOTAL (bypassPermissions) - Read/Write/Bash/Skill/MCP';
  }
  return modo;
}

async function executar(
  featureDirArg: string,
  brutas: Record<string, unknown>
): Promise<void> {
  // 1. Validacao de argumentos (RF-021). Zero tokens gastos.
  let validadas;
  try {
    validadas = validateOptions(brutas);
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }

  // 2. Resolucao do diretorio da feature, com a barra final removida.
  const featureDir = path.resolve(
    process.cwd(),
    featureDirArg.replace(/[/\\]+$/, '')
  );
  const existe = await fs.pathExists(featureDir);
  const ehDiretorio = existe && (await fs.stat(featureDir)).isDirectory();
  if (!ehDiretorio) {
    throw new AbortoExecucao(`diretorio da feature nao encontrado: ${featureDir}`);
  }

  // 3. Leitura da configuracao global (CT-010). Arquivo invalido nao e sobrescrito.
  const configService = new GlobalConfigService();
  let config;
  try {
    config = await configService.load();
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  const layoutName = config.layout ?? 'coluna';

  // 4. Identificacao do projeto (CT-024) e diretorio central de registros (RF-023).
  let home: string;
  try {
    home = resolveHome();
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  const processRunner = new ProcessRunner();
  const identityService = new ProjectIdentityService(processRunner);
  const identidade = await identityService.resolve(process.cwd());
  let logsDir: string;
  try {
    logsDir = identityService.logsDirFor(identidade, configService.logsBaseDir);
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  try {
    await fs.ensureDir(logsDir);
    await fs.access(logsDir, fs.constants.W_OK);
  } catch {
    throw new AbortoExecucao(
      `sem permissao de escrita em ~/.specifica-br/logs/${identidade.nome}/`
    );
  }

  // 5. Resolucao da ferramenta (RF-011). Sempre gravada pelo resolver.
  // O `painter` e criado aqui, antes do layout, porque a deteccao de ferramenta
  // ja fala com o usuario e toda saida do comando passa pela paleta (RF-013).
  const painter = createPainter(detectLevel());
  const emitirInfo = (texto: string): void => {
    process.stdout.write(`${status('info', texto, painter)}\n`);
  };
  // O layout nasce aqui, antes da resolucao da ferramenta: o adapter e
  // construido no passo 6 ja com o canal de avisos ligado a ele (RF-007, RF-009),
  // e um canal criado depois nunca receberia o aviso emitido durante a montagem.
  const glyphLevel = detectGlyphLevel();
  const isTTY = Boolean(process.stdout.isTTY);
  const layout = createLayout(layoutName, {
    painter,
    glyphLevel,
    isTTY,
    largura: process.stdout.columns || 80,
    stream: process.stdout,
    estiloCabecalho: config.cabecalho,
  });

  const fileService = new FileService();
  const toolResolver = new ToolResolver(
    configService,
    fileService,
    undefined,
    undefined,
    emitirInfo
  );
  let ferramenta: ToolSlug | null;
  try {
    ferramenta = await toolResolver.resolve(
      identidade.nome,
      validadas.tool || undefined,
      process.cwd()
    );
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  if (!ferramenta) {
    throw new AbortoExecucao(
      'nenhuma ferramenta registrada para este projeto e a deteccao foi inconclusiva. Informe --tool'
    );
  }

  // 6. Contrato de capacidades (RF-012).
  let adapter: ToolAdapter;
  let servicoOpenCode: AdapterMontado['servico'];
  try {
    // Uma unica instancia do servico do arquivo de apoio, compartilhada entre o
    // comando e o adapter: e dela que sai o `OPENCODE_CONFIG` de ENV-002.
    ({ adapter, servico: servicoOpenCode } = montarAdapter({
      ferramenta,
      home,
      onAviso: (mensagem) => layout.message('aviso', mensagem),
    }));
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  const { opcoes, avisos: avisosCapacidade } = ajustarPorCapacidades(
    { ...validadas, tool: ferramenta } as ExecutarTasksOptions,
    adapter.capacidades,
    getToolDisplayName(ferramenta)
  );
  const capacidadesAusentes = Object.entries(adapter.capacidades)
    .filter(([, ligada]) => !ligada)
    .map(([nome]) => nome);

  // 7. Descoberta e ordenacao (RF-003, RF-005).
  const taskDiscovery = new TaskDiscoveryService();
  const todas = await taskDiscovery.discover(featureDir);
  if (todas.length === 0) {
    throw new AbortoExecucao(`nenhum arquivo task-*.md em ${featureDir}`);
  }
  let numerosSelecionados: number[] | null = null;
  if (opcoes.tasks.trim() !== '') {
    try {
      numerosSelecionados = taskDiscovery.expandSelection(
        opcoes.tasks,
        todas.map((task) => task.numero)
      );
    } catch (erro) {
      throw new AbortoExecucao((erro as Error).message);
    }
  }
  const selecionadas = taskDiscovery.applySelection(todas, numerosSelecionados);

  // 8. Abertura dos registros, `run_start` e cabecalho.
  const runId = buildRunId();
  const logger = new RunLoggerService();
  try {
    await logger.open(logsDir, runId);
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }

  const accounting = new AccountingService();
  const versao = await adapter.getVersion();
  const extraDirs = await adapter.resolveExtraDirs(opcoes, home, process.cwd());

  // Arquivo de apoio de execucao do OpenCode (CT-035). Recolhe os restos de
  // lotes mortos e grava o arquivo deste lote ANTES do preflight, que e quem
  // verifica a presenca e a legibilidade dele. Nas demais ferramentas nada
  // disso existe, e o `null` propaga isso ate o encerramento do runner.
  let executorConfig: RunnerExecutorConfig | null;
  try {
    const preparado = await prepararArquivoDeApoio(servicoOpenCode, {
      runId,
      pid: process.pid,
      opcoes: { contextInjection: opcoes.contextInjection, allow: opcoes.allow },
    });
    executorConfig = preparado.executorConfig;
    avisosCapacidade.push(...preparado.avisosDoAllow);
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }

  const jsonlPathCurto = shortenPath(path.join(logsDir, `run_${runId}.jsonl`));
  const tetoTexto =
    opcoes.packMaxTokens > 0
      ? `${accounting.formatMilhar(opcoes.packMaxTokens)} tokens`
      : 'sem teto';
  const janelaTexto =
    opcoes.windowBudgetTokens > 0
      ? `${accounting.formatMilhar(opcoes.windowBudgetTokens)} tokens`
      : 'sem teto';

  await logger.logEvent({
    event: 'run_start',
    ts: '',
    feature: featureDirArg,
    tool: ferramenta,
    cli_version: versao,
    model: opcoes.model,
    effort: opcoes.effort,
    fallback_model: opcoes.fallbackModel,
    total_tasks: selecionadas.length,
    total_tasks_feature: todas.length,
    task_selection: opcoes.tasks,
    tasks_selecionadas: selecionadas.map((task) => task.numero),
    window_budget_tokens: opcoes.windowBudgetTokens,
    max_budget_usd: opcoes.maxBudgetUsd,
    auto_approve: opcoes.autoApprove,
    permission_mode: opcoes.permissionMode,
    extra_dirs: extraDirs,
    cache_tuning: opcoes.cacheTuning,
    context_pack: opcoes.contextPack,
    pack_model: opcoes.model,
    pack_effort: opcoes.effort,
    pack_max_tokens: opcoes.packMaxTokens,
    dry_run: opcoes.dryRun,
    layout: layoutName,
    capacidades_ausentes: capacidadesAusentes,
    context_injection: adapter.capacidades.formaDeInjecaoSelecionavel
      ? opcoes.contextInjection
      : 'n/a',
    cli_version_abaixo_do_piso: abaixoDoPiso(ferramenta, versao),
    max_wait_segundos: validadas.maxWaitSegundos,
    wait_on_limit: validadas.waitOnLimit,
    cabecalho: config.cabecalho,
  });

  // Cabecalho por dados (RF-005): o comando entrega `DadosDeAbertura` e a
  // forma e do estilo configurado. Nenhuma string de cabecalho e montada aqui.
  layout.header({
    feature: featureDirArg,
    tasksSelecionadas: selecionadas.length,
    tasksTotal: todas.length,
    criterioDeSelecao: opcoes.tasks.trim() || 'todas',
    ferramenta,
    executavel: getExecutavel(ferramenta),
    versao: versao || 'desconhecida',
    model: opcoes.model,
    effort: opcoes.effort,
    fallbackModel: opcoes.fallbackModel || 'nenhum',
    permissoes: descricaoPermissoes(opcoes),
    contextoLigado: opcoes.contextPack,
    contextoSimulado: opcoes.dryRun,
    contextoTeto: tetoTexto,
    contextoInjecao: adapter.capacidades.formaDeInjecaoSelecionavel
      ? opcoes.contextInjection
      : null,
    cacheTuning: opcoes.cacheTuning,
    dirsExtras: extraDirs.map((dir) => shortenPath(dir)),
    tetoCustoPorTask: `$${opcoes.maxBudgetUsd}`,
    tetoJanela: janelaTexto,
    tetoEspera: validadas.waitOnLimit
      ? formatarDuracao(validadas.maxWaitSegundos)
      : 'desligada',
    registroPath: jsonlPathCurto,
  });

  for (const aviso of avisosCapacidade) {
    layout.message('aviso', aviso);
  }

  // Instancia unica da politica de espera do lote (CT-048, Passo 1 da secao
  // 5.1). E ela que faz o teto de `--max-wait` valer para o lote inteiro,
  // somando as esperas das tasks e as da construcao do destilado. A ligacao com
  // o `TaskRunner` e com o `ContextPackService` e das tasks 9 e 10.
  const esperaPorLimite = new EsperaPorLimiteDeUso({
    relogio: relogioDoSistema,
    layout,
    logger,
    isTTY: isTTY && !process.env.CI,
    tetoAcumuladoSegundos: validadas.maxWaitSegundos,
    ligada: validadas.waitOnLimit,
  });

  const accountingRef = accounting;
  // CT-048: a MESMA instancia de espera injetada no `TaskRunner`. E o que faz o
  // teto de `--max-wait` valer para o lote inteiro, somando as esperas das tasks
  // e as da construcao do destilado (RF-016, RF-021).
  const contextPack = new ContextPackService(
    adapter,
    accountingRef,
    logger,
    esperaPorLimite,
    relogioDoSistema
  );
  const packContexto: ContextPackContexto = {
    featureDir,
    projectRoot: process.cwd(),
    cwd: process.cwd(),
    opcoes: {
      // RF-012: o modelo e o esforco da construcao sao os do lote.
      contextPack: opcoes.contextPack,
      model: opcoes.model,
      effort: opcoes.effort,
      packMaxTokens: opcoes.packMaxTokens,
      cacheTuning: opcoes.cacheTuning,
      packTimeoutSegundos: opcoes.packTimeout,
    },
    // RF-003: canal unico. O layout monta o rotulo, encerra o indicador de
    // progresso e escreve a linha.
    onMensagem: (kind, texto) => layout.message(kind, texto),
    // RF-029: par de etapa longa. O indicador e ligado ANTES da invocacao da
    // ferramenta e substituido pela linha final na mesma linha - sem ele a
    // construcao do destilado nao produz byte algum na tela enquanto roda.
    onEtapaInicio: (info) => layout.etapaStart(info),
    onEtapaFim: (kind, texto) => layout.etapaEnd(kind, texto),
  };

  const runner = new TaskRunner({
    adapter,
    contextPack,
    accounting: accountingRef,
    logger,
    layout,
    // CT-048: a MESMA instancia do `ContextPackService` - e o que faz o teto de
    // `--max-wait` valer para o lote inteiro.
    espera: esperaPorLimite,
    relogio: relogioDoSistema,
    opcoes,
    ferramenta,
    featureDir,
    projectRoot: process.cwd(),
    cwd: process.cwd(),
    extraDirs,
    packContexto,
    windowBudgetTokens: opcoes.windowBudgetTokens,
    packPathInicial: null,
    totalTasks: selecionadas.length,
    executorConfig,
  });

  // SIGINT/SIGTERM (RF-024): mata a task corrente, restaura o cursor, grava e
  // exibe o resumo parcial e sai com 130 (143 em SIGTERM). A task interrompida
  // nao vira concluida.
  //
  // O handler nao chama `process.exit`: isso truncaria o fluxo assincrono e
  // faria justamente o `run_end` e o resumo parcial se perderem. Ele apenas
  // dispara `interromper()`; o encerramento normal segue pelo fluxo do comando,
  // e o codigo de saida e fixado no `finally`.
  let sinalRecebido: NodeJS.Signals | null = null;
  const codigoDoSinal = (sinal: NodeJS.Signals): number =>
    sinal === 'SIGTERM' ? 143 : 130;
  const aoSinal = (sinal: NodeJS.Signals): void => {
    if (sinalRecebido) {
      // Segundo sinal: o usuario quer sair agora. Unica saida abrupta do fluxo,
      // e ainda assim com o cursor devolvido ao terminal (RNF-004).
      process.stdout.write('\x1b[?25h');
      process.exit(codigoDoSinal(sinal));
    }
    sinalRecebido = sinal;
    void runner.interromper().catch(() => undefined);
  };
  const aoSigint = (): void => aoSinal('SIGINT');
  const aoSigterm = (): void => aoSinal('SIGTERM');
  process.on('SIGINT', aoSigint);
  process.on('SIGTERM', aoSigterm);

  try {
    // 9. Guarda de tasks nao certificadas (RF-018).
    await emitirGuardaNaoCertificadas(logger, layout, logsDir, todas, selecionadas);

    // 10. Preflight (RF-006).
    if (!opcoes.skipPreflight) {
      const preflightService = new PreflightService(
        processRunner,
        adapter,
        fileService,
        taskDiscovery
      );
      const contextoPreflight: PreflightContexto = {
        featureDir,
        projetoDir: process.cwd(),
        home,
        ferramenta,
        tasksSelecionadas: selecionadas.map((task) => task.caminho),
        logsDir,
        opcoes,
      };

      const preflight = await preflightService.run(contextoPreflight);
      await logger.logEvent({
        event: 'preflight',
        ts: '',
        erros: preflight.erros,
        avisos: preflight.avisos,
        itens: preflight.itens,
      });

      for (const item of preflight.itens) {
        if (item.severidade === 'OK') {
          continue;
        }
        layout.message(
          item.severidade === 'ERRO' ? 'erro' : item.severidade === 'INFO' ? 'info' : 'aviso',
          `[${item.grupo}] ${item.item}: ${item.mensagem}`
        );
      }

      const seguirMesmoComErro = opcoes.dryRun || opcoes.preflight;
      if (preflight.temErro && seguirMesmoComErro) {
        layout.message(
          'info',
          '(--dry-run/--preflight: seguindo mesmo com erro, para o diagnostico completo)'
        );
      }

      if (opcoes.preflight) {
        await runner.encerrar(
          preflight.temErro ? 'preflight_reprovado' : 'fim_da_lista'
        );
        process.exitCode = preflight.temErro ? 1 : 0;
        return;
      }

      if (preflight.temErro && !opcoes.dryRun) {
        await runner.encerrar('preflight_reprovado');
        process.exitCode = 1;
        return;
      }
    }

    // 10.5 Confirmacao de execucao (RF-025): a ultima porta antes do primeiro
    // gasto real. O resumo e o cabecalho ja exibido; aqui so entram as linhas
    // que faltavam para uma decisao informada e a pergunta unica.
    const tasksDoneSelecionadas = selecionadas.filter((task) => task.done);
    if (tasksDoneSelecionadas.length > 0) {
      layout.message(
        'info',
        `tasks DONE que serao puladas: ${tasksDoneSelecionadas
          .map((task) => task.arquivo.replace(/\.md$/i, ''))
          .join(', ')}`
      );
    }

    const condicoesDeConfirmacao = {
      yes: opcoes.yes,
      dryRun: opcoes.dryRun,
      stdinIsTTY: Boolean(process.stdin.isTTY),
      ci: process.env.CI !== undefined,
    };
    if (!devePerguntar(condicoesDeConfirmacao)) {
      const motivoPulo = opcoes.yes
        ? 'yes'
        : opcoes.dryRun
          ? 'dry_run'
          : 'nao_interativo';
      await logger.logEvent({
        event: 'confirmacao_execucao',
        ts: '',
        decisao: 'pulado',
        motivo_pulo: motivoPulo,
      });
    } else {
      const modoPermissao =
        opcoes.permissionMode || (opcoes.autoApprove ? 'bypassPermissions' : '');
      const decisao = await confirmarExecucao(
        montarPergunta({
          tasks: selecionadas.length,
          ferramenta,
          model: opcoes.model,
          effort: opcoes.effort,
          acessoTotal: modoPermissao === 'bypassPermissions',
        }),
        { entrada: process.stdin, saida: process.stdout, painter }
      );
      await logger.logEvent({
        event: 'confirmacao_execucao',
        ts: '',
        decisao,
        motivo_pulo: null,
      });

      if (decisao === 'recusado') {
        layout.message('aviso', 'execucao cancelada pelo usuario');
        await runner.encerrar('cancelado_na_confirmacao');
        process.exitCode = 0;
        return;
      }
      if (decisao === 'interrompido') {
        if (sinalRecebido) {
          // Ctrl+C no prompt: o handler de sinal (RF-024) ja anunciou a
          // interrupcao e e inofensivo sem task em curso; falta fechar o
          // registro e o codigo 130, que o finally define.
          await runner.encerrar('interrompido_pelo_usuario');
        } else {
          // EOF sem resposta: na duvida, nao gasta. Mesmo desfecho da recusa.
          layout.message('aviso', 'execucao cancelada pelo usuario');
          await runner.encerrar('cancelado_na_confirmacao');
          process.exitCode = 0;
        }
        return;
      }
    }

    // 11. Contexto de Execucao (RF-007). Em `--dry-run` a construcao e pulada:
    // ela invoca a CLI de verdade e custa tokens reais, e a opcao promete o
    // oposto ("sem invocar a CLI", RF-002).
    if (opcoes.dryRun && opcoes.contextPack) {
      layout.message(
        'info',
        'dry-run: o Contexto de Execucao seria construido/reaproveitado aqui - nenhuma chamada a CLI foi feita'
      );
    } else {
      const packResult = await contextPack.ensure(packContexto);

      // RF-021: esgotada a espera durante a construcao, o lote encerra com
      // motivo de limite de uso e codigo 1, SEM iniciar nenhuma task e SEM
      // reaproveitar destilado desatualizado.
      if (packResult.decisao === 'falhou' && packResult.motivo === 'limite_de_uso') {
        await runner.encerrar('limite_de_uso');
        process.exitCode = 1;
        return;
      }

      runner.registrarPack(packResult);
    }

    // 12 e 13. Loop das tasks e encerramento.
    const motivo = await runner.run(selecionadas);
    await runner.encerrar(motivo);
    // RF-020: a desistencia da espera encerra com codigo 1 - diferente de zero
    // e distinto do codigo de conclusao normal (CT-040).
    process.exitCode = motivo === 'falha_na_task' || motivo === 'limite_de_uso' ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', aoSigint);
    process.removeListener('SIGTERM', aoSigterm);
    // O sinal vence qualquer codigo definido no caminho normal: em RF-024 a
    // saida de uma interrupcao e 130 (143 em SIGTERM).
    if (sinalRecebido) {
      process.exitCode = codigoDoSinal(sinalRecebido);
    }
  }
}

/**
 * Passo 9: varre os `run_*.jsonl` anteriores do mesmo projeto, coleta as tasks
 * que terminaram sem erro e sem `dry_run` e relata as que hoje ainda nao estao
 * DONE, separando as que serao reexecutadas agora das que estao fora da selecao.
 */
async function emitirGuardaNaoCertificadas(
  logger: RunLoggerService,
  layout: ReturnType<typeof createLayout>,
  logsDir: string,
  todas: { arquivo: string; done: boolean }[],
  selecionadas: { arquivo: string }[]
): Promise<void> {
  const eventos = await logger.readPreviousRuns(logsDir);
  const doneAtual = new Map(todas.map((task) => [task.arquivo, task.done]));
  const naSelecao = new Set(selecionadas.map((task) => task.arquivo));

  const naoCertificadas = new Set<string>();
  for (const evento of eventos) {
    const bruto = evento as unknown as Record<string, unknown>;
    if (
      bruto.event === 'end' &&
      bruto.is_error === false &&
      bruto.dry_run !== true &&
      typeof bruto.task === 'string' &&
      doneAtual.get(bruto.task) === false
    ) {
      naoCertificadas.add(bruto.task);
    }
  }

  if (naoCertificadas.size === 0) {
    return;
  }

  const lista = [...naoCertificadas];
  const nestaExecucao = lista.filter((arquivo) => naSelecao.has(arquivo));
  const foraDaSelecao = lista.filter((arquivo) => !naSelecao.has(arquivo));

  await logger.logEvent({
    event: 'tasks_nao_certificadas',
    ts: '',
    tasks: lista,
    nesta_execucao: nestaExecucao,
  });

  if (nestaExecucao.length > 0) {
    layout.message(
      'info',
      `tasks nao certificadas que serao reexecutadas agora: ${nestaExecucao
        .map((a) => a.replace(/\.md$/i, ''))
        .join(', ')}`
    );
  }
  if (foraDaSelecao.length > 0) {
    layout.message(
      'info',
      `tasks nao certificadas fora da selecao atual: ${foraDaSelecao
        .map((a) => a.replace(/\.md$/i, ''))
        .join(', ')}`
    );
  }
}

async function acao(
  featureDir: string,
  brutas: Record<string, unknown>
): Promise<void> {
  const painter = createPainter(detectLevel());
  try {
    await executar(featureDir, brutas);
  } catch (erro) {
    if (erro instanceof AbortoExecucao) {
      const mensagem = erro.message;
      process.stderr.write(
        /^Erro:/.test(mensagem)
          ? `${mensagem}\n`
          : `${status('erro', mensagem, painter)}\n`
      );
      process.exitCode = 1;
      return;
    }
    throw erro;
  }
}

async function acaoEnvolvida(
  featureDir: string,
  brutas: Record<string, unknown>
): Promise<void> {
  await updateNotifierMiddleware.wrap('executar-tasks', () =>
    acao(featureDir, brutas)
  );
}

/**
 * Subcomando `executar-tasks` (CT-001). As 26 opcoes da secao 4.1 do techspec
 * mais a `--yes` de RF-025, na forma exata da coluna "Declaracao Commander".
 * As quatro negativas sao
 * declaradas sozinhas: em Commander 14 isso lhes da default `true` e `false`
 * quando informadas, e nenhuma opcao positiva correspondente e exposta.
 * `--model` e `--effort` nao usam `requiredOption` de proposito: a mensagem
 * literal com exemplo de invocacao (RF-011) e produzida por `validateOptions`,
 * primeira instrucao da acao. `allowUnknownOption` fica desligado (padrao),
 * rejeitando opcao desconhecida antes de qualquer execucao — e o que recusa
 * `--pack-model` e `--pack-effort`, removidas sem convivencia (RF-028, D12).
 */
export const executarTasksCommand = new Command('executar-tasks')
  .description('Executa em lote os arquivos task-*.md de uma feature')
  .argument('<feature-dir>', 'Caminho do diretorio da feature')
  .option('--tool <slug>', 'Ferramenta de IA (atualiza o registro do projeto)')
  .option('--model <modelo>', 'Modelo da ferramenta (obrigatoria)')
  .option('--effort <nivel>', 'Nivel de esforco (low|medium|high|xhigh|max) (obrigatoria)')
  .option('--fallback-model <modelo>', 'Modelo de fallback', '')
  .option('--auto-approve', 'Concede acesso total sem prompts de permissao', false)
  .option('--permission-mode <modo>', 'Modo de permissao explicito', '')
  .option('--no-skill-dirs', 'Nao adiciona os diretorios de skills como --add-dir')
  .option('--max-budget-usd <n>', 'Teto de custo por task em USD', '0')
  .option('--window-budget-tokens <n>', 'Teto de tokens da janela de execucao', '0')
  .option('--stop-on-failure', 'Interrompe o lote na primeira task com erro', false)
  .option('--sleep <segundos>', 'Pausa entre tasks em segundos', '0')
  .option('--no-cache-tuning', 'Desliga a otimizacao de cache do prompt')
  .option('--no-context-pack', 'Nao constroi nem injeta o Contexto de Execucao')
  .option(
    '--context-injection <forma>',
    'Forma de injecao do Contexto de Execucao (prompt|instructions)',
    'prompt'
  )
  .option(
    '--max-wait <duracao>',
    'Teto de espera acumulada por limite de uso (ex.: 90, 30m, 6h, 1h30m)',
    '6h'
  )
  .option(
    '--no-wait-on-limit',
    'Nao aguarda a renovacao da cota; encerra o lote no primeiro limite de uso'
  )
  .option('--pack-max-tokens <n>', 'Teto de tamanho do Contexto de Execucao', '8000')
  .option(
    '--pack-timeout <segundos>',
    'Teto de tempo da construcao do Contexto de Execucao (0 desliga)',
    '900'
  )
  .option('--tasks <selecao>', 'Selecao de tasks (ex.: 1-3,7)', '')
  .option('--allow <regra>', 'Regra adicional de --allowedTools (repetivel)', colecionar, [])
  .option('--preflight', 'Executa apenas as verificacoes previas e encerra', false)
  .option('--skip-preflight', 'Pula as verificacoes previas', false)
  .option('--require-cmd <cmd>', 'Comando que deve existir no PATH (repetivel)', colecionar, [])
  .option('--mcp-timeout <seg>', 'Timeout da verificacao de MCPs em segundos', '15')
  .option('--no-mcp-check', 'Nao verifica os MCPs declarados no preflight')
  .option('--dry-run', 'Mostra o que seria executado sem invocar a CLI', false)
  .option('-y, --yes', 'Pula a confirmacao antes de iniciar o lote', false)
  .action(acaoEnvolvida);
