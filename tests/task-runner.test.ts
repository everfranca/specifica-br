import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { TaskRunner, ajustarPorCapacidades } from '../dist/utils/task-runner.js';
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
    packModel: 'sonnet',
    packEffort: 'low',
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
    permissionDenials: 0,
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
}

function fakeAdapter(over: AdapterOver = {}) {
  const chamadas = { runTask: 0 };
  const obj = {
    capacidades: { ...CAPACIDADES_LIGADAS },
    buildTaskArgs() {
      return ['-p', '/executar-task x'];
    },
    async runTask(e: unknown, cwd: string, onStderr?: (c: string) => void) {
      chamadas.runTask += 1;
      if (over.runTask) {
        return over.runTask(e, cwd, onStderr);
      }
      return resultado({});
    },
    detectRateLimit() {
      return over.detectRateLimit ? over.detectRateLimit() : false;
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
}

function montar(m: MontarOpcoes = {}) {
  const layout = fakeLayout();
  const logger = fakeLogger();
  const adapter = m.adapter ?? fakeAdapter();
  const contextPack = m.contextPack ?? fakeContextPack();
  const accounting = m.accounting ?? new AccountingService();
  const opcs = m.opcoes ?? opcoes();
  const runner = new TaskRunner({
    adapter: adapter.obj as never,
    contextPack: contextPack.obj as never,
    accounting,
    logger: logger.obj as never,
    layout: layout.obj as never,
    opcoes: opcs,
    ferramenta: 'claudecode',
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
        packModel: opcs.packModel,
        packEffort: opcs.packEffort,
        packMaxTokens: opcs.packMaxTokens,
        cacheTuning: opcs.cacheTuning,
      },
    } as never,
    windowBudgetTokens: m.windowBudgetTokens ?? opcs.windowBudgetTokens,
    packPathInicial: null,
    totalTasks: m.totalTasks ?? 0,
  });
  return { runner, layout, logger, adapter, contextPack, accounting };
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

test('limite de uso encerra o lote imediatamente', async () => {
  const tasks = await criarTasks([
    { numero: 1, done: false },
    { numero: 2, done: false },
    { numero: 3, done: false },
    { numero: 4, done: false },
  ]);
  const adapter = fakeAdapter({ detectRateLimit: () => true });
  const { runner, logger } = montar({ adapter });
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
    'cursor'
  );
  assert.ok(avisos.length > 0);
  assert.equal(ajustadas.windowBudgetTokens, 0);
  assert.ok(avisos.some((a) => a.includes('nao reporta uso de tokens')));
});

test('opcao que depende de capacidade ausente e recusada com AVISO, sem abortar', () => {
  const resultado = ajustarPorCapacidades(
    opcoes({ contextPack: true }),
    { ...CAPACIDADES_LIGADAS, injecaoDeContextoNoSystemPrompt: false },
    'kiro'
  );
  assert.equal(resultado.opcoes.contextPack, false);
  assert.ok(resultado.avisos.some((a) => a.includes('Contexto de Execucao')));
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
    '  Tasks executadas   2',
    '  Tasks com erro     0',
    '  Tokens totais      2.400',
    '  Custo acumulado    $0.0000',
    '  Evidencias:',
    '    task-1  sessao=sess-1  tokens=1200  turnos=3  neg=0  ctx=nao',
    '    task-2  sessao=sess-1  tokens=1200  turnos=3  neg=0  ctx=nao',
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
    sem_certificacao: true,
    tokens_gastos_task: 1200,
    tokens_gastos_acumulado_depois: acumulado,
    tokens_disponiveis_depois: null,
    custo_task_usd: '0.0000',
    custo_acumulado_usd: '0.000000',
  });

  assert.deepStrictEqual(normalizados, [esperado('task-1.md', 1200), esperado('task-2.md', 2400)]);
});
