import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { ClaudeCodeAdapter } from '../dist/utils/tool-adapters/claude-code-adapter.js';
import type { ExecutarTasksOptions } from '../dist/types/executar-tasks.js';
import type { BuildTaskArgsInput } from '../dist/types/tool-adapter.js';

function opcoesBase(over: Partial<ExecutarTasksOptions> = {}): ExecutarTasksOptions {
  return {
    tool: 'claudecode',
    model: 'sonnet',
    effort: 'medium',
    fallbackModel: '',
    autoApprove: false,
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

function entrada(over: Partial<BuildTaskArgsInput> = {}): BuildTaskArgsInput {
  return {
    taskPath: '/abs/specs/features/f/task-1.md',
    opcoes: opcoesBase(),
    extraDirs: [],
    contextoExecucaoPath: null,
    contextoExecucaoConteudo: null,
    ...over,
  };
}

interface FakeRunnerCall {
  cmd: string;
  args: string[];
  opts: Record<string, unknown>;
}

function fakeRunner(resposta: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  spawnFailed?: boolean;
  primeiraLinha?: string;
}) {
  const calls: FakeRunnerCall[] = [];
  const runner = {
    calls,
    async run(cmd: string, args: string[], opts: Record<string, unknown>) {
      calls.push({ cmd, args, opts });
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
      return resposta.primeiraLinha ?? '';
    },
  };
  return runner;
}

function novoAdapter(runner: ReturnType<typeof fakeRunner>): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter(runner as never);
}

test('buildTaskArgs produz a ordem estavel de CT-020', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);

  const args = adapter.buildTaskArgs(
    entrada({
      taskPath: '/abs/specs/features/f/task-1.md',
      opcoes: opcoesBase({
        autoApprove: true,
        fallbackModel: 'opus',
        allow: ['Bash'],
        maxBudgetUsd: 5,
        cacheTuning: true,
      }),
      extraDirs: ['/home/u/.claude/skills', '/proj/.claude/skills'],
      contextoExecucaoPath: '/proj/specs/features/f/contexto-execucao.md',
    })
  );

  assert.deepEqual(args, [
    '-p',
    '/executar-task /abs/specs/features/f/task-1.md',
    '--output-format',
    'json',
    '--model',
    'sonnet',
    '--effort',
    'medium',
    '--permission-mode',
    'bypassPermissions',
    '--add-dir',
    '/home/u/.claude/skills',
    '--add-dir',
    '/proj/.claude/skills',
    '--fallback-model',
    'opus',
    '--allowedTools',
    'Bash',
    '--max-budget-usd',
    '5',
    '--append-system-prompt-file',
    '/proj/specs/features/f/contexto-execucao.md',
    '--exclude-dynamic-system-prompt-sections',
  ]);
});

test('buildTaskArgs omite --max-budget-usd quando 0', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const semBudget = adapter.buildTaskArgs(entrada({ opcoes: opcoesBase({ maxBudgetUsd: 0 }) }));
  assert.equal(semBudget.includes('--max-budget-usd'), false);

  const comBudget = adapter.buildTaskArgs(entrada({ opcoes: opcoesBase({ maxBudgetUsd: 3 }) }));
  assert.equal(comBudget.includes('--max-budget-usd'), true);
  assert.equal(comBudget[comBudget.indexOf('--max-budget-usd') + 1], '3');
});

test('buildTaskArgs omite --permission-mode quando o modo efetivo e vazio', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const args = adapter.buildTaskArgs(
    entrada({ opcoes: opcoesBase({ autoApprove: false, permissionMode: '' }) })
  );
  assert.equal(args.includes('--permission-mode'), false);
});

test('buildTaskArgs usa bypassPermissions com --auto-approve e o valor explicito quando informado', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);

  const auto = adapter.buildTaskArgs(entrada({ opcoes: opcoesBase({ autoApprove: true }) }));
  assert.equal(auto[auto.indexOf('--permission-mode') + 1], 'bypassPermissions');

  const explicito = adapter.buildTaskArgs(
    entrada({ opcoes: opcoesBase({ autoApprove: true, permissionMode: 'acceptEdits' }) })
  );
  assert.equal(explicito[explicito.indexOf('--permission-mode') + 1], 'acceptEdits');
});

test('resolveExtraDirs adiciona apenas diretorios existentes e nenhum com --no-skill-dirs', async () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cca-home-'));
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'cca-cwd-'));

  try {
    await fs.ensureDir(path.join(home, '.claude', 'skills'));

    const comDirs = await adapter.resolveExtraDirs(opcoesBase({ skillDirs: true }), home, cwd);
    assert.deepEqual(comDirs, [path.join(home, '.claude', 'skills')]);

    const semDirs = await adapter.resolveExtraDirs(opcoesBase({ skillDirs: false }), home, cwd);
    assert.deepEqual(semDirs, []);

    const args = adapter.buildTaskArgs(entrada({ extraDirs: semDirs }));
    assert.equal(args.includes('--add-dir'), false);
  } finally {
    await fs.remove(home);
    await fs.remove(cwd);
  }
});

test('buildEnv acrescenta CLAUDE_CODE_PROMPT_CACHE_TTL=1h so com cache tuning e so quando ausente', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);

  assert.equal(adapter.buildEnv(true, {}).CLAUDE_CODE_PROMPT_CACHE_TTL, '1h');
  assert.equal(adapter.buildEnv(false, {}).CLAUDE_CODE_PROMPT_CACHE_TTL, undefined);
  assert.equal(
    adapter.buildEnv(true, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' }).CLAUDE_CODE_PROMPT_CACHE_TTL,
    '5m'
  );

  const base: NodeJS.ProcessEnv = { FOO: 'bar' };
  const env = adapter.buildEnv(true, base);
  assert.equal(env.FOO, 'bar');
  assert.equal(base.CLAUDE_CODE_PROMPT_CACHE_TTL, undefined);
});

test('buildContextPackArgs monta o argv de CT-021', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);

  const comCache = adapter.buildContextPackArgs('PROMPT', {
    featureDir: '/f',
    packModel: 'sonnet',
    packEffort: 'low',
    cacheTuning: true,
  });
  assert.deepEqual(comCache, [
    '-p',
    'PROMPT',
    '--output-format',
    'json',
    '--model',
    'sonnet',
    '--effort',
    'low',
    '--permission-mode',
    'acceptEdits',
    '--exclude-dynamic-system-prompt-sections',
  ]);

  const semCache = adapter.buildContextPackArgs('PROMPT', {
    featureDir: '/f',
    packModel: 'sonnet',
    packEffort: 'low',
    cacheTuning: false,
  });
  assert.equal(semCache.includes('--exclude-dynamic-system-prompt-sections'), false);
});

test('parseResult soma todas as entradas de modelUsage quando ele existe', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const stdout = JSON.stringify({
    session_id: 'abc',
    subtype: 'success',
    is_error: false,
    model: 'claude-sonnet-4-5',
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_input_tokens: 1,
      cache_read_input_tokens: 1,
    },
    modelUsage: {
      'claude-sonnet-4-5': {
        inputTokens: 100,
        outputTokens: 200,
        cacheCreationInputTokens: 300,
        cacheReadInputTokens: 400,
      },
      'claude-haiku': {
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationInputTokens: 30,
        cacheReadInputTokens: 40,
      },
    },
  });

  const resultado = adapter.parseResult(0, stdout, '');
  assert.equal(resultado.inputTokens, 110);
  assert.equal(resultado.outputTokens, 220);
  assert.equal(resultado.cacheCreationInputTokens, 330);
  assert.equal(resultado.cacheReadInputTokens, 440);
  assert.equal(resultado.modelosReportados, 'claude-sonnet-4-5,claude-haiku');
});

test('parseResult cai para usage quando modelUsage esta ausente ou vazio, com 0 para campo faltante', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);

  const ausente = adapter.parseResult(
    0,
    JSON.stringify({
      session_id: 'a',
      is_error: false,
      model: 'm',
      usage: { input_tokens: 5, output_tokens: 7 },
    }),
    ''
  );
  assert.equal(ausente.inputTokens, 5);
  assert.equal(ausente.outputTokens, 7);
  assert.equal(ausente.cacheCreationInputTokens, 0);
  assert.equal(ausente.cacheReadInputTokens, 0);
  assert.equal(ausente.modelosReportados, 'm');

  const vazio = adapter.parseResult(
    0,
    JSON.stringify({ session_id: 'a', is_error: false, modelUsage: {}, usage: { input_tokens: 9 } }),
    ''
  );
  assert.equal(vazio.inputTokens, 9);
});

test('parseResult nunca soma modelUsage e usage juntos', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const resultado = adapter.parseResult(
    0,
    JSON.stringify({
      session_id: 'a',
      is_error: false,
      usage: {
        input_tokens: 1000,
        output_tokens: 1000,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: 1000,
      },
      modelUsage: {
        m: {
          inputTokens: 1,
          outputTokens: 2,
          cacheCreationInputTokens: 3,
          cacheReadInputTokens: 4,
        },
      },
    }),
    ''
  );

  assert.equal(resultado.inputTokens, 1);
  assert.equal(resultado.outputTokens, 2);
  assert.equal(resultado.cacheCreationInputTokens, 3);
  assert.equal(resultado.cacheReadInputTokens, 4);
});

test('parseResult devolve parse_error com contadores em 0 e sessionId ? para JSON invalido', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const resultado = adapter.parseResult(0, 'nao e json {', 'stderr aqui');

  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.inputTokens, 0);
  assert.equal(resultado.outputTokens, 0);
  assert.equal(resultado.cacheCreationInputTokens, 0);
  assert.equal(resultado.cacheReadInputTokens, 0);
  assert.equal(resultado.rawStderr, 'stderr aqui');
});

test('parseResult devolve parse_error quando exitCode e diferente de zero', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const resultado = adapter.parseResult(
    1,
    JSON.stringify({ session_id: 'x', is_error: false, usage: { input_tokens: 5 } }),
    ''
  );
  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.sessionId, '?');
  assert.equal(resultado.inputTokens, 0);
});

test('parseResult devolve parse_error quando is_error e verdadeiro, preservando session_id', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const resultado = adapter.parseResult(
    0,
    JSON.stringify({ session_id: 'sess-1', is_error: true, usage: { input_tokens: 5 } }),
    ''
  );
  assert.equal(resultado.subtype, 'parse_error');
  assert.equal(resultado.isError, true);
  assert.equal(resultado.sessionId, 'sess-1');
  assert.equal(resultado.inputTokens, 0);
});

test('parseResult conta permission_denials e lista as ferramentas negadas', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const resultado = adapter.parseResult(
    0,
    JSON.stringify({
      session_id: 'a',
      is_error: false,
      usage: {},
      permission_denials: [{ tool_name: 'Bash' }, { tool_name: 'Bash' }, { tool_name: 'Write' }],
    }),
    ''
  );

  assert.equal(resultado.permissionDenials, 3);
  assert.equal(resultado.ferramentasNegadas, 'Bash,Write');

  const semDenials = adapter.parseResult(
    0,
    JSON.stringify({ session_id: 'a', is_error: false, usage: {} }),
    ''
  );
  assert.equal(semDenials.permissionDenials, 0);
  assert.equal(semDenials.ferramentasNegadas, null);
});

test('detectRateLimit casa as quatro expressoes, insensivel a caixa', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  for (const texto of [
    'Claude usage limit reached',
    'you hit a rate limit',
    'RATE-LIMIT exceeded',
    'Weekly Limit hit',
    'session limit reached',
  ]) {
    assert.equal(adapter.detectRateLimit(texto), true, texto);
  }
});

test('detectRateLimit nao casa texto sem sinalizacao de limite', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  assert.equal(adapter.detectRateLimit('tarefa concluida com sucesso'), false);
  assert.equal(adapter.detectRateLimit('the limit of the function is 3'), false);
});

test('interpretMcpStatus marca OK para linha com Connected e AVISO para linha sem', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const saida = 'context7: https://... - Connected\nplaywright: comando - Failed to connect';
  const mapa = adapter.interpretMcpStatus(saida, ['context7', 'playwright']);
  assert.equal(mapa.get('context7'), 'OK');
  assert.equal(mapa.get('playwright'), 'AVISO');
});

test('interpretMcpStatus marca AVISO para MCP declarado e ausente da saida', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const mapa = adapter.interpretMcpStatus('context7: x - Connected', ['context7', 'ausente']);
  assert.equal(mapa.get('ausente'), 'AVISO');
});

test('interpretMcpStatus marca todos como AVISO quando a saida e null (timeout)', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const mapa = adapter.interpretMcpStatus(null, ['context7', 'playwright']);
  assert.equal(mapa.get('context7'), 'AVISO');
  assert.equal(mapa.get('playwright'), 'AVISO');
});

test('interpretMcpStatus escapa metacaracteres no nome do MCP', () => {
  const adapter = new ClaudeCodeAdapter(fakeRunner({}) as never);
  const saida = 'axb: x - Connected';
  const mapa = adapter.interpretMcpStatus(saida, ['a.b']);
  assert.equal(mapa.get('a.b'), 'AVISO');
});

test('mcpListRaw devolve null em timeout e a saida bruta caso contrario', async () => {
  const timeout = novoAdapter(fakeRunner({ timedOut: true, stdout: 'parcial' }));
  assert.equal(await timeout.mcpListRaw(1), null);

  const ok = novoAdapter(fakeRunner({ stdout: 'context7: Connected' }));
  assert.equal(await ok.mcpListRaw(15), 'context7: Connected');
});

test('getVersion delega a runCapturingFirstLine com timeout de 5 segundos', async () => {
  const runner = fakeRunner({ primeiraLinha: '1.2.3' });
  const adapter = novoAdapter(runner);
  assert.equal(await adapter.getVersion(), '1.2.3');
  assert.equal(runner.calls[0].opts.timeoutMs, 5000);
  assert.deepEqual(runner.calls[0].args, ['--version']);
});

test('runTask invoca o runner sem timeout e normaliza a resposta', async () => {
  const runner = fakeRunner({
    exitCode: 0,
    stdout: JSON.stringify({ session_id: 's', is_error: false, usage: { input_tokens: 4 } }),
  });
  const adapter = novoAdapter(runner);

  const resultado = await adapter.runTask(entrada(), '/proj');
  assert.equal(resultado.sessionId, 's');
  assert.equal(resultado.inputTokens, 4);
  assert.equal(runner.calls[0].opts.timeoutMs, undefined);
  assert.equal(runner.calls[0].cmd, 'claude');
});

// --- Congelamento de contrato (RF-014 / RNF-001, task-1 de executar-tasks-opencode) ---
// Os literais abaixo sao o argv e o ambiente EFETIVAMENTE produzidos hoje. Qualquer
// mudanca de valor ou de posicao quebra estes testes de proposito: CT-020, CT-021 e
// ENV-001 precisam permanecer identicos enquanto novas ferramentas sao adicionadas.

test('CT-020: buildTaskArgs congela a sequencia de argv da execucao de task', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const args = adapter.buildTaskArgs(
    entrada({
      taskPath: '/abs/specs/features/exemplo/task-1.md',
      extraDirs: ['/abs/a', '/abs/b'],
      contextoExecucaoPath: '/abs/specs/features/exemplo/contexto-execucao.md',
    })
  );

  assert.deepStrictEqual(args, [
    '-p',
    '/executar-task /abs/specs/features/exemplo/task-1.md',
    '--output-format',
    'json',
    '--model',
    'sonnet',
    '--effort',
    'medium',
    '--add-dir',
    '/abs/a',
    '--add-dir',
    '/abs/b',
    '--append-system-prompt-file',
    '/abs/specs/features/exemplo/contexto-execucao.md',
    '--exclude-dynamic-system-prompt-sections',
  ]);
});

test('CT-021: buildContextPackArgs congela a sequencia de argv do Contexto de Execucao', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const args = adapter.buildContextPackArgs('PROMPT DO PACK', {
    featureDir: '/abs/specs/features/exemplo',
    packModel: 'sonnet',
    packEffort: 'low',
    cacheTuning: true,
  });

  assert.deepStrictEqual(args, [
    '-p',
    'PROMPT DO PACK',
    '--output-format',
    'json',
    '--model',
    'sonnet',
    '--effort',
    'low',
    '--permission-mode',
    'acceptEdits',
    '--exclude-dynamic-system-prompt-sections',
  ]);
});

test('ENV-001: buildEnv define CLAUDE_CODE_PROMPT_CACHE_TTL com cacheTuning ligado', () => {
  const adapter = novoAdapter(fakeRunner({}));
  const base: NodeJS.ProcessEnv = { PATH: '/usr/bin', HOME: '/home/u' };

  const env = adapter.buildEnv(true, base);

  assert.deepStrictEqual(env, {
    PATH: '/usr/bin',
    HOME: '/home/u',
    CLAUDE_CODE_PROMPT_CACHE_TTL: '1h',
  });
  assert.equal(base.CLAUDE_CODE_PROMPT_CACHE_TTL, undefined);
});

test('ENV-001: buildEnv nao cria CLAUDE_CODE_PROMPT_CACHE_TTL com cacheTuning desligado', () => {
  const adapter = novoAdapter(fakeRunner({}));
  const base: NodeJS.ProcessEnv = { PATH: '/usr/bin', HOME: '/home/u' };

  const env = adapter.buildEnv(false, base);

  assert.equal('CLAUDE_CODE_PROMPT_CACHE_TTL' in env, false);
  assert.deepStrictEqual(env, { PATH: '/usr/bin', HOME: '/home/u' });
});

test('ENV-001: buildEnv preserva CLAUDE_CODE_PROMPT_CACHE_TTL ja definido no ambiente', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const env = adapter.buildEnv(true, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' });

  assert.deepStrictEqual(env, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' });
});

test('CT-020: buildTaskArgs congela a ordem do argv com todas as opcoes preenchidas', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const args = adapter.buildTaskArgs(
    entrada({
      taskPath: '/abs/specs/features/exemplo/task-1.md',
      opcoes: opcoesBase({
        model: 'opus',
        effort: 'high',
        permissionMode: 'acceptEdits',
        autoApprove: true,
        fallbackModel: 'sonnet',
        allow: ['Bash(npm test)', 'Read'],
        maxBudgetUsd: 5,
        cacheTuning: false,
      }),
      extraDirs: ['/abs/a', '/abs/b'],
      contextoExecucaoPath: '/abs/specs/features/exemplo/contexto-execucao.md',
    })
  );

  assert.deepStrictEqual(args, [
    '-p',
    '/executar-task /abs/specs/features/exemplo/task-1.md',
    '--output-format',
    'json',
    '--model',
    'opus',
    '--effort',
    'high',
    '--permission-mode',
    'acceptEdits',
    '--add-dir',
    '/abs/a',
    '--add-dir',
    '/abs/b',
    '--fallback-model',
    'sonnet',
    '--allowedTools',
    'Bash(npm test)',
    '--allowedTools',
    'Read',
    '--max-budget-usd',
    '5',
    '--append-system-prompt-file',
    '/abs/specs/features/exemplo/contexto-execucao.md',
  ]);
});

test('CT-020: buildTaskArgs omite os opcionais quando nada foi informado', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const args = adapter.buildTaskArgs(
    entrada({
      taskPath: '/abs/t.md',
      opcoes: opcoesBase({ cacheTuning: false }),
      extraDirs: [],
      contextoExecucaoPath: null,
    })
  );

  assert.deepStrictEqual(args, [
    '-p',
    '/executar-task /abs/t.md',
    '--output-format',
    'json',
    '--model',
    'sonnet',
    '--effort',
    'medium',
  ]);
});

test('CT-021: buildContextPackArgs omite a flag de cache com cacheTuning desligado', () => {
  const adapter = novoAdapter(fakeRunner({}));

  const args = adapter.buildContextPackArgs('PROMPT', {
    featureDir: '/abs/specs/features/exemplo',
    packModel: 'haiku',
    packEffort: 'low',
    cacheTuning: false,
  });

  assert.deepStrictEqual(args, [
    '-p',
    'PROMPT',
    '--output-format',
    'json',
    '--model',
    'haiku',
    '--effort',
    'low',
    '--permission-mode',
    'acceptEdits',
  ]);
});

// CT-047: `modelosReportados` sai das chaves de `modelUsage`, que sao o modelo
// que a CLI de fato usou. Por isso a capacidade e `true`, e so por ela o aviso
// de divergencia de RF-013 pode ser emitido.
test('relatoDeModeloEfetivo e true no ClaudeCode', () => {
  assert.equal(new ClaudeCodeAdapter().capacidades.relatoDeModeloEfetivo, true);
});
