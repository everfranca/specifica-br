import { Command } from 'commander';
import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';

import { updateNotifierMiddleware } from '../utils/update-notifier-middleware.js';
import {
  createPainter,
  detectLevel,
  detectGlyphLevel,
  signature,
  status,
} from '../utils/terminal/index.js';
import { createLayout } from '../utils/layouts/index.js';
import { GlobalConfigService } from '../utils/global-config-service.js';
import { FileService } from '../utils/file-service.js';
import { ProcessRunner } from '../utils/process-runner.js';
import { ProjectIdentityService } from '../utils/project-identity.js';
import { ToolResolver } from '../utils/tool-resolver.js';
import { getAdapter, getExecutavel } from '../utils/tool-adapters/tool-registry.js';
import type { ToolAdapter } from '../types/tool-adapter.js';
import { TaskDiscoveryService } from '../utils/task-discovery.js';
import { AccountingService } from '../utils/accounting.js';
import { RunLoggerService, buildRunId } from '../utils/run-logger.js';
import { PreflightService } from '../utils/preflight-service.js';
import { ContextPackService } from '../utils/context-pack-service.js';
import type { ContextPackContexto } from '../utils/context-pack-service.js';
import { resolveHome, shortenPath } from '../utils/path-resolver.js';
import { validateOptions } from '../utils/executar-tasks-validation.js';
import { TaskRunner, ajustarPorCapacidades } from '../utils/task-runner.js';
import type { ExecutarTasksOptions, PreflightContexto } from '../types/executar-tasks.js';
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

/**
 * Texto da linha `Contexto Exec` do cabecalho. Em `--dry-run` o mecanismo esta
 * ligado mas nao constroi nada, e o cabecalho precisa dizer o que de fato vai
 * acontecer.
 */
function descricaoContextoExec(
  opcoes: ExecutarTasksOptions,
  tetoTexto: string
): string {
  if (!opcoes.contextPack) {
    return 'off';
  }
  if (opcoes.dryRun) {
    return 'on   (--dry-run: nao sera construido nem injetado)';
  }
  return `on   construcao: ${opcoes.packModel}/${opcoes.packEffort}   teto: ${tetoTexto}`;
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
  try {
    adapter = getAdapter(ferramenta);
  } catch (erro) {
    throw new AbortoExecucao((erro as Error).message);
  }
  const { opcoes, avisos: avisosCapacidade } = ajustarPorCapacidades(
    { ...validadas, tool: ferramenta } as ExecutarTasksOptions,
    adapter.capacidades,
    ferramenta
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

  const glyphLevel = detectGlyphLevel();
  const isTTY = Boolean(process.stdout.isTTY);
  const layout = createLayout(layoutName, {
    painter,
    glyphLevel,
    isTTY,
    largura: process.stdout.columns || 80,
    stream: process.stdout,
  });

  const accounting = new AccountingService();
  const versao = await adapter.getVersion();
  const extraDirs = await adapter.resolveExtraDirs(opcoes, home, process.cwd());
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
    pack_model: opcoes.packModel,
    pack_effort: opcoes.packEffort,
    pack_max_tokens: opcoes.packMaxTokens,
    dry_run: opcoes.dryRun,
    layout: layoutName,
    capacidades_ausentes: capacidadesAusentes,
  });

  layout.header([
    `${signature(painter)}  executar-tasks`,
    '',
    `  Feature        ${featureDirArg}`,
    `  Ferramenta     ${ferramenta} (${getExecutavel(ferramenta)} ${versao || 'desconhecida'})`,
    `  Modelo         ${opcoes.model}   Effort: ${opcoes.effort}   Fallback: ${
      opcoes.fallbackModel || 'nenhum'
    }`,
    `  Permissoes     ${descricaoPermissoes(opcoes)}`,
    `  Dirs extras    ${
      extraDirs.length ? extraDirs.map(shortenPath).join(' ') : 'nenhum'
    }`,
    `  Cache tuning   ${opcoes.cacheTuning ? 'on' : 'off'}`,
    `  Contexto Exec  ${descricaoContextoExec(opcoes, tetoTexto)}`,
    `  Orcamentos     task=$${opcoes.maxBudgetUsd}   janela=${janelaTexto}`,
    `  Tasks          ${selecionadas.length} de ${todas.length} selecionadas (${
      opcoes.tasks.trim() || 'todas'
    })`,
    `  Registro       ${jsonlPathCurto}`,
  ]);

  for (const aviso of avisosCapacidade) {
    layout.message('aviso', aviso);
  }

  const accountingRef = accounting;
  const contextPack = new ContextPackService(adapter, accountingRef, logger);
  const packContexto: ContextPackContexto = {
    featureDir,
    projectRoot: process.cwd(),
    cwd: process.cwd(),
    opcoes: {
      contextPack: opcoes.contextPack,
      packModel: opcoes.packModel,
      packEffort: opcoes.packEffort,
      packMaxTokens: opcoes.packMaxTokens,
      cacheTuning: opcoes.cacheTuning,
    },
    onMensagem: (mensagem) => process.stdout.write(`${mensagem}\n`),
  };

  const runner = new TaskRunner({
    adapter,
    contextPack,
    accounting: accountingRef,
    logger,
    layout,
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
        opcoes: {
          autoApprove: opcoes.autoApprove,
          permissionMode: opcoes.permissionMode,
          requireCmd: opcoes.requireCmd,
          mcpCheck: opcoes.mcpCheck,
          mcpTimeout: opcoes.mcpTimeout,
        },
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
          item.severidade === 'ERRO' ? 'erro' : 'aviso',
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
      runner.setPackPath(contextPack.caminhoParaInjecao(packResult));
    }

    // 12 e 13. Loop das tasks e encerramento.
    const motivo = await runner.run(selecionadas);
    await runner.encerrar(motivo);
    process.exitCode = motivo === 'falha_na_task' ? 1 : 0;
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
 * Subcomando `executar-tasks` (CT-001). As 24 opcoes da secao 4.1 do techspec,
 * na forma exata da coluna "Declaracao Commander". As quatro negativas sao
 * declaradas sozinhas: em Commander 14 isso lhes da default `true` e `false`
 * quando informadas, e nenhuma opcao positiva correspondente e exposta.
 * `allowUnknownOption` fica desligado (padrao), rejeitando opcao desconhecida
 * antes de qualquer execucao.
 */
export const executarTasksCommand = new Command('executar-tasks')
  .description('Executa em lote os arquivos task-*.md de uma feature')
  .argument('<feature-dir>', 'Caminho do diretorio da feature')
  .option('--tool <slug>', 'Ferramenta de IA (atualiza o registro do projeto)')
  .option('--model <modelo>', 'Modelo da ferramenta', 'sonnet')
  .option('--effort <nivel>', 'Nivel de esforco (low|medium|high|xhigh|max)', 'medium')
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
  .option('--pack-model <modelo>', 'Modelo da construcao do Contexto de Execucao', 'sonnet')
  .option('--pack-effort <nivel>', 'Esforco da construcao do Contexto de Execucao', 'low')
  .option('--pack-max-tokens <n>', 'Teto de tamanho do Contexto de Execucao', '8000')
  .option('--tasks <selecao>', 'Selecao de tasks (ex.: 1-3,7)', '')
  .option('--allow <regra>', 'Regra adicional de --allowedTools (repetivel)', colecionar, [])
  .option('--preflight', 'Executa apenas as verificacoes previas e encerra', false)
  .option('--skip-preflight', 'Pula as verificacoes previas', false)
  .option('--require-cmd <cmd>', 'Comando que deve existir no PATH (repetivel)', colecionar, [])
  .option('--mcp-timeout <seg>', 'Timeout da verificacao de MCPs em segundos', '15')
  .option('--no-mcp-check', 'Nao verifica os MCPs declarados no preflight')
  .option('--dry-run', 'Mostra o que seria executado sem invocar a CLI', false)
  .action(acaoEnvolvida);
