import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { TaskRunner, ajustarPorCapacidades } from '../dist/utils/task-runner.js';
import { getAdapter, getCapabilities } from '../dist/utils/tool-adapters/tool-registry.js';
import { AccountingService } from '../dist/utils/accounting.js';
import { TaskDiscoveryService } from '../dist/utils/task-discovery.js';
import type { ExecutarTasksOptions, RunEndMotivo, TaskInfo } from '../dist/types/executar-tasks.js';
import type { TaskResult, ToolCapabilities } from '../dist/types/tool-adapter.js';

const CAPACIDADES_LIGADAS: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: true,
  consultaAosMcps: true,
  relatoDeCustoEmUSD: true,
  tetoDeCustoNativo: true,
  modeloDeFallback: true,
  otimizacaoDeCacheDePrompt: true,
  relatoDeNegacoesDePermissao: true,
  formaDeInjecaoSelecionavel: false,
  relatoDeModeloEfetivo: true,
};

function opcoes(over: Partial<ExecutarTasksOptions> = {}): ExecutarTasksOptions {
  return {
    tool: 'claudecode',
    model: 'sonnet',
    effort: 'medium',
    fallbackModel: '',
    autoApprove: true,
    permissionMode: '',
    skillDirs: true,
    maxBudgetUsd: 0,
    windowBudgetTokens: 0,
    stopOnFailure: false,
    sleep: 0,
    cacheTuning: true,
    contextPack: true,
    contextInjection: 'prompt',
    maxWait: '6h',
    waitOnLimit: true,
    packMaxTokens: 8000,
    tasks: '',
    allow: [],
    preflight: false,
    skipPreflight: false,
    requireCmd: [],
    mcpTimeout: 15,
    mcpCheck: true,
    dryRun: false,
    ...over,
  };
}

function resultado(over: Partial<TaskResult> = {}): TaskResult {
  return {
    sessionId: 'sess-1',
    subtype: 'success',
    isError: false,
    exitCode: 0,
    numTurns: 3,
    durationMs: 100,
    durationApiMs: 90,
    costUsd: 0,
    model: 'claude-sonnet-4-5',
    modelosReportados: 'claude-sonnet-4-5',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    reasoningTokens: null,
    permissionDenials: 0,
    contabilidadeParcial: false,
    ferramentasNegadas: null,
    rawStdout: '',
    rawStderr: '',
    ...over,
  };
}

function fakeLayout() {
  const mensagens: Array<[string, string]> = [];
  const skips: Array<{ arquivo: string; motivo: string; selecionada: boolean }> = [];
  let resumo: string[] | null = null;
  let disposeChamado = false;
  const obj = {
    header() {},
    taskStart() {},
    taskEnd() {},
    taskSkipped(arquivo: string, motivo: string, selecionada: boolean) {
      skips.push({ arquivo, motivo, selecionada });
    },
    message(kind: string, texto: string) {
      mensagens.push([kind, texto]);
    },
    waitStart() {},
    waitUpdate() {},
    waitEnd() {},
    summary(linhas: string[]) {
      resumo = linhas;
    },
    dispose() {
      disposeChamado = true;
    },
  };
  return {
    obj,
    mensagens,
    skips,
    get resumo() {
      return resumo;
    },
    get disposeChamado() {
      return disposeChamado;
    },
  };
}

function fakeLogger() {
  const eventos: Array<Record<string, unknown>> = [];
  const stderr: string[] = [];
  const obj = {
    async logEvent(evento: Record<string, unknown>) {
      eventos.push(evento);
    },
    appendStderr(texto: string) {
      stderr.push(texto);
    },
    async close() {},
  };
  return { obj, eventos, stderr };
}

function fakeContextPack(over: Partial<Record<string, unknown>> = {}) {
  const chamadas = { precisaReconstruir: 0, ensure: 0, abort: 0 };
  const obj = {
    async precisaReconstruir() {
      chamadas.precisaReconstruir += 1;
      return { reconstruir: false, motivo: 'em_dia', fonteAlterada: null };
    },
    async ensure() {
      chamadas.ensure += 1;
      return {
        decisao: 'reaproveitado',
        caminho: null,
        bytes: 0,
        estTokens: 0,
        acimaDoTeto: false,
        motivo: 'em_dia',
        fonteAlterada: null,
        tokensGastos: 0,
      };
    },
    caminhoParaInjecao() {
      return null;
    },
    abort() {
      chamadas.abort += 1;
    },
    ...over,
  };
  return { obj, chamadas };
}

interface AdapterOver {
  runTask?: (
    e: unknown,
    cwd: string,
    onStderr?: (c: string) => void
  ) => Promise<TaskResult>;
  detectRateLimit?: () => boolean;
  capacidades?: Partial<ToolCapabilities>;
}

interface EntradaDeTask {
  taskPath: string;
  contextoExecucaoPath: string | null;
  contextoExecucaoConteudo: string | null;
}

function fakeAdapter(over: AdapterOver = {}) {
  const chamadas = { runTask: 0 };
  const entradas: EntradaDeTask[] = [];
  const obj = {
    capacidades: { ...CAPACIDADES_LIGADAS, ...(over.capacidades ?? {}) },
    buildTaskArgs(e: EntradaDeTask) {
      entradas.push(e);
      // Espelha CT-031: o destilado, quando presente, viaja no posicional.
      const posicional =
        e.contextoExecucaoConteudo === null || e.contextoExecucaoConteudo === ''
          ? e.taskPath
          : `${e.taskPath}\n\n${e.contextoExecucaoConteudo}`;
      return ['run', posicional];
    },
    async runTask(e: EntradaDeTask, cwd: string, onStderr?: (c: string) => void) {
      chamadas.runTask += 1;
      entradas.push(e);
      if (over.runTask) {
        return over.runTask(e, cwd, onStderr);
      }
      return resultado({});
    },
    detectRateLimit() {
      return over.detectRateLimit ? over.detectRateLimit() : false;
    },
  };
  return { obj, chamadas, entradas };
}

/**
 * Relogio falso (CT-048, RNF-006): o tempo so anda quando o teste manda, e
 * `esperar` resolve na hora avancando o relogio. Nenhum teste aguarda tempo real.
 */
function fakeRelogio(inicio = 0) {
  let agora = inicio;
  const obj = {
    agora() {
      return agora;
    },
    async esperar(ms: number) {
      agora += ms;
    },
  };
  return {
    obj,
    avancar(ms: number) {
      agora += ms;
    },
  };
}

interface DecisaoDeEspera {
  retomar: boolean;
  motivoDaDesistencia: string | null;
}

interface EsperaOver {
  /** Uma decisao por chamada, na ordem. A ultima vale para as chamadas seguintes. */
  decisoes?: DecisaoDeEspera[];
  /** Segundos somados ao acumulado a cada espera. */
  esperaSegundos?: number;
  aoAguardar?: () => void;
}

function fakeEspera(over: EsperaOver = {}) {
  const chamadas: Array<Record<string, unknown>> = [];
  let acumulado = 0;
  const obj = {
    get acumuladoSegundos() {
      return acumulado;
    },
    async aguardar(entrada: Record<string, unknown>) {
      chamadas.push(entrada);
      acumulado += over.esperaSegundos ?? 0;
      over.aoAguardar?.();
      const decisoes = over.decisoes ?? [];
      return (
        decisoes[chamadas.length - 1] ??
        decisoes[decisoes.length - 1] ?? { retomar: true, motivoDaDesistencia: null }
      );
    },
  };
  return { obj, chamadas };
}

let contadorTmp = 0;
async function criarTasks(specs: Array<{ numero: number; done: boolean }>): Promise<TaskInfo[]> {
  const dir = path.join(os.tmpdir(), `task-runner-test-${process.pid}-${contadorTmp++}`);
  await fs.ensureDir(dir);
  const tasks: TaskInfo[] = [];
  for (const spec of specs) {
    const arquivo = `task-${spec.numero}.md`;
    const caminho = path.join(dir, arquivo);
    await fs.writeFile(caminho, `# task ${spec.numero}\n\n| **Status** | ${spec.done ? 'DONE' : 'TODO'} |\n`);
    tasks.push({ arquivo, numero: spec.numero, caminho, done: spec.done, selecionada: true });
  }
  return tasks;
}

interface MontarOpcoes {
  opcoes?: ExecutarTasksOptions;
  adapter?: ReturnType<typeof fakeAdapter>;
  contextPack?: ReturnType<typeof fakeContextPack>;
  accounting?: AccountingService;
  windowBudgetTokens?: number;
  totalTasks?: number;
  executorConfig?: {
    aplicarDestilado(destiladoPath: string | null): Promise<void>;
    remover(): Promise<void>;
  } | null;
  packPathInicial?: string | null;
  ferramenta?: 'claudecode' | 'opencode';
  espera?: ReturnType<typeof fakeEspera>;
  relogio?: ReturnType<typeof fakeRelogio>;
  logger?: ReturnType<typeof fakeLogger>;
}

function montar(m: MontarOpcoes = {}) {
  const layout = fakeLayout();
  const logger = m.logger ?? fakeLogger();
  const adapter = m.adapter ?? fakeAdapter();
  const contextPack = m.contextPack ?? fakeContextPack();
  const accounting = m.accounting ?? new AccountingService();
  const espera = m.espera ?? fakeEspera();
  const relogio = m.relogio ?? fakeRelogio();
  const opcs = m.opcoes ?? opcoes();
  const runner = new TaskRunner({
    adapter: adapter.obj as never,
    contextPack: contextPack.obj as never,
    accounting,
    logger: logger.obj as never,
    layout: layout.obj as never,
    espera: espera.obj as never,
    relogio: relogio.obj as never,
    opcoes: opcs,
    ferramenta: m.ferramenta ?? 'claudecode',
    featureDir: '/tmp/feature',
    projectRoot: '/tmp',
    cwd: '/tmp',
    extraDirs: [],
    packContexto: {
      featureDir: '/tmp/feature',
      projectRoot: '/tmp',
      cwd: '/tmp',
      opcoes: {
        contextPack: opcs.contextPack,
        packModel: opcs.model,
        packEffort: opcs.effort,
        packMaxTokens: opcs.packMaxTokens,
        cacheTuning: opcs.cacheTuning,
      },
    } as never,
    windowBudgetTokens: m.windowBudgetTokens ?? opcs.windowBudgetTokens,
    packPathInicial: m.packPathInicial ?? null,
    totalTasks: m.totalTasks ?? 0,
    executorConfig: m.executorConfig ?? null,
  });
  return { runner, layout, logger, adapter, contextPack, accounting, espera, relogio };
}

function eventos(logger: ReturnType<typeof fakeLogger>, tipo: string) {
  return logger.eventos.filter((e) => e.event === tipo);
}

test('task DONE nao e executada nem quando selecionada, e grava skip', async () => {
  const tasks = await criarTasks([{ numero: 1, done: true }]);
  const adapter = fakeAdapter();
  const { runner, logger } = montar({ adapter });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 0);
  const skip = eventos(logger, 'skip')[0];
  assert.equal(skip.task, 'task-1.md');
  assert.equal(skip.motivo, 'DONE');
});

test('a task DONE selecionada gera o aviso de selecionada e nao executada', async () => {
  const tasks = await criarTasks([{ numero: 1, done: true }]);
  tasks[0].selecionada = true;
  const { runner, layout } = montar();
  await runner.run(tasks);
  assert.equal(layout.skips[0].selecionada, true);
});

test('a ordem de execucao e numerica crescente mesmo com --tasks 10,1,2', () => {
  const td = new TaskDiscoveryService();
  assert.deepEqual(td.expandSelection('10,1,2', [1, 2, 10]), [1, 2, 10]);
});

test('--tasks 1-3,7 expande para exatamente 1, 2, 3, 7', () => {
  const td = new TaskDiscoveryService();
  assert.deepEqual(td.expandSelection('1-3,7', [1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 7]);
});

test('a trava da janela interrompe ANTES de iniciar a proxima task', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ inputTokens: 5000 });
    },
  });
  const accounting = new AccountingService();
  accounting.accumulate(resultado({ inputTokens: 98000 }));
  const { runner, logger } = montar({ adapter, accounting, windowBudgetTokens: 100000 });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'orcamento_da_janela');
  assert.equal(adapter.chamadas.runTask, 1);
  const be = eventos(logger, 'budget_exhausted')[0];
  assert.equal(be.proxima_task, 'task-2.md');
  // a task 1 rodou inteira: o evento end existe (nunca interrompida no meio)
  assert.equal(eventos(logger, 'end').length, 1);
});

test('limite de uso em task que falhou encerra o lote quando a espera desiste', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
    { numero: 3, done: false },
    { numero: 4, done: false },
  ]);
  const adapter = fakeAdapter({
    detectRateLimit: () => true,
    async runTask() {
      return resultado({ isError: true, exitCode: 1, rawStderr: 'usage limit reached' });
    },
  });
  const espera = fakeEspera({
    decisoes: [{ retomar: false, motivoDaDesistencia: 'teto de espera esgotado' }],
  });
  const { runner, logger } = montar({ adapter, espera });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'limite_de_uso');
  assert.equal(adapter.chamadas.runTask, 1);
  assert.equal(eventos(logger, 'rate_limited').length, 1);
});

test('--stop-on-failure encerra com motivo falha_na_task', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ isError: true, subtype: 'parse_error', exitCode: 1 });
    },
  });
  const { runner } = montar({ adapter, opcoes: opcoes({ stopOnFailure: true }) });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'falha_na_task');
  assert.equal(adapter.chamadas.runTask, 1);
});

test('erro sem --stop-on-failure registra e segue para a proxima', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  let chamada = 0;
  const adapter = fakeAdapter({
    async runTask() {
      chamada += 1;
      return chamada === 1
        ? resultado({ isError: true, subtype: 'parse_error', exitCode: 1 })
        : resultado({});
    },
  });
  const { runner, logger, layout } = montar({ adapter });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 2);
  const runEnd = eventos(logger, 'run_end')[0] ?? null;
  assert.ok(layout.mensagens.some(([k, t]) => k === 'erro' && t.includes('terminou com erro')));
});

test('task sem erro e sem DONE gera o AVISO de nao certificada e sem_certificacao no evento', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const { runner, logger, layout } = montar();
  await runner.run(tasks);
  const end = eventos(logger, 'end')[0];
  assert.equal(end.sem_certificacao, true);
  assert.ok(
    layout.mensagens.some(([k, t]) => k === 'aviso' && t.includes('nao certificada'))
  );
});

test('permissoes negadas geram o AVISO nominal', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ permissionDenials: 2, ferramentasNegadas: 'Bash' });
    },
  });
  const { runner, layout } = montar({ adapter });
  await runner.run(tasks);
  assert.ok(
    layout.mensagens.some(([k, t]) => k === 'aviso' && t.includes('permissao(oes) negada(s)'))
  );
});

test('--dry-run nao invoca a CLI e grava end com dry_run true', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    async runTask() {
      throw new Error('runTask nao deveria ser chamado em --dry-run');
    },
  });
  const { runner, logger } = montar({ adapter, opcoes: opcoes({ dryRun: true }) });
  const motivo = await runner.run(tasks);
  assert.equal(motivo, 'fim_da_lista');
  const end = eventos(logger, 'end')[0];
  assert.equal(end.dry_run, true);
});

test('a deriva do destilado e verificada antes de cada task', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const contextPack = fakeContextPack();
  const { runner } = montar({ contextPack });
  await runner.run(tasks);
  assert.equal(contextPack.chamadas.precisaReconstruir, 2);
});

test('o stderr das tasks vai para appendStderr e nunca para as mensagens de tela', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    async runTask(_e: unknown, _cwd: string, onStderr?: (c: string) => void) {
      onStderr?.('ruido no stderr do filho');
      return resultado({});
    },
  });
  const { runner, logger, layout } = montar({ adapter });
  await runner.run(tasks);
  assert.ok(logger.stderr.includes('ruido no stderr do filho'));
  assert.ok(!layout.mensagens.some(([, t]) => t.includes('ruido no stderr do filho')));
});

test('o resumo final e exibido em todos os seis motivos de encerramento', async () => {
  const motivos: RunEndMotivo[] = [
    'fim_da_lista',
    'orcamento_da_janela',
    'limite_de_uso',
    'falha_na_task',
    'preflight_reprovado',
    'interrompido_pelo_usuario',
  ];
  for (const motivo of motivos) {
    const { runner, layout, logger } = montar();
    await runner.encerrar(motivo);
    assert.ok(Array.isArray(layout.resumo) && layout.resumo.length > 0, motivo);
    assert.ok(layout.resumo!.join('\n').includes(motivo));
    const runEnd = eventos(logger, 'run_end')[0];
    assert.equal(runEnd.motivo, motivo);
    assert.ok(motivos.includes(runEnd.motivo as RunEndMotivo));
    assert.equal(layout.disposeChamado, true);
  }
});

test('o resumo inclui o bloco de evidencias relacionando cada task ao seu session_id', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ sessionId: 'abc-123' });
    },
  });
  const { runner, layout } = montar({ adapter });
  await runner.run(tasks);
  await runner.encerrar('fim_da_lista');
  assert.ok(layout.resumo!.join('\n').includes('sessao=abc-123'));
});

test('o consumo do orcamento aparece no resumo apenas quando ha teto', async () => {
  const semTeto = montar();
  await semTeto.runner.encerrar('fim_da_lista');
  assert.ok(!semTeto.layout.resumo!.join('\n').includes('Orcamento janela'));

  const comTeto = montar({ windowBudgetTokens: 100000 });
  await comTeto.runner.encerrar('fim_da_lista');
  assert.ok(comTeto.layout.resumo!.join('\n').includes('Orcamento janela'));
});

test('interromper grava interrompido, anuncia o motivo e deixa o run_end para encerrar', async () => {
  const { runner, layout, logger, contextPack } = montar({ totalTasks: 3 });
  await runner.interromper();
  const interrompido = eventos(logger, 'interrompido')[0];
  assert.equal(interrompido.tasks_concluidas, 0);
  assert.equal(interrompido.total_tasks, 3);
  assert.equal(contextPack.chamadas.abort, 1);
  assert.ok(layout.mensagens.some(([k, t]) => k === 'aviso' && t === 'interrompido pelo usuario'));
  assert.ok(layout.mensagens.some(([k, t]) => k === 'info' && t.includes('concluidas')));

  // O motivo vem antes do resumo, que so e emitido por `encerrar` — chamado
  // pelo comando depois que `run()` devolve o controle.
  assert.equal(eventos(logger, 'run_end').length, 0);
  await runner.encerrar('interrompido_pelo_usuario');
  const runEnd = eventos(logger, 'run_end')[0];
  assert.equal(runEnd.motivo, 'interrompido_pelo_usuario');
  assert.equal(runEnd.tasks_executadas, 0);
  assert.ok(Array.isArray(layout.resumo));
});

test('a task morta pela interrupcao nao vira concluida nem gera end', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  let runnerRef: { interromper(): Promise<void> } | null = null;
  const adapter = fakeAdapter({
    async runTask() {
      // Simula o SIGINT que chega enquanto a CLI da task esta rodando.
      await runnerRef!.interromper();
      return resultado({});
    },
  });
  const montado = montar({ adapter, totalTasks: 2 });
  runnerRef = montado.runner;

  const motivo = await montado.runner.run(tasks);
  assert.equal(motivo, 'interrompido_pelo_usuario');
  assert.equal(eventos(montado.logger, 'end').length, 0);
  assert.equal(montado.adapter.chamadas.runTask, 1);

  await montado.runner.encerrar(motivo);
  assert.equal(eventos(montado.logger, 'run_end')[0].tasks_executadas, 0);
  assert.ok(montado.layout.resumo!.join('\n').includes('nenhuma task executada'));
});

test('--dry-run nao reconstroi o Contexto de Execucao', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const { runner, contextPack } = montar({
    opcoes: opcoes({ dryRun: true, contextPack: true }),
  });
  await runner.run(tasks);
  assert.equal(contextPack.chamadas.precisaReconstruir, 0);
  assert.equal(contextPack.chamadas.ensure, 0);
});

test('encerrar e idempotente', async () => {
  const { runner, logger } = montar();
  await runner.encerrar('fim_da_lista');
  await runner.encerrar('falha_na_task');
  assert.equal(eventos(logger, 'run_end').length, 1);
});

test('capacidade ausente desativa a funcionalidade com AVISO nominal', () => {
  const { opcoes: ajustadas, avisos } = ajustarPorCapacidades(
    opcoes({ windowBudgetTokens: 5000 }),
    { ...CAPACIDADES_LIGADAS, saidaEstruturadaComTokens: false },
    'Cursor'
  );
  assert.ok(avisos.length > 0);
  assert.equal(ajustadas.windowBudgetTokens, 0);
  assert.ok(avisos.some((a) => a.includes('nao reporta uso de tokens')));
});

test('opcao que depende de capacidade ausente e recusada com AVISO, sem abortar', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ contextPack: true }),
    { ...CAPACIDADES_LIGADAS, injecaoDeContextoNoSystemPrompt: false },
    'Kiro'
  );
  assert.equal(resultado.opcoes.contextPack, false);
  assert.ok(resultado.avisos.some((a) => a.includes('Contexto de Execucao')));
});

test('capacidades completas do ClaudeCode nao produzem aviso algum', () => {
  const entrada = opcoes({
    fallbackModel: 'opus',
    maxBudgetUsd: 5,
    windowBudgetTokens: 5000,
    skillDirs: false,
    cacheTuning: false,
  });
  const resultado = ajustarPorCapacidades(entrada, CAPACIDADES_LIGADAS, 'ClaudeCode');

  assert.deepEqual(resultado.avisos, []);
  assert.deepEqual(resultado.opcoes, entrada);
});

test('liberacaoDeDiretoriosDeLeitura ausente avisa sempre e uma unica vez', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ skillDirs: true }),
    { ...CAPACIDADES_LIGADAS, liberacaoDeDiretoriosDeLeitura: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, [
    'diretorios extras de skills ignorados: OpenCode nao libera diretorios de leitura',
  ]);
  assert.equal(resultado.opcoes.skillDirs, false);
});

test('liberacaoDeDiretoriosDeLeitura ausente com --no-skill-dirs acrescenta o aviso da opcao', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ skillDirs: false }),
    { ...CAPACIDADES_LIGADAS, liberacaoDeDiretoriosDeLeitura: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, [
    'diretorios extras de skills ignorados: OpenCode nao libera diretorios de leitura',
    '--no-skill-dirs ignorada: OpenCode nao oferece o recurso correspondente',
  ]);
});

test('modeloDeFallback ausente recusa --fallback-model uma unica vez', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ fallbackModel: 'opus' }),
    { ...CAPACIDADES_LIGADAS, modeloDeFallback: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, [
    '--fallback-model ignorada: OpenCode nao oferece o recurso correspondente',
  ]);
  assert.equal(resultado.opcoes.fallbackModel, '');
});

test('modeloDeFallback ausente sem --fallback-model nao produz aviso', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ fallbackModel: '' }),
    { ...CAPACIDADES_LIGADAS, modeloDeFallback: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, []);
});

test('otimizacaoDeCacheDePrompt ausente desliga o ajuste e avisa so com --no-cache-tuning', () => {
  const semOpcao = ajustarPorCapacidades(
    opcoes({ cacheTuning: true }),
    { ...CAPACIDADES_LIGADAS, otimizacaoDeCacheDePrompt: false },
    'OpenCode'
  );
  assert.deepEqual(semOpcao.avisos, []);
  assert.equal(semOpcao.opcoes.cacheTuning, false);

  const comOpcao = ajustarPorCapacidades(
    opcoes({ cacheTuning: false }),
    { ...CAPACIDADES_LIGADAS, otimizacaoDeCacheDePrompt: false },
    'OpenCode'
  );
  assert.deepEqual(comOpcao.avisos, [
    '--no-cache-tuning ignorada: OpenCode nao oferece o recurso correspondente',
  ]);
});

test('relatoDeCustoEmUSD ausente zera o teto de custo sem inventar mensagem', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ maxBudgetUsd: 5, windowBudgetTokens: 5000 }),
    { ...CAPACIDADES_LIGADAS, relatoDeCustoEmUSD: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, []);
  assert.equal(resultado.opcoes.maxBudgetUsd, 0);
  assert.equal(resultado.opcoes.windowBudgetTokens, 5000);
});

test('tetoDeCustoNativo ausente nao desativa --max-budget-usd nem avisa', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ maxBudgetUsd: 5 }),
    { ...CAPACIDADES_LIGADAS, tetoDeCustoNativo: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, []);
  assert.equal(resultado.opcoes.maxBudgetUsd, 5);
});

test('relatoDeNegacoesDePermissao ausente nao altera opcao nem produz aviso', () => {
  const entrada = opcoes({ maxBudgetUsd: 5, fallbackModel: 'opus' });
  const resultado = ajustarPorCapacidades(
    entrada,
    { ...CAPACIDADES_LIGADAS, relatoDeNegacoesDePermissao: false },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, []);
  assert.deepEqual(resultado.opcoes, entrada);
});

test('formaDeInjecaoSelecionavel presente nao altera opcao nem produz aviso', () => {
  const entrada = opcoes({ contextPack: true });
  const resultado = ajustarPorCapacidades(
    entrada,
    { ...CAPACIDADES_LIGADAS, formaDeInjecaoSelecionavel: true },
    'OpenCode'
  );

  assert.deepEqual(resultado.avisos, []);
  assert.deepEqual(resultado.opcoes, entrada);
});

test('--tasks referenciando numero inexistente e rejeitado com a mensagem nominal', () => {
  const td = new TaskDiscoveryService();
  assert.throws(
    () => td.expandSelection('9', [1, 2, 3, 4, 5]),
    /task 9 nao existe nesta feature \(disponiveis: 1-5\)/
  );
});

// --- Congelamento de contrato (RNF-001, task-1 de executar-tasks-opencode) ---
// O resumo e o evento `end` sao a saida visivel e o registro permanente da execucao
// com ClaudeCode. Ambos precisam permanecer identicos apos a generalizacao do caminho
// compartilhado para outras ferramentas.

function resultadoComTokens(): TaskResult {
  return resultado({ inputTokens: 1000, outputTokens: 200 });
}

async function executarLoteDeDuas(): Promise<{
  layout: ReturnType<typeof fakeLayout>;
  logger: ReturnType<typeof fakeLogger>;
  motivo: RunEndMotivo;
}> {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultadoComTokens();
    },
  });
  const { runner, layout, logger } = montar({ adapter });
  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);
  return { layout, logger, motivo };
}

test('o resumo final do TaskRunner com ClaudeCode congela linha a linha', async () => {
  const { layout, motivo } = await executarLoteDeDuas();

  assert.equal(motivo, 'fim_da_lista');
  assert.deepStrictEqual(layout.resumo, [
    '',
    'Resumo da execucao',
    '  Motivo             fim_da_lista',
    '  Tempo total        0s',
    '  Tasks executadas   2',
    '  Tasks com erro     0',
    '  Tokens totais      2.400',
    '  Raciocinio         nao reportado',
    '  Custo acumulado    $0.0000',
    '  Evidencias:',
    '    task-1  tempo=0s  sessao=sess-1  tokens=1200  turnos=3  neg=0  ctx=nao',
    '    task-2  tempo=0s  sessao=sess-1  tokens=1200  turnos=3  neg=0  ctx=nao',
  ]);
});

test('o evento end congela o conjunto de chaves e os valores gravados', async () => {
  const { logger } = await executarLoteDeDuas();
  const ends = eventos(logger, 'end');
  assert.equal(ends.length, 2);

  // `wall_seconds` mede tempo de parede e nao pode ser um literal estavel; e conferido
  // como numero e normalizado, de modo que o CONJUNTO de chaves siga congelado.
  const normalizados = ends.map((evento) => {
    assert.equal(typeof evento.wall_seconds, 'number');
    return { ...evento, wall_seconds: 0 };
  });

  const esperado = (task: string, acumulado: number): Record<string, unknown> => ({
    event: 'end',
    ts: '',
    task,
    tool: 'claudecode',
    model_solicitado: 'sonnet',
    modelos_reportados: 'claude-sonnet-4-5',
    effort: 'medium',
    session_id: 'sess-1',
    subtype: 'success',
    is_error: false,
    exit_code: 0,
    usou_contexto_execucao: false,
    permission_denials: 0,
    ferramentas_negadas: null,
    num_turns: 3,
    duration_ms: 100,
    duration_api_ms: 90,
    wall_seconds: 0,
    input_tokens: 1000,
    output_tokens: 200,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    reasoning_tokens: null,
    contabilidade_parcial: false,
    sem_certificacao: true,
    tokens_gastos_task: 1200,
    tokens_gastos_acumulado_depois: acumulado,
    tokens_disponiveis_depois: null,
    custo_task_usd: '0.0000',
    custo_acumulado_usd: '0.000000',
  });

  assert.deepStrictEqual(normalizados, [esperado('task-1.md', 1200), esperado('task-2.md', 2400)]);
});

// --- CT-030: forma de injecao do Contexto de Execucao ---

function fakeExecutorConfig() {
  const aplicados: Array<string | null> = [];
  const obj = {
    async aplicarDestilado(destiladoPath: string | null): Promise<void> {
      aplicados.push(destiladoPath);
    },
    async remover(): Promise<void> {},
  };
  return { obj, aplicados };
}

async function criarDestilado(conteudo: string): Promise<string> {
  const dir = path.join(os.tmpdir(), `pack-test-${process.pid}-${contadorTmp++}`);
  await fs.ensureDir(dir);
  const caminho = path.join(dir, 'contexto-execucao.md');
  await fs.writeFile(caminho, conteudo, 'utf-8');
  return caminho;
}

test('forma prompt concatena o destilado ao posicional da task (CT-030, CT-031)', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const caminho = await criarDestilado('CONTEUDO-DESTILADO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: caminho,
  });

  await runner.run(tasks);

  assert.equal(adapter.entradas[0].contextoExecucaoConteudo, 'CONTEUDO-DESTILADO');
  assert.equal(adapter.entradas[0].contextoExecucaoPath, caminho);
});

test('forma instructions nao toca no posicional e grava o arquivo de apoio (CT-030)', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const caminho = await criarDestilado('CONTEUDO-DESTILADO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const executor = fakeExecutorConfig();
  const { runner } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'instructions' }),
    packPathInicial: caminho,
    executorConfig: executor.obj,
  });

  await runner.run(tasks);

  assert.equal(adapter.entradas[0].contextoExecucaoConteudo, null);
  assert.equal(adapter.entradas[0].contextoExecucaoPath, caminho);
  assert.deepEqual(executor.aplicados, [caminho]);
});

test('as duas formas entregam o mesmo conteudo de contexto (RF-011)', async () => {
  const conteudo = 'MESMO-CONTEUDO';
  const caminho = await criarDestilado(conteudo);

  const adapterPrompt = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const alvoPrompt = montar({
    adapter: adapterPrompt,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: caminho,
  });
  await alvoPrompt.runner.run(await criarTasks([{ numero: 1, done: false }]));

  const adapterInstr = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const executor = fakeExecutorConfig();
  const alvoInstr = montar({
    adapter: adapterInstr,
    opcoes: opcoes({ contextInjection: 'instructions' }),
    packPathInicial: caminho,
    executorConfig: executor.obj,
  });
  await alvoInstr.runner.run(await criarTasks([{ numero: 1, done: false }]));

  assert.equal(adapterPrompt.entradas[0].contextoExecucaoConteudo, conteudo);
  assert.equal(await fs.readFile(executor.aplicados[0] as string, 'utf-8'), conteudo);
});

test('o destilado e lido uma vez por construcao, nao uma vez por task (passo 11)', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
    { numero: 3, done: false },
  ]);
  const caminho = await criarDestilado('PRIMEIRA-VERSAO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: caminho,
  });

  // O arquivo muda no disco sem que a deriva o reconstrua: as tres tasks devem
  // receber a mesma leitura, prova de que a leitura nao se repete por task.
  await fs.writeFile(caminho, 'SEGUNDA-VERSAO', 'utf-8');
  await runner.run(tasks);

  const conteudos = adapter.entradas
    .filter((e) => e.contextoExecucaoConteudo !== null)
    .map((e) => e.contextoExecucaoConteudo);
  assert.equal(adapter.chamadas.runTask, 3);
  assert.deepEqual([...new Set(conteudos)], ['SEGUNDA-VERSAO']);
});

test('--no-context-pack anula o efeito de --context-injection (CT-030)', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const executor = fakeExecutorConfig();
  const { runner } = montar({
    adapter,
    opcoes: opcoes({ contextPack: false, contextInjection: 'instructions' }),
    packPathInicial: null,
    executorConfig: executor.obj,
  });

  await runner.run(tasks);

  assert.equal(adapter.entradas[0].contextoExecucaoPath, null);
  assert.equal(adapter.entradas[0].contextoExecucaoConteudo, null);
  assert.deepEqual(executor.aplicados, [null]);
});

test('--context-injection e recusada com exatamente um aviso na ferramenta sem a capacidade (RF-009)', () => {
  const { opcoes: ajustado, avisos } = ajustarPorCapacidades(
    opcoes({ contextInjection: 'instructions' }),
    { ...CAPACIDADES_LIGADAS, formaDeInjecaoSelecionavel: false },
    'ClaudeCode'
  );

  const nominais = avisos.filter((a) => a.startsWith('--context-injection ignorada'));
  assert.deepEqual(nominais, [
    '--context-injection ignorada: ClaudeCode nao oferece o recurso correspondente',
  ]);
  assert.equal(ajustado.contextInjection, 'prompt');
});

test('a ferramenta sem a capacidade nao recebe o destilado no posicional (RF-009)', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const caminho = await criarDestilado('CONTEUDO-DESTILADO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: false } });
  const { runner } = montar({ adapter, packPathInicial: caminho });

  await runner.run(tasks);

  assert.equal(adapter.entradas[0].contextoExecucaoConteudo, null);
  assert.equal(adapter.entradas[0].contextoExecucaoPath, caminho);
});

test('falha de leitura do destilado degrada o lote com aviso, sem abortar', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner, layout } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: path.join(os.tmpdir(), 'inexistente-xyz', 'contexto-execucao.md'),
  });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 1);
  assert.equal(adapter.entradas[0].contextoExecucaoConteudo, null);
  assert.equal(adapter.entradas[0].contextoExecucaoPath, null);
  assert.ok(
    layout.mensagens.some(
      ([tipo, texto]) =>
        tipo === 'aviso' && texto === 'nao foi possivel ler o Contexto de Execucao - seguindo sem ele'
    )
  );
});

test('falha de gravacao do arquivo de apoio degrada o lote com aviso, sem abortar', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const caminho = await criarDestilado('CONTEUDO-DESTILADO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner, layout } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'instructions' }),
    packPathInicial: caminho,
    executorConfig: {
      async aplicarDestilado(): Promise<void> {
        throw new Error('disco cheio');
      },
      async remover(): Promise<void> {},
    },
  });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.entradas[0].contextoExecucaoPath, null);
  assert.ok(
    layout.mensagens.some(
      ([tipo, texto]) =>
        tipo === 'aviso' &&
        texto === 'nao foi possivel injetar o Contexto de Execucao - seguindo sem ele'
    )
  );
});

test('--dry-run exibe a contagem de bytes do destilado, nunca o conteudo (CT-030)', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const caminho = await criarDestilado('CONTEUDO-DESTILADO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner, layout } = montar({
    adapter,
    opcoes: opcoes({ dryRun: true, contextInjection: 'prompt' }),
    packPathInicial: caminho,
  });

  await runner.run(tasks);

  const linha = layout.mensagens.find(([, texto]) => texto.startsWith('dry-run: '));
  assert.ok(linha);
  assert.ok(linha[1].includes(`${tasks[0].caminho} + <contexto-execucao: 18 bytes>`));
  assert.ok(!linha[1].includes('CONTEUDO-DESTILADO'));
});

test('nova construcao do destilado provoca nova leitura (passo 11)', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const caminho = await criarDestilado('PRIMEIRA-VERSAO');
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: caminho,
  });

  await runner.run([tasks[0]]);
  await fs.writeFile(caminho, 'SEGUNDA-VERSAO', 'utf-8');
  runner.setPackPath(caminho);
  await runner.run([tasks[1]]);

  const conteudos = adapter.entradas
    .filter((e) => e.contextoExecucaoConteudo !== null)
    .map((e) => e.contextoExecucaoConteudo);
  assert.deepEqual(conteudos, ['PRIMEIRA-VERSAO', 'SEGUNDA-VERSAO']);
});

test('teto de custo ultrapassado encerra antes de iniciar a proxima task', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ costUsd: 2.1, inputTokens: 100 });
    },
  });
  const { runner, logger, layout } = montar({
    adapter,
    opcoes: opcoes({ maxBudgetUsd: 2 }),
  });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'orcamento_de_custo');
  assert.equal(adapter.chamadas.runTask, 1);
  const evento = eventos(logger, 'budget_exhausted')[0];
  assert.equal(evento.tipo, 'custo');
  assert.equal(evento.custo_acumulado_usd, 2.1);
  assert.equal(evento.max_budget_usd, 2);
  assert.equal(evento.proxima_task, 'task-2.md');
  assert.ok(
    layout.mensagens.some(
      ([kind, texto]) => kind === 'aviso' && texto === 'teto de custo ultrapassado antes de task-2'
    )
  );
});

test('lote que nao atinge o teto de custo executa tudo e nao emite o aviso', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ costUsd: 0.5, inputTokens: 100 });
    },
  });
  const { runner, logger, layout } = montar({
    adapter,
    opcoes: opcoes({ maxBudgetUsd: 2 }),
  });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 2);
  assert.equal(eventos(logger, 'budget_exhausted').length, 0);
  assert.equal(
    layout.mensagens.some(([, texto]) => texto.startsWith('teto de custo ultrapassado')),
    false
  );
});

test('sem --max-budget-usd a trava de custo nunca dispara, mesmo com custo acumulado', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ costUsd: 9.9, inputTokens: 100 });
    },
  });
  const { runner, logger } = montar({ adapter, opcoes: opcoes({ maxBudgetUsd: 0 }) });

  assert.equal(await runner.run(tasks), 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 2);
  assert.equal(eventos(logger, 'budget_exhausted').length, 0);
});

test('ferramenta sem relatoDeCustoEmUSD nao dispara a trava de custo', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    capacidades: { relatoDeCustoEmUSD: false },
    async runTask() {
      return resultado({ costUsd: 5, inputTokens: 100 });
    },
  });
  const { runner, logger } = montar({ adapter, opcoes: opcoes({ maxBudgetUsd: 2 }) });

  assert.equal(await runner.run(tasks), 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 2);
  assert.equal(eventos(logger, 'budget_exhausted').length, 0);
});

test('o aviso de custo nao reportado sai uma unica vez no encerramento', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ costUsd: 0, inputTokens: 1000 });
    },
  });
  const { runner, layout } = montar({ adapter, opcoes: opcoes({ maxBudgetUsd: 2 }) });

  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);
  await runner.encerrar(motivo);

  const avisos = layout.mensagens.filter(
    ([kind, texto]) =>
      kind === 'aviso' &&
      texto === 'o provedor configurado nao reportou custo - o teto de custo nao teve efeito neste lote'
  );
  assert.equal(avisos.length, 1);
});

test('sem consumo de tokens o aviso de custo nao reportado nao sai', async () => {
  const tasks = await criarTasks([{ numero: 1, done: true }]);
  const { runner, layout } = montar({ opcoes: opcoes({ maxBudgetUsd: 2 }) });

  await runner.encerrar(await runner.run(tasks));

  assert.equal(
    layout.mensagens.some(([, texto]) => texto.startsWith('o provedor configurado nao reportou custo')),
    false
  );
});

test('ferramenta que nao reporta negacoes de permissao nao emite o aviso', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    capacidades: { relatoDeNegacoesDePermissao: false },
    async runTask() {
      return resultado({ permissionDenials: 3 });
    },
  });
  const { runner, layout } = montar({ adapter });

  await runner.run(tasks);

  assert.equal(
    layout.mensagens.some(([, texto]) => texto.includes('permissao(oes) negada(s)')),
    false
  );
});

test('ferramenta que reporta negacoes de permissao mantem o aviso', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({
    async runTask() {
      return resultado({ permissionDenials: 3 });
    },
  });
  const { runner, layout } = montar({ adapter });

  await runner.run(tasks);

  assert.ok(
    layout.mensagens.some(
      ([kind, texto]) =>
        kind === 'aviso' &&
        texto === '3 permissao(oes) negada(s) - a task pode ter escrito codigo sem valida-lo'
    )
  );
});

test('o repasse de --max-budget-usd a CLI segue a capacidade tetoDeCustoNativo', () => {
  const opcs = opcoes({ maxBudgetUsd: 2, model: 'anthropic/claude-sonnet-4-5' });
  const entrada = {
    taskPath: '/projeto/specs/features/exemplo/task-1.md',
    opcoes: opcs,
    extraDirs: [],
    contextoExecucaoPath: null,
    contextoExecucaoConteudo: null,
  };

  const argsClaude = getAdapter('claudecode').buildTaskArgs(entrada as never);
  assert.equal(getCapabilities('claudecode').tetoDeCustoNativo, true);
  assert.equal(argsClaude.includes('--max-budget-usd'), true);
  assert.equal(argsClaude[argsClaude.indexOf('--max-budget-usd') + 1], '2');

  const argsOpenCode = getAdapter('opencode').buildTaskArgs(entrada as never);
  assert.equal(getCapabilities('opencode').tetoDeCustoNativo, false);
  assert.equal(argsOpenCode.includes('--max-budget-usd'), false);
});

/** Capacidades da coluna OpenCode da tabela de CT-038. */
const CAPACIDADES_OPENCODE: ToolCapabilities = {
  execucaoNaoInterativa: true,
  modoSemPromptDePermissao: true,
  saidaEstruturadaComTokens: true,
  identificadorDeSessao: true,
  injecaoDeContextoNoSystemPrompt: true,
  liberacaoDeDiretoriosDeLeitura: false,
  consultaAosMcps: true,
  relatoDeCustoEmUSD: true,
  tetoDeCustoNativo: false,
  modeloDeFallback: false,
  otimizacaoDeCacheDePrompt: false,
  relatoDeNegacoesDePermissao: false,
  formaDeInjecaoSelecionavel: true,
  relatoDeModeloEfetivo: false,
};

const OPCOES_OPENCODE = {
  tool: 'opencode' as const,
  model: 'zai/glm-4.6',
  packModel: 'zai/glm-4.6',
  contextInjection: 'instructions' as const,
};

function resultadoOpenCode(over: Partial<TaskResult> = {}): TaskResult {
  return resultado({
    sessionId: 'ses_fa1d4c6a3ffeQm9B2oAqGRSbGF',
    model: 'zai/glm-4.6',
    modelosReportados: 'zai/glm-4.6',
    inputTokens: 13176,
    outputTokens: 8,
    cacheReadInputTokens: 1280,
    reasoningTokens: 69,
    permissionDenials: null,
    ...over,
  });
}

test('execucao com OpenCode nao deixa a palavra da outra ferramenta na saida nem no registro', async () => {
  const acumulado: string[] = [];

  const tasks = await criarTasks([{ numero: 1, done: false }, { numero: 2, done: false }]);
  const adapter = fakeAdapter({
    capacidades: CAPACIDADES_OPENCODE,
    runTask: async () =>
      adapter.chamadas.runTask === 1
        ? resultadoOpenCode({ contabilidadeParcial: true })
        : resultadoOpenCode({ isError: true, subtype: 'error', exitCode: 1, sessionId: '' }),
  });
  const executado = montar({
    adapter,
    ferramenta: 'opencode',
    opcoes: opcoes({ ...OPCOES_OPENCODE }),
  });

  await executado.runner.run(tasks);

  const secas = await criarTasks([{ numero: 1, done: false }]);
  const seco = montar({
    adapter: fakeAdapter({ capacidades: CAPACIDADES_OPENCODE }),
    ferramenta: 'opencode',
    opcoes: opcoes({ ...OPCOES_OPENCODE, dryRun: true }),
  });

  await seco.runner.run(secas);

  for (const alvo of [executado, seco]) {
    for (const [kind, texto] of alvo.layout.mensagens) {
      acumulado.push(kind, texto);
    }
    acumulado.push(...(alvo.layout.resumo ?? []));
    acumulado.push(...alvo.logger.stderr);
    for (const evento of alvo.logger.eventos) {
      acumulado.push(JSON.stringify(evento));
    }
  }

  const tudo = acumulado.join('\n');

  assert.ok(tudo.length > 0, 'o lote precisa ter produzido saida para o teste ter valor');
  assert.ok(/dry-run: opencode run/.test(tudo), 'o dry-run precisa exibir o executavel do OpenCode');
  assert.ok(/terminou com erro/.test(tudo), 'o lote precisa ter exercitado o caminho de erro');
  assert.equal(/claude/i.test(tudo), false, `a palavra da outra ferramenta vazou: ${tudo}`);
});

test('reconstrucao por deriva no meio do lote entrega o destilado NOVO as tasks seguintes', async () => {
  const dir = path.join(os.tmpdir(), `task-runner-deriva-${process.pid}-${Date.now()}`);
  await fs.ensureDir(dir);
  const antigo = path.join(dir, 'antigo.md');
  const novo = path.join(dir, 'novo.md');
  await fs.writeFile(antigo, 'DESTILADO-ANTIGO');
  await fs.writeFile(novo, 'DESTILADO-NOVO');

  // Deriva apenas antes da segunda task: e o caso em que a atribuicao direta de
  // `packPath` atualizava o arquivo e deixava o conteudo velho no prompt.
  let vez = 0;
  const contextPack = fakeContextPack({
    async precisaReconstruir() {
      vez += 1;
      return { reconstruir: vez === 2, motivo: 'fonte_mais_recente', fonteAlterada: 'prd.md' };
    },
    caminhoParaInjecao() {
      return novo;
    },
  });

  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner } = montar({
    adapter,
    contextPack,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: antigo,
  });

  await runner.run(await criarTasks([{ numero: 1, done: false }, { numero: 2, done: false }]));

  const conteudos = adapter.entradas.map((e) => e.contextoExecucaoConteudo);
  assert.equal(conteudos[0], 'DESTILADO-ANTIGO');
  assert.equal(conteudos[conteudos.length - 1], 'DESTILADO-NOVO');
  assert.equal(adapter.entradas[adapter.entradas.length - 1].contextoExecucaoPath, novo);

  await fs.remove(dir);
});

test('destilado que so passou a existir na reconstrucao chega a task e conta como contexto usado', async () => {
  const dir = path.join(os.tmpdir(), `task-runner-deriva2-${process.pid}-${Date.now()}`);
  await fs.ensureDir(dir);
  const novo = path.join(dir, 'novo.md');
  await fs.writeFile(novo, 'DESTILADO-NOVO');

  // Primeira construcao falhou (`caminhoParaInjecao` -> null); a segunda deu certo.
  let vez = 0;
  const contextPack = fakeContextPack({
    async precisaReconstruir() {
      vez += 1;
      return { reconstruir: vez === 2, motivo: 'fonte_mais_recente', fonteAlterada: 'prd.md' };
    },
    caminhoParaInjecao() {
      return novo;
    },
  });

  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner, logger } = montar({
    adapter,
    contextPack,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: null,
  });

  await runner.run(await criarTasks([{ numero: 1, done: false }, { numero: 2, done: false }]));

  const starts = logger.eventos.filter((e) => e.event === 'start');
  assert.equal(starts[0].usou_contexto_execucao, false);
  assert.equal(starts[1].usou_contexto_execucao, true);
  assert.equal(adapter.entradas[adapter.entradas.length - 1].contextoExecucaoConteudo, 'DESTILADO-NOVO');

  await fs.remove(dir);
});

test('caminho conhecido mas ilegivel nao e contado como contexto usado na forma prompt', async () => {
  const adapter = fakeAdapter({ capacidades: { formaDeInjecaoSelecionavel: true } });
  const { runner, logger } = montar({
    adapter,
    opcoes: opcoes({ contextInjection: 'prompt' }),
    packPathInicial: path.join(os.tmpdir(), `inexistente-${process.pid}-${Date.now()}.md`),
  });

  await runner.run(await criarTasks([{ numero: 1, done: false }]));

  const start = logger.eventos.find((e) => e.event === 'start');
  assert.equal(start?.usou_contexto_execucao, false);
});

// ---------------------------------------------------------------------------
// task-9 — deteccao restrita a falha, laco de espera e renovacao da janela
// (RF-014, RF-016 a RF-020). Relogio e espera falsos: nenhum teste aguarda
// tempo real (RNF-006).
// ---------------------------------------------------------------------------

test('(RF-014) task bem-sucedida cujo texto menciona limite de uso nao dispara espera', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    detectRateLimit: () => true,
    async runTask() {
      return resultado({ isError: false, exitCode: 0, rawStdout: 'rate limit mentioned here' });
    },
  });
  const espera = fakeEspera();
  const { runner, logger } = montar({ adapter, espera });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(espera.chamadas.length, 0);
  assert.equal(eventos(logger, 'rate_limited').length, 0);
  assert.equal(adapter.chamadas.runTask, 2);
});

test('(RF-017) task barrada e retomada conta uma vez, produz uma evidencia e soma os tokens', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  let chamada = 0;
  const adapter = fakeAdapter({
    detectRateLimit: (): boolean => chamada === 1,
    async runTask() {
      chamada += 1;
      if (chamada === 1) {
        return resultado({
          isError: true,
          exitCode: 1,
          inputTokens: 15000,
          rawStderr: 'Claude usage limit reached',
        });
      }
      return resultado({ isError: false, exitCode: 0, inputTokens: 5000 });
    },
  });
  const { runner, logger, layout, accounting, espera } = montar({ adapter });

  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 2);
  assert.equal(espera.chamadas.length, 1);
  // Uma unica execucao contabilizada e um unico `end`.
  assert.equal(eventos(logger, 'end').length, 1);
  const runEnd = eventos(logger, 'run_end')[0];
  assert.equal(runEnd.tasks_executadas, 1);
  assert.equal(runEnd.tasks_com_erro, 0);
  // Uma unica linha de evidencia.
  const evidencias = layout.resumo!.filter((linha) => linha.includes('sessao='));
  assert.equal(evidencias.length, 1);
  // Os tokens da tentativa barrada estao somados ao total do lote.
  assert.equal(accounting.total.tokensGastosAcumulado, 20000);
  assert.equal(runEnd.tokens_gastos_total, 20000);
});

test('(RF-019) a janela renovada na retomada nao encerra o lote e o resumo segue somando tudo', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const accounting = new AccountingService();
  // 890.000 de um teto de 900.000 ja consumidos antes do lote.
  accounting.accumulate(resultado({ inputTokens: 890000 }));

  let chamada = 0;
  const adapter = fakeAdapter({
    detectRateLimit: (): boolean => chamada === 1,
    async runTask() {
      chamada += 1;
      if (chamada === 1) {
        return resultado({
          isError: true,
          exitCode: 1,
          inputTokens: 20000,
          rawStderr: 'weekly limit reached',
        });
      }
      return resultado({ isError: false, exitCode: 0, inputTokens: 1000 });
    },
  });
  const { runner, logger } = montar({
    adapter,
    accounting,
    opcoes: opcoes({ windowBudgetTokens: 900000 }),
    windowBudgetTokens: 900000,
  });

  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);

  // Nenhum encerramento por teto de janela: as duas tasks rodaram.
  assert.equal(motivo, 'fim_da_lista');
  assert.equal(eventos(logger, 'budget_exhausted').length, 0);
  assert.equal(eventos(logger, 'end').length, 2);
  // O resumo continua reportando o lote inteiro: 890.000 + 20.000 + 1.000 + 1.000.
  assert.equal(eventos(logger, 'run_end')[0].tokens_gastos_total, 912000);
  // A retomada registrou a renovacao da janela.
  assert.equal(eventos(logger, 'rate_limited')[0].tentativa, 1);
});

test('(RF-010) o resumo apresenta o tempo total e o tempo em espera apenas quando houve espera', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  let chamada = 0;
  const relogio = fakeRelogio();
  const adapter = fakeAdapter({
    detectRateLimit: (): boolean => chamada === 1,
    async runTask() {
      chamada += 1;
      relogio.avancar(72000);
      if (chamada === 1) {
        return resultado({ isError: true, exitCode: 1, rawStderr: 'session limit' });
      }
      return resultado({});
    },
  });
  const espera = fakeEspera({ esperaSegundos: 8100, aoAguardar: () => relogio.avancar(8100000) });
  const { runner, logger, layout } = montar({ adapter, espera, relogio });

  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);

  const texto = layout.resumo!.join('\n');
  // 72 s da tentativa barrada + 8100 s de espera + 72 s da tentativa que executou.
  assert.ok(texto.includes('Tempo total        2h 17m'), texto);
  assert.ok(texto.includes('Tempo em espera    2h 15m'), texto);
  // A evidencia traz o tempo da tentativa que produziu o `end`, e so ele.
  assert.ok(texto.includes('tempo=1m 12s  sessao='), texto);
  const runEnd = eventos(logger, 'run_end')[0];
  assert.equal(runEnd.tempo_em_espera_segundos, 8100);
  assert.equal(runEnd.tempo_total_segundos, 8244);
});

test('(RF-010) sem espera o resumo nao apresenta a linha de tempo em espera', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const { runner, layout, logger } = montar();
  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);

  assert.ok(!layout.resumo!.join('\n').includes('Tempo em espera'));
  assert.equal(eventos(logger, 'run_end')[0].tempo_em_espera_segundos, 0);
});

test('(RF-020) a desistencia encerra com limite_de_uso, resumo parcial e sem contabilizar a barrada', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    detectRateLimit: () => true,
    async runTask() {
      return resultado({ isError: true, exitCode: 1, inputTokens: 3000, rawStderr: 'usage limit' });
    },
  });
  const espera = fakeEspera({
    decisoes: [
      { retomar: false, motivoDaDesistencia: 'teto de espera de 6h esgotado sem renovacao da cota' },
    ],
  });
  const { runner, logger, layout } = montar({ adapter, espera });

  const motivo = await runner.run(tasks);
  await runner.encerrar(motivo);

  assert.equal(motivo, 'limite_de_uso');
  // A segunda task nunca foi iniciada.
  assert.equal(adapter.chamadas.runTask, 1);

  const runEnd = eventos(logger, 'run_end')[0];
  assert.equal(runEnd.motivo, 'limite_de_uso');
  // RF-017: a barrada nao e executada nem erro; os tokens, sim, sao somados.
  assert.equal(runEnd.tasks_executadas, 0);
  assert.equal(runEnd.tasks_com_erro, 0);
  assert.equal(runEnd.tokens_gastos_total, 3000);

  // Resumo parcial impresso, com o motivo da desistencia anunciado em tela.
  const texto = layout.resumo!.join('\n');
  assert.ok(texto.includes('limite_de_uso'), texto);
  assert.ok(texto.includes('nenhuma task executada'), texto);
  assert.ok(
    layout.mensagens.some(
      ([kind, msg]) =>
        kind === 'aviso' && msg.includes('teto de espera de 6h esgotado sem renovacao da cota')
    )
  );
});

test('(RF-018) o aviso de trabalho parcial precede a reexecucao, nomeando task e tentativa', async () => {
  const tasks = await criarTasks([{ numero: 7, done: false }]);
  let chamada = 0;
  const adapter = fakeAdapter({
    detectRateLimit: (): boolean => chamada <= 2,
    async runTask() {
      chamada += 1;
      if (chamada < 3) {
        return resultado({ isError: true, exitCode: 1, rawStderr: 'usage limit' });
      }
      return resultado({});
    },
  });
  const { runner, layout } = montar({ adapter, totalTasks: 1 });

  await runner.run(tasks);

  const avisos = layout.mensagens
    .filter(([kind, msg]) => kind === 'aviso' && msg.includes('trabalho parcial'))
    .map(([, msg]) => msg);
  assert.deepStrictEqual(avisos, [
    'task-7 [1/1]: tentativa 2 - a tentativa anterior foi interrompida por limite de uso e pode ter deixado trabalho parcial no diretorio',
    'task-7 [1/1]: tentativa 3 - a tentativa anterior foi interrompida por limite de uso e pode ter deixado trabalho parcial no diretorio',
  ]);
  // A primeira tentativa nao e precedida do aviso.
  assert.equal(adapter.chamadas.runTask, 3);
});

test('(RF-025) a ordem dos eventos de uma espera bem-sucedida e rate_limited, aguardando_limite, retomada, end', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const logger = fakeLogger();
  let chamada = 0;
  const adapter = fakeAdapter({
    detectRateLimit: (): boolean => chamada === 1,
    async runTask() {
      chamada += 1;
      if (chamada === 1) {
        return resultado({ isError: true, exitCode: 1, rawStderr: 'usage limit' });
      }
      return resultado({});
    },
  });
  // A espera falsa grava os mesmos dois eventos que o servico real grava.
  const espera = fakeEspera({
    aoAguardar: () => {
      void logger.obj.logEvent({ event: 'aguardando_limite' } as never);
      void logger.obj.logEvent({ event: 'retomada' } as never);
    },
  });
  const { runner } = montar({ adapter, espera, logger });

  await runner.run(tasks);

  const ordem = logger.eventos
    .map((e) => e.event)
    .filter((e) => ['rate_limited', 'aguardando_limite', 'retomada', 'end'].includes(e as string));
  assert.deepStrictEqual(ordem, ['rate_limited', 'aguardando_limite', 'retomada', 'end']);
});

test('(CT-043) o evento rate_limited carrega tentativa, renovacao prevista, origem e contexto', async () => {
  const tasks = await criarTasks([{ numero: 3, done: false }]);
  // O relogio falso comeca 1h antes do instante informado: mais distante que o
  // teto absoluto de 12h, `determinarRenovacao` devolveria `null` (RNF-007).
  const relogio = fakeRelogio((1789574400 - 3600) * 1000);
  const adapter = fakeAdapter({
    detectRateLimit: () => true,
    async runTask() {
      return resultado({
        isError: true,
        exitCode: 1,
        rawStderr: 'Claude usage limit reached. resets at 1789574400',
      });
    },
  });
  const espera = fakeEspera({
    decisoes: [{ retomar: false, motivoDaDesistencia: 'teto esgotado' }],
  });
  const { runner, logger } = montar({ adapter, espera, relogio });

  await runner.run(tasks);

  const rate = eventos(logger, 'rate_limited')[0];
  assert.equal(rate.task, 'task-3.md');
  assert.equal(rate.tentativa, 1);
  assert.equal(rate.contexto, 'task');
  assert.equal(rate.origem_horario, 'informado');
  assert.equal(rate.renovacao_prevista, new Date(1789574400 * 1000).toISOString());
});

test('(RF-024) a interrupcao durante a espera segue o caminho de encerramento por interrupcao', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    detectRateLimit: () => true,
    async runTask() {
      return resultado({ isError: true, exitCode: 1, rawStderr: 'usage limit' });
    },
  });
  const alvo: { runner: { interromper(): Promise<void> } | null } = { runner: null };
  const espera = fakeEspera({
    aoAguardar: () => {
      void alvo.runner!.interromper();
    },
  });
  const montado = montar({ adapter, espera });
  alvo.runner = montado.runner as never;

  const motivo = await montado.runner.run(tasks);
  await montado.runner.encerrar(motivo);

  assert.equal(motivo, 'interrompido_pelo_usuario');
  assert.equal(adapter.chamadas.runTask, 1);
  // Cursor restaurado, encerramento registrado e resumo parcial impresso.
  assert.equal(montado.layout.disposeChamado, true);
  assert.equal(eventos(montado.logger, 'interrompido').length, 1);
  assert.equal(eventos(montado.logger, 'run_end')[0].motivo, 'interrompido_pelo_usuario');
  assert.ok(Array.isArray(montado.layout.resumo));
});

test('(caso 7) task que falha sem texto de limite segue o caminho de erro vigente', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
  ]);
  const adapter = fakeAdapter({
    detectRateLimit: () => false,
    async runTask() {
      return resultado({ isError: true, exitCode: 1, subtype: 'parse_error' });
    },
  });
  const espera = fakeEspera();
  const semParar = montar({ adapter, espera });
  const motivo = await semParar.runner.run(tasks);
  await semParar.runner.encerrar(motivo);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(espera.chamadas.length, 0);
  assert.equal(eventos(semParar.logger, 'run_end')[0].tasks_com_erro, 2);

  const comParar = montar({
    adapter: fakeAdapter({
      detectRateLimit: () => false,
      async runTask() {
        return resultado({ isError: true, exitCode: 1, subtype: 'parse_error' });
      },
    }),
    opcoes: opcoes({ stopOnFailure: true }),
  });
  assert.equal(await comParar.runner.run(tasks), 'falha_na_task');
});

test('(caso 28) em --dry-run nenhuma deteccao de limite ocorre', async () => {
  const tasks = await criarTasks([{ numero: 1, done: false }]);
  const adapter = fakeAdapter({ detectRateLimit: () => true });
  const espera = fakeEspera();
  const { runner, logger } = montar({ adapter, espera, opcoes: opcoes({ dryRun: true }) });

  const motivo = await runner.run(tasks);

  assert.equal(motivo, 'fim_da_lista');
  assert.equal(adapter.chamadas.runTask, 0);
  assert.equal(espera.chamadas.length, 0);
  assert.equal(eventos(logger, 'rate_limited').length, 0);
});
