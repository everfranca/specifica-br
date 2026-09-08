import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';

import { executarTasksCommand } from '../dist/commands/executar-tasks.js';
import { validateOptions } from '../dist/utils/executar-tasks-validation.js';

const OPCOES_ESPERADAS = [
  '--allow',
  '--auto-approve',
  '--dry-run',
  '--effort',
  '--fallback-model',
  '--max-budget-usd',
  '--max-wait',
  '--mcp-timeout',
  '--model',
  '--no-cache-tuning',
  '--no-context-pack',
  '--context-injection',
  '--no-mcp-check',
  '--no-skill-dirs',
  '--no-wait-on-limit',
  '--pack-max-tokens',
  '--pack-timeout',
  '--permission-mode',
  '--preflight',
  '--require-cmd',
  '--skip-preflight',
  '--sleep',
  '--stop-on-failure',
  '--tasks',
  '--tool',
  '--window-budget-tokens',
  '--yes',
].sort();

const MODELO_AUSENTE =
  '--model é obrigatória. Informe o modelo que a ferramenta deve usar no lote. Exemplo: specifica-br executar-tasks specs/features/minha-feature --model sonnet --effort medium';
const ESFORCO_AUSENTE =
  '--effort é obrigatória. Valores aceitos: low, medium, high, xhigh, max. Exemplo: specifica-br executar-tasks specs/features/minha-feature --model sonnet --effort medium';

const BASE = { model: 'sonnet', effort: 'medium' };

test('as 27 opcoes de RF-002, CT-030, P1-3 e RF-025 estao declaradas, nem mais nem menos', () => {
  const longs = executarTasksCommand.options.map((o) => o.long).sort();
  assert.equal(executarTasksCommand.options.length, 27);
  assert.deepEqual(longs, OPCOES_ESPERADAS);
});

test('nenhuma opcao positiva correspondente as negativas e exposta', () => {
  const longs = executarTasksCommand.options.map((o) => o.long);
  for (const positiva of ['--skill-dirs', '--cache-tuning', '--context-pack', '--mcp-check']) {
    assert.ok(!longs.includes(positiva), `${positiva} nao deveria existir`);
  }
});

test('opcao desconhecida e rejeitada', async () => {
  executarTasksCommand.exitOverride();
  await assert.rejects(async () => {
    await executarTasksCommand.parseAsync(['dir-qualquer', '--opcao-inexistente'], {
      from: 'user',
    });
  });
});

test('--effort fora dos cinco niveis e rejeitado', () => {
  assert.throws(() => validateOptions({ ...BASE, effort: 'turbo' }));
  assert.equal(validateOptions({ ...BASE, effort: 'xhigh' }).effort, 'xhigh');
});

test('--permission-mode fora dos modos aceitos e rejeitado', () => {
  assert.throws(() => validateOptions({ ...BASE, permissionMode: 'root' }));
  assert.equal(
    validateOptions({ ...BASE, permissionMode: 'acceptEdits' }).permissionMode,
    'acceptEdits'
  );
  assert.equal(validateOptions({ ...BASE }).permissionMode, '');
});

test('--tool fora das cinco ferramentas e rejeitado; aceito sem distincao de caixa', () => {
  assert.throws(() => validateOptions({ ...BASE, tool: 'vscode' }));
  assert.equal(validateOptions({ ...BASE, tool: 'ClaudeCode' }).tool, 'claudecode');
  assert.equal(validateOptions({ ...BASE, tool: 'GEMINI-CLI' }).tool, 'gemini-cli');
});

test('valores nao numericos nos cinco numericos sao rejeitados', () => {
  for (const chave of [
    'maxBudgetUsd',
    'windowBudgetTokens',
    'sleep',
    'packMaxTokens',
    'mcpTimeout',
  ]) {
    assert.throws(() => validateOptions({ ...BASE, [chave]: 'abc' }), /numerico/, chave);
  }
});

test('--mcp-timeout exige inteiro maior que zero', () => {
  assert.throws(() => validateOptions({ ...BASE, mcpTimeout: 0 }));
  assert.throws(() => validateOptions({ ...BASE, mcpTimeout: '0' }));
  assert.throws(() => validateOptions({ ...BASE, mcpTimeout: 1.5 }));
  assert.equal(validateOptions({ ...BASE, mcpTimeout: 20 }).mcpTimeout, 20);
});

test('--window-budget-tokens e --pack-max-tokens exigem inteiro >= 0', () => {
  assert.throws(() => validateOptions({ ...BASE, windowBudgetTokens: -1 }));
  assert.throws(() => validateOptions({ ...BASE, windowBudgetTokens: 2.5 }));
  assert.throws(() => validateOptions({ ...BASE, packMaxTokens: -3 }));
  assert.equal(validateOptions({ ...BASE, windowBudgetTokens: 0 }).windowBudgetTokens, 0);
});

test('as quatro opcoes negativas entregam true por padrao e false quando informadas', () => {
  const padrao = validateOptions(BASE);
  assert.equal(padrao.skillDirs, true);
  assert.equal(padrao.cacheTuning, true);
  assert.equal(padrao.contextPack, true);
  assert.equal(padrao.mcpCheck, true);

  const informadas = validateOptions({
    ...BASE,
    skillDirs: false,
    cacheTuning: false,
    contextPack: false,
    mcpCheck: false,
  });
  assert.equal(informadas.skillDirs, false);
  assert.equal(informadas.cacheTuning, false);
  assert.equal(informadas.contextPack, false);
  assert.equal(informadas.mcpCheck, false);
});

test('os defaults da tabela da secao 4.1 sao aplicados', () => {
  const v = validateOptions(BASE);
  assert.equal(v.fallbackModel, '');
  assert.equal(v.packMaxTokens, 8000);
  assert.equal(v.mcpTimeout, 15);
  assert.equal(v.maxBudgetUsd, 0);
  assert.equal(v.sleep, 0);
  assert.deepEqual(v.allow, []);
  assert.deepEqual(v.requireCmd, []);
});

test('--model e --effort informadas seguem para o objeto validado (RF-011)', () => {
  const v = validateOptions({ model: 'opus', effort: 'high' });
  assert.equal(v.model, 'opus');
  assert.equal(v.effort, 'high');
});

test('--context-injection aceita os dois valores do conjunto fechado (CT-030)', () => {
  assert.equal(validateOptions({ ...BASE, contextInjection: 'prompt' }).contextInjection, 'prompt');
  assert.equal(
    validateOptions({ ...BASE, contextInjection: 'instructions' }).contextInjection,
    'instructions'
  );
});

test('--context-injection tem default prompt (CT-030)', () => {
  assert.equal(validateOptions(BASE).contextInjection, 'prompt');
});

test('--context-injection aparece no --help com o valor padrao (RF-015)', () => {
  const opcao = executarTasksCommand.options.find((o) => o.long === '--context-injection');
  assert.ok(opcao);
  assert.equal(opcao.flags, '--context-injection <forma>');
  assert.equal(opcao.description, 'Forma de injecao do Contexto de Execucao (prompt|instructions)');
  assert.equal(opcao.defaultValue, 'prompt');
});

test('--context-injection fora do conjunto fechado e rejeitado com a mensagem nominal (RF-016)', () => {
  assert.throws(
    () => validateOptions({ ...BASE, contextInjection: 'xyz' }),
    /^Error: --context-injection invalido: xyz\. Use um de: prompt\|instructions$/
  );
});

test('--context-injection vazia cai no default em vez de falhar', () => {
  assert.equal(validateOptions({ ...BASE, contextInjection: '' }).contextInjection, 'prompt');
});

test('--model e --effort sao declaradas sem default e com a descricao da secao 4.1', () => {
  const model = executarTasksCommand.options.find((o) => o.long === '--model');
  const effort = executarTasksCommand.options.find((o) => o.long === '--effort');
  assert.ok(model);
  assert.ok(effort);
  assert.equal(model.flags, '--model <modelo>');
  assert.equal(model.description, 'Modelo da ferramenta (obrigatoria)');
  assert.equal(model.defaultValue, undefined);
  assert.equal(effort.flags, '--effort <nivel>');
  assert.equal(
    effort.description,
    'Nivel de esforco (low|medium|high|xhigh|max) (obrigatoria)'
  );
  assert.equal(effort.defaultValue, undefined);
});

test('--max-wait e --no-wait-on-limit sao declaradas com a descricao da secao 4.1', () => {
  const maxWait = executarTasksCommand.options.find((o) => o.long === '--max-wait');
  const noWait = executarTasksCommand.options.find((o) => o.long === '--no-wait-on-limit');
  assert.ok(maxWait);
  assert.ok(noWait);
  assert.equal(maxWait.flags, '--max-wait <duracao>');
  assert.equal(
    maxWait.description,
    'Teto de espera acumulada por limite de uso (ex.: 90, 30m, 6h, 1h30m)'
  );
  assert.equal(maxWait.defaultValue, '6h');
  assert.equal(noWait.flags, '--no-wait-on-limit');
  assert.equal(
    noWait.description,
    'Nao aguarda a renovacao da cota; encerra o lote no primeiro limite de uso'
  );
});

test('--max-wait aceita cada forma da gramatica e converte para segundos (RF-026)', () => {
  assert.equal(validateOptions(BASE_MAX_WAIT('90')).maxWaitSegundos, 90);
  assert.equal(validateOptions(BASE_MAX_WAIT('30m')).maxWaitSegundos, 1800);
  assert.equal(validateOptions(BASE_MAX_WAIT('6h')).maxWaitSegundos, 21600);
  assert.equal(validateOptions(BASE_MAX_WAIT('1h30m')).maxWaitSegundos, 5400);
});

test('o padrao de --max-wait e 6h e a espera vem ligada (RF-026, RF-027)', () => {
  const v = validateOptions(BASE);
  assert.equal(v.maxWait, '6h');
  assert.equal(v.maxWaitSegundos, 21600);
  assert.equal(v.waitOnLimit, true);
});

test('--no-wait-on-limit desliga a espera (RF-027)', () => {
  const v = validateOptions({ ...BASE, waitOnLimit: false });
  assert.equal(v.waitOnLimit, false);
});

function BASE_MAX_WAIT(maxWait: string): Record<string, unknown> {
  return { ...BASE, maxWait };
}

const VALOR_INVALIDO_EFFORT = (valor: string): string =>
  `Valor inválido para --effort: ${valor}. Valores aceitos: low, medium, high, xhigh, max.`;
const TETO_MAX_WAIT = (valor: string): string =>
  `--max-wait aceita no máximo 12h. Valor recebido: ${valor}.`;
const FORMAS_MAX_WAIT = (valor: string): string =>
  `Valor inválido para --max-wait: ${valor}. Formas aceitas: 90 (segundos), 30m, 6h, 1h30m.`;

function mensagemDe(acao: () => unknown): string {
  try {
    acao();
  } catch (erro) {
    return (erro as Error).message;
  }
  return '';
}

test('--model ausente ou vazia lanca a mensagem literal, caractere a caractere (RF-011)', () => {
  assert.equal(mensagemDe(() => validateOptions({ effort: 'medium' })), MODELO_AUSENTE);
  assert.equal(mensagemDe(() => validateOptions({ model: '', effort: 'medium' })), MODELO_AUSENTE);
  assert.equal(
    mensagemDe(() => validateOptions({ model: '  ', effort: 'medium' })),
    MODELO_AUSENTE
  );
});

test('--effort ausente lanca a mensagem literal, caractere a caractere (RF-011)', () => {
  assert.equal(mensagemDe(() => validateOptions({ model: 'sonnet' })), ESFORCO_AUSENTE);
  assert.equal(mensagemDe(() => validateOptions({ model: 'sonnet', effort: '' })), ESFORCO_AUSENTE);
});

test('--effort invalida lanca a mensagem literal, caractere a caractere (RF-011)', () => {
  assert.equal(
    mensagemDe(() => validateOptions({ ...BASE, effort: 'turbo' })),
    VALOR_INVALIDO_EFFORT('turbo')
  );
});

test('--max-wait acima de 12h lanca a mensagem literal de teto (RF-026, D11)', () => {
  assert.equal(mensagemDe(() => validateOptions(BASE_MAX_WAIT('24h'))), TETO_MAX_WAIT('24h'));
  assert.equal(
    mensagemDe(() => validateOptions(BASE_MAX_WAIT('43201'))),
    TETO_MAX_WAIT('43201')
  );
  assert.equal(validateOptions(BASE_MAX_WAIT('12h')).maxWaitSegundos, 43200);
});

test('--max-wait em forma nao reconhecida lanca a mensagem literal de formas (RF-026)', () => {
  for (const forma of ['90x', '-1', '1h30', 'h', '6m30s', '']) {
    assert.equal(
      mensagemDe(() => validateOptions(BASE_MAX_WAIT(forma))),
      FORMAS_MAX_WAIT(forma)
    );
  }
});

test('--max-wait 0 e aceito e significa espera desligada por teto (RF-026)', () => {
  const v = validateOptions(BASE_MAX_WAIT('0'));
  assert.equal(v.maxWaitSegundos, 0);
  assert.equal(v.maxWait, '0');
});

const execFileAsync = promisify(execFile);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binPath = path.join(raiz, 'dist', 'index.js');

interface ResultadoCli {
  codigo: number | undefined;
  stdout: string;
  stderr: string;
}

async function rodarCli(
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<ResultadoCli> {
  return execFileAsync('node', [binPath, ...args], { cwd: raiz, env }).then(
    ({ stdout, stderr }) => ({ codigo: 0, stdout, stderr }),
    (erro: { code?: number; stdout?: string; stderr?: string }) => ({
      codigo: erro.code,
      stdout: String(erro.stdout ?? ''),
      stderr: String(erro.stderr ?? ''),
    })
  );
}

async function homeIsolado(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'specifica-validacao-'));
}

async function haRegistroDeExecucao(home: string): Promise<boolean> {
  const base = path.join(home, '.specifica-br', 'logs');
  if (!(await fs.pathExists(base))) {
    return false;
  }
  const projetos = await fs.readdir(base);
  for (const projeto of projetos) {
    const arquivos = await fs.readdir(path.join(base, projeto));
    if (arquivos.some((nome) => nome.endsWith('.jsonl'))) {
      return true;
    }
  }
  return false;
}

test('sem --model nenhum lote inicia em modo normal, --dry-run e --preflight (RF-011, RNF-004)', async () => {
  const home = await homeIsolado();
  const env = { ...process.env, HOME: home };
  const alvo = path.join(home, 'feature');

  for (const modo of [[], ['--dry-run'], ['--preflight']]) {
    const { codigo, stderr } = await rodarCli(
      ['executar-tasks', alvo, '--effort', 'medium', ...modo],
      env
    );
    assert.notEqual(codigo, 0, `modo ${modo.join(' ')} deveria falhar`);
    assert.ok(stderr.includes(MODELO_AUSENTE), `modo ${modo.join(' ')}: mensagem literal ausente`);
  }

  assert.equal(await haRegistroDeExecucao(home), false);
  await fs.remove(home);
});

test('sem --effort nenhum lote inicia em modo normal, --dry-run e --preflight (RF-011, RNF-004)', async () => {
  const home = await homeIsolado();
  const env = { ...process.env, HOME: home };
  const alvo = path.join(home, 'feature');

  for (const modo of [[], ['--dry-run'], ['--preflight']]) {
    const { codigo, stderr } = await rodarCli(
      ['executar-tasks', alvo, '--model', 'sonnet', ...modo],
      env
    );
    assert.notEqual(codigo, 0, `modo ${modo.join(' ')} deveria falhar`);
    assert.ok(stderr.includes(ESFORCO_AUSENTE), `modo ${modo.join(' ')}: mensagem literal ausente`);
  }

  assert.equal(await haRegistroDeExecucao(home), false);
  await fs.remove(home);
});

test('--pack-timeout tem default 900, aceita 0 e recusa negativo ou nao inteiro', () => {
  assert.equal(validateOptions({ ...BASE }).packTimeout, 900);
  assert.equal(validateOptions({ ...BASE, packTimeout: '0' }).packTimeout, 0);
  assert.equal(validateOptions({ ...BASE, packTimeout: '120' }).packTimeout, 120);
  assert.throws(() => validateOptions({ ...BASE, packTimeout: '-1' }));
  assert.throws(() => validateOptions({ ...BASE, packTimeout: '1.5' }));
  assert.throws(() => validateOptions({ ...BASE, packTimeout: 'muito' }));
});

test('--yes e declarada com a descricao de RF-025 e sem valor padrao explicito', () => {
  const yes = executarTasksCommand.options.find((o) => o.long === '--yes');
  assert.ok(yes);
  assert.equal(yes.flags, '-y, --yes');
  assert.equal(yes.description, 'Pula a confirmacao antes de iniciar o lote');
  assert.equal(yes.defaultValue, false);
});

test('--yes normaliza para true quando informada e false quando ausente (RF-025)', () => {
  assert.equal(validateOptions({ ...BASE, yes: true }).yes, true);
  assert.equal(validateOptions(BASE).yes, false);
  assert.equal(validateOptions({ ...BASE, yes: false }).yes, false);
});
