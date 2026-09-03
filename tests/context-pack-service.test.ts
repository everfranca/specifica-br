import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { ContextPackService } from '../dist/utils/context-pack-service.js';
import { AccountingService } from '../dist/utils/accounting.js';
import * as promptModule from '../dist/utils/context-pack-prompt.js';
import type { TaskResult } from '../dist/types/tool-adapter.js';

let root: string;
let featureDir: string;

const BASE_MS = 1_600_000_000_000;

function baseResult(over: Partial<TaskResult> = {}): TaskResult {
  return {
    sessionId: 'sess-1',
    subtype: 'success',
    isError: false,
    exitCode: 0,
    numTurns: 3,
    durationMs: 10,
    durationApiMs: 8,
    costUsd: 0.0421,
    model: 'claude-sonnet-4-5',
    modelosReportados: 'claude-sonnet-4-5',
    inputTokens: 900,
    outputTokens: 5200,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 12000,
    reasoningTokens: null,
    permissionDenials: 0,
    contabilidadeParcial: false,
    ferramentasNegadas: null,
    rawStdout: '{}',
    rawStderr: '',
    ...over,
  };
}

interface AdapterConfig {
  resultado?: TaskResult;
  escreveArquivo?: boolean;
  tamanhoArquivo?: number;
  stderr?: string;
}

function makeAdapter(cfg: AdapterConfig = {}) {
  const estado = { chamadas: 0, ultimoPrompt: '' };
  const adapter = {
    async runPack(
      prompt: string,
      entrada: { featureDir: string },
      _cwd: string,
      onStderrChunk?: (chunk: string) => void
    ): Promise<TaskResult> {
      estado.chamadas += 1;
      estado.ultimoPrompt = prompt;
      if (onStderrChunk) {
        onStderrChunk(cfg.stderr ?? 'erro do filho\n');
      }
      if (cfg.escreveArquivo !== false) {
        await fs.writeFile(
          path.join(entrada.featureDir, 'contexto-execucao.md'),
          'x'.repeat(cfg.tamanhoArquivo ?? 350)
        );
      }
      return cfg.resultado ?? baseResult();
    },
  };
  return { adapter, estado };
}

function makeLogger() {
  const eventos: Record<string, unknown>[] = [];
  const stderrChunks: string[] = [];
  const logger = {
    async logEvent(evento: Record<string, unknown>): Promise<void> {
      eventos.push(evento);
    },
    appendStderr(texto: string): void {
      stderrChunks.push(texto);
    },
  };
  return { logger, eventos, stderrChunks };
}

function makeContexto(over: Record<string, unknown> = {}) {
  return {
    featureDir,
    projectRoot: root,
    cwd: root,
    opcoes: {
      contextPack: true,
      packModel: 'sonnet',
      packEffort: 'low' as const,
      packMaxTokens: 8000,
      cacheTuning: true,
    },
    ...over,
  };
}

async function setMtime(p: string, ms: number): Promise<void> {
  await fs.utimes(p, new Date(ms), new Date(ms));
}

async function escreverFontes(): Promise<void> {
  await fs.writeFile(path.join(featureDir, 'techspec.md'), '# techspec');
  await fs.writeFile(path.join(featureDir, 'prd.md'), '# prd');
  await fs.writeFile(path.join(root, 'specs', 'core', 'architecture.md'), '# arch');
  await setMtime(path.join(featureDir, 'techspec.md'), BASE_MS);
  await setMtime(path.join(featureDir, 'prd.md'), BASE_MS);
  await setMtime(path.join(root, 'specs', 'core', 'architecture.md'), BASE_MS);
}

async function escreverDestilado(ms: number, conteudo = 'destilado'): Promise<string> {
  const p = path.join(featureDir, 'contexto-execucao.md');
  await fs.writeFile(p, conteudo);
  await setMtime(p, ms);
  return p;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cps-'));
  featureDir = path.join(root, 'specs', 'features', 'f');
  await fs.ensureDir(featureDir);
  await fs.ensureDir(path.join(root, 'specs', 'core'));
});

afterEach(async () => {
  await fs.remove(root);
});

test('precisaReconstruir devolve true quando o destilado nao existe', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const d = await svc.precisaReconstruir(featureDir, root);
  assert.deepEqual(d, { reconstruir: true, motivo: 'inexistente', fonteAlterada: null });
});

test('precisaReconstruir devolve false quando o destilado e mais recente que todas as fontes', async () => {
  await escreverFontes();
  await escreverDestilado(BASE_MS + 10_000);
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const d = await svc.precisaReconstruir(featureDir, root);
  assert.equal(d.reconstruir, false);
  assert.equal(d.motivo, 'em_dia');
});

test('precisaReconstruir devolve true e identifica a fonte quando techspec.md e mais recente', async () => {
  await escreverFontes();
  await escreverDestilado(BASE_MS + 10_000);
  await setMtime(path.join(featureDir, 'techspec.md'), BASE_MS + 20_000);
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const d = await svc.precisaReconstruir(featureDir, root);
  assert.equal(d.reconstruir, true);
  assert.equal(d.motivo, 'fonte_mais_recente');
  assert.equal(d.fonteAlterada, path.join(featureDir, 'techspec.md'));
});

test('precisaReconstruir respeita a ordem de precedencia techspec, prd, architecture', async () => {
  await escreverFontes();
  await escreverDestilado(BASE_MS + 10_000);
  await setMtime(path.join(featureDir, 'techspec.md'), BASE_MS + 30_000);
  await setMtime(path.join(featureDir, 'prd.md'), BASE_MS + 40_000);
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const d = await svc.precisaReconstruir(featureDir, root);
  assert.equal(d.fonteAlterada, path.join(featureDir, 'techspec.md'));
});

test('precisaReconstruir ignora fonte ausente sem erro', async () => {
  await fs.writeFile(path.join(featureDir, 'techspec.md'), '# techspec');
  await setMtime(path.join(featureDir, 'techspec.md'), BASE_MS);
  await escreverDestilado(BASE_MS + 10_000);
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const d = await svc.precisaReconstruir(featureDir, root);
  assert.equal(d.reconstruir, false);
});

test('ensure com --no-context-pack devolve desligado e nao invoca o adapter', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter();
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const r = await svc.ensure(makeContexto({ opcoes: { ...makeContexto().opcoes, contextPack: false } }));
  assert.equal(r.decisao, 'desligado');
  assert.equal(r.caminho, null);
  assert.equal(estado.chamadas, 0);
  assert.equal(eventos.length, 0);
});

test('ensure reaproveita e grava pack_reused quando esta em dia', async () => {
  await escreverFontes();
  const destilado = await escreverDestilado(BASE_MS + 10_000);
  const { adapter, estado } = makeAdapter();
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const r = await svc.ensure(makeContexto());
  assert.equal(r.decisao, 'reaproveitado');
  assert.equal(estado.chamadas, 0);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].event, 'pack_reused');
  assert.equal(eventos[0].arquivo, destilado);
});

test('ensure constroi e grava pack_build com os quatro contadores de token', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter();
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const r = await svc.ensure(makeContexto());
  assert.equal(r.decisao, 'construido');
  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.input_tokens, 900);
  assert.equal(ev.output_tokens, 5200);
  assert.equal(ev.cache_creation_input_tokens, 0);
  assert.equal(ev.cache_read_input_tokens, 12000);
  assert.equal(ev.tokens_gastos, 18100);
  assert.equal(ev.tokens_gastos_acumulado_depois, 18100);
  assert.equal(ev.session_id, 'sess-1');
});

test('ensure exige as tres condicoes de sucesso', async () => {
  const cenarios: AdapterConfig[] = [
    { resultado: baseResult({ exitCode: 1, subtype: 'parse_error' }) },
    { resultado: baseResult({ isError: true }) },
    { escreveArquivo: false },
  ];

  for (const cfg of cenarios) {
    await fs.emptyDir(featureDir);
    await escreverFontes();
    const { adapter } = makeAdapter(cfg);
    const { logger } = makeLogger();
    const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
    const r = await svc.ensure(makeContexto());
    assert.equal(r.decisao, 'falhou');
    assert.equal(r.caminho, null);
  }
});

test('falha na construcao emite o AVISO com o texto exato', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ escreveArquivo: false });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const mensagens: string[] = [];

  await svc.ensure(makeContexto({ onMensagem: (m: string) => mensagens.push(m) }));
  assert.ok(
    mensagens.includes('[ AVIS] falha ao construir o Contexto de Execucao - seguindo sem ele')
  );
});

test('falha na construcao acumula os tokens gastos', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ escreveArquivo: false });
  const { logger } = makeLogger();
  const accounting = new AccountingService();
  const svc = new ContextPackService(adapter as never, accounting, logger as never);

  const r = await svc.ensure(makeContexto());
  assert.equal(r.tokensGastos, 18100);
  assert.equal(accounting.total.tokensGastosAcumulado, 18100);
});

test('falha na construcao grava pack_build_failed com motivo, subtype, exit_code e tokens_gastos', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ resultado: baseResult({ exitCode: 1, subtype: 'parse_error' }) });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  await svc.ensure(makeContexto());
  const ev = eventos.find((e) => e.event === 'pack_build_failed');
  assert.ok(ev);
  assert.equal(ev.motivo, 'exit_code');
  assert.equal(ev.subtype, 'parse_error');
  assert.equal(ev.exit_code, 1);
  assert.equal(ev.tokens_gastos, 18100);
});

test('estTokens usa a formula floor(bytes * 10 / 35)', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ tamanhoArquivo: 350 });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const r = await svc.ensure(makeContexto());
  assert.equal(r.bytes, 350);
  assert.equal(r.estTokens, 100);
});

test('acima do teto emite o AVISO com o texto exato e marca pack_over_ceiling', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ tamanhoArquivo: 350 });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const mensagens: string[] = [];

  await svc.ensure(
    makeContexto({
      onMensagem: (m: string) => mensagens.push(m),
      opcoes: { ...makeContexto().opcoes, packMaxTokens: 10 },
    })
  );
  assert.ok(
    mensagens.includes(
      '[ AVIS] Contexto de Execucao acima do teto: ~100 > 10 tokens. O excedente sera pago em cada task.'
    )
  );
  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.pack_over_ceiling, true);
});

test('acima do teto nao aborta: a decisao continua sendo construido', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ tamanhoArquivo: 350 });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const r = await svc.ensure(
    makeContexto({ opcoes: { ...makeContexto().opcoes, packMaxTokens: 10 } })
  );
  assert.equal(r.decisao, 'construido');
  assert.equal(r.acimaDoTeto, true);
});

test('pack-max-tokens igual a 0 desliga a verificacao de teto', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ tamanhoArquivo: 5000 });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const mensagens: string[] = [];

  const r = await svc.ensure(
    makeContexto({
      onMensagem: (m: string) => mensagens.push(m),
      opcoes: { ...makeContexto().opcoes, packMaxTokens: 0 },
    })
  );
  assert.equal(r.acimaDoTeto, false);
  assert.ok(!mensagens.some((m) => m.includes('acima do teto')));
});

test('ensure constroi no maximo uma vez por execucao', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  await svc.ensure(makeContexto());
  await svc.ensure(makeContexto());
  assert.equal(estado.chamadas, 1);
});

test('caminhoParaInjecao devolve null quando a decisao e falhou ou desligado', async () => {
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  assert.equal(
    svc.caminhoParaInjecao({
      decisao: 'falhou',
      caminho: null,
      bytes: 0,
      estTokens: 0,
      acimaDoTeto: false,
      motivo: 'x',
      fonteAlterada: null,
      tokensGastos: 0,
    }),
    null
  );
  assert.equal(
    svc.caminhoParaInjecao({
      decisao: 'desligado',
      caminho: null,
      bytes: 0,
      estTokens: 0,
      acimaDoTeto: false,
      motivo: 'desligado',
      fonteAlterada: null,
      tokensGastos: 0,
    }),
    null
  );
});

test('caminhoParaInjecao devolve o caminho absoluto quando reaproveitado ou construido', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const construido = await svc.ensure(makeContexto());
  const caminho = svc.caminhoParaInjecao(construido);
  assert.ok(caminho && path.isAbsolute(caminho));
  assert.equal(caminho, path.join(featureDir, 'contexto-execucao.md'));
});

test('a interpolacao substitui FEATURE_DIR e TEMPLATE_PATH pelo conteudo literal do template', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  await svc.ensure(makeContexto());
  assert.ok(!estado.ultimoPrompt.includes('{{FEATURE_DIR}}'));
  assert.ok(!estado.ultimoPrompt.includes('{{TEMPLATE_PATH}}'));
  assert.ok(estado.ultimoPrompt.includes(featureDir));
  assert.ok(estado.ultimoPrompt.includes(promptModule.CONTEXT_PACK_TEMPLATE));
});

test('o stderr da construcao vai para appendStderr e nao para stdout', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({ stderr: 'trace do filho\n' });
  const { logger, stderrChunks } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const original = process.stdout.write.bind(process.stdout);
  let escritas = 0;
  process.stdout.write = ((...args: unknown[]) => {
    escritas += 1;
    return (original as (...a: unknown[]) => boolean)(...args);
  }) as typeof process.stdout.write;

  try {
    await svc.ensure(makeContexto({ onMensagem: () => undefined }));
  } finally {
    process.stdout.write = original;
  }

  assert.equal(escritas, 0);
  assert.ok(stderrChunks.includes('trace do filho\n'));
});

test('context-pack-prompt exporta apenas constantes do tipo string', () => {
  const valores = Object.values(promptModule);
  assert.ok(valores.length >= 2);
  assert.ok(valores.every((v) => typeof v === 'string'));
  assert.equal(typeof promptModule.CONTEXT_PACK_PROMPT, 'string');
  assert.equal(typeof promptModule.CONTEXT_PACK_TEMPLATE, 'string');
});
