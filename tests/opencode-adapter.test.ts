import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

import { OpenCodeAdapter } from '../dist/utils/tool-adapters/opencode-adapter.js';
import { ClaudeCodeAdapter } from '../dist/utils/tool-adapters/claude-code-adapter.js';
import { OpenCodeExecutorConfigService } from '../dist/utils/opencode-executor-config.js';
import type { EffortLevel, ExecutarTasksOptions } from '../dist/types/executar-tasks.js';
import type { BuildContextPackArgsInput, BuildTaskArgsInput } from '../dist/types/tool-adapter.js';

interface FakeRunnerCall {
  cmd: string;
  args: string[];
  opts: Record<string, unknown>;
}

interface FakeResposta {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  spawnFailed?: boolean;
  primeiraLinha?: string;
}

function fakeRunner(respostas: FakeResposta | FakeResposta[]) {
  const fila = Array.isArray(respostas) ? [...respostas] : [respostas];
  const calls: FakeRunnerCall[] = [];

  const proxima = (): FakeResposta => (fila.length > 1 ? (fila.shift() as FakeResposta) : fila[0]);

  return {
    calls,
    async run(cmd: string, args: string[], opts: Record<string, unknown>) {
      calls.push({ cmd, args, opts });
      const resposta = proxima();
      return {
        exitCode: resposta.exitCode ?? 0,
        signal: null,
        stdout: resposta.stdout ?? '',
        stderr: resposta.stderr ?? '',
        timedOut: resposta.timedOut ?? false,
        spawnFailed: resposta.spawnFailed ?? false,
      };
    },
    async runCapturingFirstLine(cmd: string, args: string[], opts: Record<string, unknown>) {
      calls.push({ cmd, args, opts });
      return proxima().primeiraLinha ?? '';
    },
  };
}

function opcoesBase(over: Partial<ExecutarTasksOptions> = {}): ExecutarTasksOptions {
  return {
    tool: 'opencode',
    model: 'anthropic/claude-sonnet-4-5',
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
    packModel: 'anthropic/claude-haiku-4-5',
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

function entradaDeTask(over: Partial<BuildTaskArgsInput> = {}): BuildTaskArgsInput {
  return {
    taskPath: '/projeto/specs/features/exemplo/task-1.md',
    opcoes: opcoesBase(),
    extraDirs: [],
    contextoExecucaoPath: null,
    contextoExecucaoConteudo: null,
    ...over,
  };
}

function entradaDePack(over: Partial<BuildContextPackArgsInput> = {}): BuildContextPackArgsInput {
  return {
    featureDir: '/projeto/specs/features/exemplo',
    packModel: 'anthropic/claude-haiku-4-5',
    packEffort: 'low',
    cacheTuning: true,
    ...over,
  };
}

function novoAdapter(
  runner: ReturnType<typeof fakeRunner> = fakeRunner({}),
  onAviso: (mensagem: string) => void = () => undefined
): OpenCodeAdapter {
  return new OpenCodeAdapter(runner as never, new OpenCodeExecutorConfigService(), onAviso);
}

const NDJSON_DOIS_PASSOS = [
  '{"type":"step_start","timestamp":1788286294193,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"id":"prt_1","type":"step-start"}}',
  '{"type":"text","timestamp":1788286294500,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"type":"text","text":"ABACAXI-42"}}',
  '{"type":"step_finish","timestamp":1788286295120,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"type":"step-finish","reason":"stop","tokens":{"total":14533,"input":13176,"output":8,"reasoning":69,"cache":{"write":0,"read":1280}},"cost":0.0021}}',
  '{"type":"step_finish","timestamp":1788286296000,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"type":"step-finish","reason":"stop","tokens":{"total":14737,"input":6930,"output":14,"reasoning":241,"cache":{"write":7552,"read":0}},"cost":0.0013}}',
  '',
].join('\n');

const NDJSON_UM_PASSO = [
  '{"type":"step_start","timestamp":1788286294193,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"type":"step-start"}}',
  '{"type":"step_finish","timestamp":1788286295120,"sessionID":"ses_fa1d4c6a3ffeQm9B2oAqGRSbGF","part":{"type":"step-finish","reason":"stop","tokens":{"total":14533,"input":13176,"output":8,"reasoning":69,"cache":{"write":0,"read":1280}},"cost":0}}',
].join('\n');

const ESC = '';

const SAIDA_MCP_LIST = [
  `${ESC}[0m`,
  '┌  MCP Servers',
  '│',
  `●  ✓ context7 ${ESC}[90mconnected`,
  `│      ${ESC}[90mhttps://mcp.context7.com/mcp`,
  '│',
  `●  ✓ playwright ${ESC}[90mconnected`,
  `│      ${ESC}[90mnpx @playwright/mcp@latest`,
  '│',
  `●  ✗ quebrado ${ESC}[90mfailed`,
  '│      Executable not found in $PATH: "comando-que-nao-existe-xyz"',
  '│',
  '└  3 server(s)',
].join('\n');

test('buildTaskArgs produz a ordem exata de CT-031', () => {
  const args = novoAdapter().buildTaskArgs(entradaDeTask());

  assert.deepEqual(args, [
    'run',
    '--command',
    'executar-task',
    '--format',
    'json',
    '--model',
    'anthropic/claude-sonnet-4-5',
    '--agent',
    'specifica-executor',
    '--auto',
    '/projeto/specs/features/exemplo/task-1.md',
  ]);
});

test('buildTaskArgs concatena o destilado ao posicional como um unico elemento de argv', () => {
  const args = novoAdapter().buildTaskArgs(
    entradaDeTask({ contextoExecucaoConteudo: '# Contexto\nlinha' })
  );

  assert.equal(args.length, 11);
  assert.equal(args[10], '/projeto/specs/features/exemplo/task-1.md\n\n# Contexto\nlinha');
});

test('buildContextPackArgs e identico a CT-031 menos --command, com o prompt no posicional', () => {
  const args = novoAdapter().buildContextPackArgs('PROMPT', entradaDePack());

  assert.deepEqual(args, [
    'run',
    '--format',
    'json',
    '--model',
    'anthropic/claude-haiku-4-5',
    '--agent',
    'specifica-executor',
    '--auto',
    '--variant',
    'minimal',
    'PROMPT',
  ]);
});

test('o mapeamento de esforco cobre os cinco niveis de CT-031', () => {
  const adapter = novoAdapter();
  const variante = (effort: EffortLevel): string | null => {
    const args = adapter.buildTaskArgs(entradaDeTask({ opcoes: opcoesBase({ effort }) }));
    const indice = args.indexOf('--variant');
    return indice === -1 ? null : args[indice + 1];
  };

  assert.equal(variante('low'), 'minimal');
  assert.equal(variante('medium'), null);
  assert.equal(variante('high'), 'high');
  assert.equal(variante('xhigh'), 'high');
  assert.equal(variante('max'), 'max');
});

test('nenhuma flag da lista de nao emitidos de CT-031 aparece no argv', () => {
  const adapter = novoAdapter();
  const proibidas = [
    '--add-dir',
    '--allowedTools',
    '--fallback-model',
    '--max-budget-usd',
    '--append-system-prompt-file',
    '--exclude-dynamic-system-prompt-sections',
    '-c',
    '-s',
    '--fork',
    '--file',
    '--dir',
    '--interactive',
    '--dangerously-skip-permissions',
    '--thinking',
  ];

  const opcoes = opcoesBase({
    effort: 'max',
    fallbackModel: 'anthropic/claude-haiku-4-5',
    maxBudgetUsd: 12,
    allow: ['Read', 'Bash(git commit:*)'],
    permissionMode: 'bypassPermissions',
  });

  const args = [
    ...adapter.buildTaskArgs(
      entradaDeTask({
        opcoes,
        extraDirs: ['/home/u/.claude/skills'],
        contextoExecucaoPath: '/projeto/specs/features/exemplo/contexto-execucao.md',
      })
    ),
    ...adapter.buildContextPackArgs('PROMPT', entradaDePack()),
  ];

  for (const flag of proibidas) {
    assert.equal(args.includes(flag), false, `flag proibida no argv: ${flag}`);
  }
});

test('parseResult soma os componentes de todos os step_finish do NDJSON', () => {
  const resultado = novoAdapter().parseResult(0, NDJSON_DOIS_PASSOS, '');

  assert.equal(resultado.sessionId, 'ses_fa1d4c6a3ffeQm9B2oAqGRSbGF');
  assert.equal(resultado.subtype, 'success');
  assert.equal(resultado.isError, false);
  assert.equal(resultado.numTurns, 2);
  assert.equal(resultado.inputTokens, 13176 + 6930);
  assert.equal(resultado.outputTokens, 8 + 14);
  assert.equal(resultado.cacheCreationInputTokens, 7552);
  assert.equal(resultado.cacheReadInputTokens, 1280);
  assert.equal(resultado.reasoningTokens, 69 + 241);
  assert.equal(resultado.costUsd, 0.0021 + 0.0013);
  assert.equal(resultado.durationMs, 1788286296000 - 1788286294193);
  assert.equal(resultado.durationApiMs, 0);
  assert.equal(resultado.permissionDenials, null);
  assert.equal(resultado.ferramentasNegadas, null);
  assert.equal(resultado.contabilidadeParcial, false);
});

test('parseResult de um unico step_finish confere com o schema de saida da task', () => {
  const resultado = novoAdapter().parseResult(0, NDJSON_UM_PASSO, '');

  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.inputTokens, 13176);
  assert.equal(resultado.outputTokens, 8);
  assert.equal(resultado.cacheCreationInputTokens, 0);
  assert.equal(resultado.cacheReadInputTokens, 1280);
  assert.equal(resultado.reasoningTokens, 69);
  assert.equal(resultado.costUsd, 0);
  assert.equal(resultado.isError, false);
});

test('interpretMcpStatus le o vocabulario literal da saida real de CT-033', () => {
  const status = novoAdapter().interpretMcpStatus(SAIDA_MCP_LIST, [
    'context7',
    'playwright',
    'quebrado',
    'ausente',
  ]);

  assert.equal(status.get('context7'), 'OK');
  assert.equal(status.get('playwright'), 'OK');
  assert.equal(status.get('quebrado'), 'AVISO');
  assert.equal(status.get('ausente'), 'AVISO');
});

test('getVersion devolve a primeira linha de opencode --version', async () => {
  const runner = fakeRunner({ primeiraLinha: '1.18.25' });
  const versao = await novoAdapter(runner).getVersion();

  assert.equal(versao, '1.18.25');
  assert.equal(runner.calls[0].cmd, 'opencode');
  assert.deepEqual(runner.calls[0].args, ['--version']);
  assert.equal(runner.calls[0].opts.timeoutMs, 5000);
});

test('listMcps compoe mcpListRaw e interpretMcpStatus', async () => {
  const runner = fakeRunner({ stdout: SAIDA_MCP_LIST });
  const resultado = await novoAdapter(runner).listMcps(['context7', 'quebrado'], 15);

  assert.deepEqual(runner.calls[0].args, ['mcp', 'list']);
  assert.equal(runner.calls[0].opts.timeoutMs, 15000);
  assert.equal(runner.calls[0].opts.stdin, 'ignore');
  assert.equal(resultado[0].severidade, 'OK');
  assert.equal(resultado[1].severidade, 'AVISO');
});

test('buildEnv acrescenta OPENCODE_CONFIG e nada mais', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'specifica-oc-'));
  const servico = new OpenCodeExecutorConfigService(home);
  const { caminho } = await servico.ensure({
    runId: 'RUN',
    pid: 4242,
    formaDeInjecao: 'prompt',
    destiladoPath: null,
    allow: [],
  });

  const adapter = new OpenCodeAdapter(fakeRunner({}) as never, servico);
  const env = adapter.buildEnv(true, { PATH: '/usr/bin', HOME: home });

  assert.equal(env.OPENCODE_CONFIG, caminho);
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'OPENCODE_CONFIG', 'PATH']);

  await fs.remove(home);
});

test('buildEnv do OpenCode nunca define CLAUDE_CODE_PROMPT_CACHE_TTL', () => {
  const env = novoAdapter().buildEnv(true, { PATH: '/usr/bin' });

  assert.equal(env.CLAUDE_CODE_PROMPT_CACHE_TTL, undefined);
});

test('buildEnv do ClaudeCode nunca define OPENCODE_CONFIG', () => {
  const env = new ClaudeCodeAdapter(fakeRunner({}) as never).buildEnv(true, { PATH: '/usr/bin' });

  assert.equal(env.OPENCODE_CONFIG, undefined);
  assert.equal(env.CLAUDE_CODE_PROMPT_CACHE_TTL, '1h');
});

test('runTask executa opencode com o argv de CT-031 e agrega o NDJSON', async () => {
  const runner = fakeRunner({ stdout: NDJSON_UM_PASSO });
  const resultado = await novoAdapter(runner).runTask(entradaDeTask(), '/projeto');

  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].cmd, 'opencode');
  assert.equal(runner.calls[0].args[0], 'run');
  assert.equal(runner.calls[0].opts.cwd, '/projeto');
  assert.equal(runner.calls[0].opts.stdin, 'ignore');
  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.model, 'anthropic/claude-sonnet-4-5');
  assert.equal(resultado.modelosReportados, 'anthropic/claude-sonnet-4-5');
});

test('runPack executa o argv de CT-032 e agrega o NDJSON', async () => {
  const runner = fakeRunner({ stdout: NDJSON_UM_PASSO });
  const resultado = await novoAdapter(runner).runPack('PROMPT', entradaDePack(), '/projeto');

  assert.equal(runner.calls[0].args.includes('--command'), false);
  assert.equal(runner.calls[0].args[runner.calls[0].args.length - 1], 'PROMPT');
  assert.equal(resultado.isError, false);
  assert.equal(resultado.model, 'anthropic/claude-haiku-4-5');
});

test('evento error com exit code zero marca isError e subtype error', () => {
  const ndjson = [
    '{"type":"step_start","timestamp":1788286294193,"sessionID":"ses_x","part":{"type":"step-start"}}',
    '{"type":"error","timestamp":1788286294300,"sessionID":"ses_x","part":{"type":"error","message":"falhou"}}',
  ].join('\n');

  const resultado = novoAdapter().parseResult(0, ndjson, '');

  assert.equal(resultado.isError, true);
  assert.equal(resultado.subtype, 'error');
  assert.equal(resultado.numTurns, 0);
  assert.equal(resultado.sessionId, 'ses_x');
});

test('linha truncada no fim e descartada sem zerar a contabilidade nem virar falha', () => {
  const truncada = `${NDJSON_UM_PASSO}\n{"type":"step_finish","timestamp":178828`;
  const resultado = novoAdapter().parseResult(0, truncada, '');

  assert.equal(resultado.contabilidadeParcial, true);
  assert.equal(resultado.isError, false);
  assert.equal(resultado.subtype, 'success');
  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.inputTokens, 13176);
  assert.equal(resultado.reasoningTokens, 69);
});

test('stdout vazio com exit code diferente de zero devolve parse_error sem contabilidade parcial', () => {
  const resultado = novoAdapter().parseResult(1, '', 'boom');

  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.exitCode, 1);
  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.inputTokens, 0);
  assert.equal(resultado.permissionDenials, null);
  assert.equal(resultado.ferramentasNegadas, null);
});

test('stdout sem nenhuma linha legivel devolve parse_error com contabilidade parcial', () => {
  const resultado = novoAdapter().parseResult(0, 'nao e json\n{quebrado\n', '');

  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.contabilidadeParcial, true);
  assert.equal(resultado.numTurns, 0);
});

test('linhas vazias sao ignoradas sem contar como descartadas', () => {
  const comVazias = `\n\n${NDJSON_UM_PASSO}\n\n\n`;
  const resultado = novoAdapter().parseResult(0, comVazias, '');

  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.numTurns, 1);
});

test('sessionId ausente em todos os eventos vira ponto de interrogacao', () => {
  const ndjson = '{"type":"step_finish","timestamp":1,"part":{"type":"step-finish","tokens":{"input":10,"output":2}}}';
  const resultado = novoAdapter().parseResult(0, ndjson, '');

  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.inputTokens, 10);
});

test('menos de dois eventos produz duracao zero', () => {
  const ndjson = '{"type":"step_finish","timestamp":1788286295120,"sessionID":"ses_x","part":{"type":"step-finish","tokens":{"input":1,"output":1}}}';

  assert.equal(novoAdapter().parseResult(0, ndjson, '').durationMs, 0);
});

test('part.tokens.total nao e usado na contabilidade', () => {
  const ndjson = '{"type":"step_finish","timestamp":1,"sessionID":"ses_x","part":{"type":"step-finish","tokens":{"total":99999}}}';
  const resultado = novoAdapter().parseResult(0, ndjson, '');

  assert.equal(resultado.inputTokens, 0);
  assert.equal(resultado.outputTokens, 0);
  assert.equal(resultado.cacheReadInputTokens, 0);
  assert.equal(resultado.cacheCreationInputTokens, 0);
  assert.equal(resultado.reasoningTokens, 0);
  assert.equal(resultado.numTurns, 1);
});

test('campos nao numericos do NDJSON sao lidos como zero', () => {
  const ndjson = '{"type":"step_finish","timestamp":"agora","sessionID":"","part":{"type":"step-finish","cost":"caro","tokens":{"input":null,"output":"8","cache":"nao"}}}';
  const resultado = novoAdapter().parseResult(0, ndjson, '');

  assert.equal(resultado.costUsd, 0);
  assert.equal(resultado.inputTokens, 0);
  assert.equal(resultado.outputTokens, 0);
  assert.equal(resultado.cacheReadInputTokens, 0);
  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.durationMs, 0);
  assert.equal(resultado.contabilidadeParcial, false);
});

test('exit code diferente de zero com NDJSON legivel preserva a contabilidade e marca erro', () => {
  const resultado = novoAdapter().parseResult(2, NDJSON_UM_PASSO, '');

  assert.equal(resultado.isError, true);
  assert.equal(resultado.subtype, 'success');
  assert.equal(resultado.inputTokens, 13176);
  assert.equal(resultado.exitCode, 2);
});

test('interpretMcpStatus devolve AVISO para todos quando a saida e nula', () => {
  const status = novoAdapter().interpretMcpStatus(null, ['context7', 'playwright']);

  assert.equal(status.get('context7'), 'AVISO');
  assert.equal(status.get('playwright'), 'AVISO');
});

test('interpretMcpStatus trata metacaracteres do nome do MCP literalmente', () => {
  const saida = `${ESC}[0m\n●  ✓ meu.mcp ${ESC}[90mconnected`;
  const status = novoAdapter().interpretMcpStatus(saida, ['meu.mcp', 'meuXmcp']);

  assert.equal(status.get('meu.mcp'), 'OK');
  assert.equal(status.get('meuXmcp'), 'AVISO');
});

test('mcpListRaw descarta integralmente a saida em timeout e em falha de spawn', async () => {
  const porTimeout = await novoAdapter(
    fakeRunner({ stdout: SAIDA_MCP_LIST, timedOut: true })
  ).mcpListRaw(15);
  const porSpawn = await novoAdapter(
    fakeRunner({ stdout: SAIDA_MCP_LIST, spawnFailed: true })
  ).mcpListRaw(15);

  assert.equal(porTimeout, null);
  assert.equal(porSpawn, null);
});

test('getVersion devolve string vazia quando a CLI falha', async () => {
  assert.equal(await novoAdapter(fakeRunner({ primeiraLinha: '' })).getVersion(), '');
});

test('modoDePermissaoEfetivo devolve permissao total sem aviso nos modos com equivalente', () => {
  const avisos: string[] = [];
  const adapter = novoAdapter(fakeRunner({}), (m) => avisos.push(m));

  for (const permissionMode of ['', 'acceptEdits', 'auto', 'bypassPermissions'] as const) {
    assert.equal(adapter.modoDePermissaoEfetivo(opcoesBase({ permissionMode })), 'permissao total');
  }

  assert.deepEqual(avisos, []);
});

test('modoDePermissaoEfetivo avisa uma unica vez para modo sem equivalente', () => {
  const avisos: string[] = [];
  const adapter = novoAdapter(fakeRunner({}), (m) => avisos.push(m));

  assert.equal(
    adapter.modoDePermissaoEfetivo(opcoesBase({ permissionMode: 'dontAsk' })),
    'permissao total'
  );
  adapter.modoDePermissaoEfetivo(opcoesBase({ permissionMode: 'dontAsk' }));
  adapter.modoDePermissaoEfetivo(opcoesBase({ permissionMode: 'manual' }));

  assert.deepEqual(avisos, [
    '--permission-mode dontAsk nao tem equivalente no OpenCode - ignorado',
    '--permission-mode manual nao tem equivalente no OpenCode - ignorado',
  ]);
});

test('resolveExtraDirs devolve sempre lista vazia', async () => {
  assert.deepEqual(await novoAdapter().resolveExtraDirs(opcoesBase(), '/home/u', '/projeto'), []);
});

test('detectRateLimit delega ao modulo compartilhado', () => {
  const adapter = novoAdapter();

  assert.equal(adapter.detectRateLimit('Claude usage limit reached'), true);
  assert.equal(adapter.detectRateLimit('tudo certo'), false);
});

test('capacidades declaram os treze campos da coluna OpenCode', () => {
  assert.deepEqual(novoAdapter().capacidades, {
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
  });
});

const FALHA_DE_VARIANTE: FakeResposta = {
  exitCode: 1,
  stdout: '',
  stderr: 'Error: variant "max" is not supported by this provider',
};

test('variante recusada reexecuta uma unica vez sem --variant e desabilita a flag no lote', async () => {
  const avisos: string[] = [];
  const runner = fakeRunner([FALHA_DE_VARIANTE, { stdout: NDJSON_UM_PASSO }, { stdout: NDJSON_UM_PASSO }]);
  const adapter = novoAdapter(runner, (m) => avisos.push(m));
  const entrada = entradaDeTask({ opcoes: opcoesBase({ effort: 'max' }) });

  const resultado = await adapter.runTask(entrada, '/projeto');

  assert.equal(runner.calls.length, 2);
  assert.equal(runner.calls[0].args.includes('--variant'), true);
  assert.equal(runner.calls[1].args.includes('--variant'), false);
  assert.deepEqual(avisos, ['esforco max nao suportado pelo provedor configurado - seguindo sem ele']);
  assert.equal(resultado.isError, false);
  assert.equal(resultado.numTurns, 1);

  await adapter.runTask(entrada, '/projeto');

  assert.equal(runner.calls.length, 3);
  assert.equal(runner.calls[2].args.includes('--variant'), false);
  assert.equal(avisos.length, 1);
});

test('variante recusada na segunda tentativa nao dispara nova reexecucao', async () => {
  const runner = fakeRunner([FALHA_DE_VARIANTE, FALHA_DE_VARIANTE, { stdout: NDJSON_UM_PASSO }]);
  const adapter = novoAdapter(runner);

  const resultado = await adapter.runTask(
    entradaDeTask({ opcoes: opcoesBase({ effort: 'high' }) }),
    '/projeto'
  );

  assert.equal(runner.calls.length, 2);
  assert.equal(resultado.isError, true);
});

test('falha que consumiu tokens nunca e reexecutada', async () => {
  const runner = fakeRunner([
    { exitCode: 1, stdout: NDJSON_UM_PASSO, stderr: 'variant unsupported' },
    { stdout: NDJSON_UM_PASSO },
  ]);
  const avisos: string[] = [];
  const adapter = novoAdapter(runner, (m) => avisos.push(m));

  const resultado = await adapter.runTask(
    entradaDeTask({ opcoes: opcoesBase({ effort: 'max' }) }),
    '/projeto'
  );

  assert.equal(runner.calls.length, 1);
  assert.equal(resultado.isError, true);
  assert.deepEqual(avisos, []);
});

test('falha sem citacao de variante nao e reexecutada', async () => {
  const runner = fakeRunner([
    { exitCode: 1, stdout: '', stderr: 'Error: model not found' },
    { stdout: NDJSON_UM_PASSO },
  ]);
  const adapter = novoAdapter(runner);

  await adapter.runTask(entradaDeTask({ opcoes: opcoesBase({ effort: 'max' }) }), '/projeto');

  assert.equal(runner.calls.length, 1);
});

test('esforco medium nao dispara reexecucao porque nenhuma variante foi enviada', async () => {
  const runner = fakeRunner([FALHA_DE_VARIANTE, { stdout: NDJSON_UM_PASSO }]);
  const adapter = novoAdapter(runner);

  await adapter.runTask(entradaDeTask({ opcoes: opcoesBase({ effort: 'medium' }) }), '/projeto');

  assert.equal(runner.calls.length, 1);
});

test('runPack tambem reexecuta uma unica vez sem --variant', async () => {
  const avisos: string[] = [];
  const runner = fakeRunner([FALHA_DE_VARIANTE, { stdout: NDJSON_UM_PASSO }]);
  const adapter = novoAdapter(runner, (m) => avisos.push(m));

  const resultado = await adapter.runPack('PROMPT', entradaDePack(), '/projeto');

  assert.equal(runner.calls.length, 2);
  assert.equal(runner.calls[1].args.includes('--variant'), false);
  assert.deepEqual(avisos, ['esforco low nao suportado pelo provedor configurado - seguindo sem ele']);
  assert.equal(resultado.isError, false);
});

const DIR_FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'opencode');

async function fixture(nome: string): Promise<string> {
  return fs.readFile(path.join(DIR_FIXTURES, nome), 'utf-8');
}

test('fixture de lote normal: a agregacao soma os componentes dos dois step_finish', async () => {
  const resultado = novoAdapter().parseResult(0, await fixture('lote-normal.ndjson'), '');

  assert.equal(resultado.sessionId, 'ses_fa1d4c6a3ffeQm9B2oAqGRSbGF');
  assert.equal(resultado.subtype, 'success');
  assert.equal(resultado.isError, false);
  assert.equal(resultado.exitCode, 0);
  assert.equal(resultado.numTurns, 2);
  assert.equal(resultado.inputTokens, 13176 + 6930);
  assert.equal(resultado.outputTokens, 8 + 14);
  assert.equal(resultado.cacheCreationInputTokens, 7552);
  assert.equal(resultado.cacheReadInputTokens, 1280);
  assert.equal(resultado.reasoningTokens, 69 + 241);
  assert.equal(resultado.costUsd, 0);
  assert.equal(resultado.durationMs, 1788286296010 - 1788286294193);
  assert.equal(resultado.durationApiMs, 0);
  assert.equal(resultado.permissionDenials, null);
  assert.equal(resultado.ferramentasNegadas, null);
  assert.equal(resultado.contabilidadeParcial, false);
});

test('fixture de um unico step_finish: contabilidade integral e duracao entre o primeiro e o ultimo evento', async () => {
  const resultado = novoAdapter().parseResult(0, await fixture('um-step-finish.ndjson'), '');

  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.inputTokens, 13176);
  assert.equal(resultado.outputTokens, 8);
  assert.equal(resultado.cacheCreationInputTokens, 0);
  assert.equal(resultado.cacheReadInputTokens, 1280);
  assert.equal(resultado.reasoningTokens, 69);
  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.durationMs, 1788286295120 - 1788286294193);
});

test('fixture de mcp list: a saida literal de CT-033 preserva as sequencias ANSI e e lida por connected', async () => {
  const saida = await fixture('mcp-list.txt');

  assert.ok(saida.includes('\u001b[90m'), 'a fixture precisa preservar as sequencias ANSI');

  const status = novoAdapter().interpretMcpStatus(saida, ['context7', 'playwright']);

  assert.equal(status.get('context7'), 'OK');
  assert.equal(status.get('playwright'), 'OK');
});

test('fixture de evento error: exit code zero ainda marca isError e subtype error, sem perder a contabilidade', async () => {
  const resultado = novoAdapter().parseResult(0, await fixture('evento-error.ndjson'), '');

  assert.equal(resultado.isError, true);
  assert.equal(resultado.subtype, 'error');
  assert.equal(resultado.exitCode, 0);
  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.inputTokens, 180);
  assert.equal(resultado.cacheReadInputTokens, 30);
  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.sessionId, 'ses_9b2eaf104cc1Rt7kLpQwZxYvNa');
});

test('fixture de linha truncada: a linha ilegivel e descartada sem zerar a contabilidade da task', async () => {
  const resultado = novoAdapter().parseResult(0, await fixture('linha-truncada.ndjson'), '');

  assert.equal(resultado.contabilidadeParcial, true);
  assert.equal(resultado.subtype, 'success');
  assert.equal(resultado.isError, false);
  assert.equal(resultado.numTurns, 1);
  assert.equal(resultado.inputTokens, 13176);
  assert.equal(resultado.reasoningTokens, 69);
  assert.ok(resultado.inputTokens > 0, 'a fixture nao pode zerar a contabilidade de uma task que executou');
});

test('fixture de stdout vazio: parse_error com exit code diferente de zero e sem contabilidade parcial', async () => {
  const vazio = await fixture('stdout-vazio.ndjson');
  const resultado = novoAdapter().parseResult(1, vazio, 'boom');

  assert.equal(vazio, '');
  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.exitCode, 1);
  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.numTurns, 0);
  assert.equal(resultado.reasoningTokens, 0);
});

test('fixture de stdout vazio com exit code zero tambem devolve parse_error', async () => {
  const resultado = novoAdapter().parseResult(0, await fixture('stdout-vazio.ndjson'), '');

  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.contabilidadeParcial, false);
  assert.equal(resultado.inputTokens, 0);
});

test('fixture de mcp list: os quatro casos de interpretacao de CT-033', async () => {
  const saida = await fixture('mcp-list.txt');
  const adapter = novoAdapter();

  const status = adapter.interpretMcpStatus(saida, ['context7', 'quebrado', 'ausente']);
  assert.equal(status.get('context7'), 'OK');
  assert.equal(status.get('quebrado'), 'AVISO');
  assert.equal(status.get('ausente'), 'AVISO');

  const semSaida = adapter.interpretMcpStatus(null, ['context7', 'quebrado', 'ausente']);
  assert.equal(semSaida.get('context7'), 'AVISO');
  assert.equal(semSaida.get('quebrado'), 'AVISO');
  assert.equal(semSaida.get('ausente'), 'AVISO');
});

test('fixture de mcp list: o glifo nunca decide o status, so o vocabulario literal', async () => {
  const saida = await fixture('mcp-list.txt');
  const comGlifoDeSucesso = saida.replace('quebrado', 'com-visto').replace('✗', '✓');
  const status = novoAdapter().interpretMcpStatus(comGlifoDeSucesso, ['com-visto']);

  assert.equal(status.get('com-visto'), 'AVISO');
});
