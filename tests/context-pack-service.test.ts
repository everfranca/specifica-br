import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { ContextPackService } from '../dist/utils/context-pack-service.js';
import { createLayout } from '../dist/utils/layouts/index.js';
import type { LayoutContext } from '../dist/utils/layouts/index.js';
import { createPainter, LEVEL, GLYPH } from '../dist/utils/terminal/index.js';
import type { StatusKind } from '../dist/utils/terminal/index.js';
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
  /** Resultados por chamada, na ordem. Esgotados, vale `resultado`. */
  resultados?: TaskResult[];
  escreveArquivo?: boolean;
  /** Chamadas, a partir de 1, em que o arquivo NAO e escrito. */
  naoEscreveNasChamadas?: number[];
  tamanhoArquivo?: number;
  stderr?: string;
  relatoDeModeloEfetivo?: boolean;
  rateLimit?: boolean;
}

function makeAdapter(cfg: AdapterConfig = {}) {
  const estado = {
    chamadas: 0,
    ultimoPrompt: '',
    entradas: [] as Array<{ packModel: string; packEffort: string }>,
  };
  const adapter = {
    capacidades: {
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
      relatoDeModeloEfetivo: cfg.relatoDeModeloEfetivo ?? true,
    },
    detectRateLimit(_texto: string): boolean {
      return cfg.rateLimit === true;
    },
    async runPack(
      prompt: string,
      entrada: { featureDir: string; packModel: string; packEffort: string },
      _cwd: string,
      onStderrChunk?: (chunk: string) => void
    ): Promise<TaskResult> {
      estado.chamadas += 1;
      estado.ultimoPrompt = prompt;
      estado.entradas.push({ packModel: entrada.packModel, packEffort: entrada.packEffort });
      if (onStderrChunk) {
        onStderrChunk(cfg.stderr ?? 'erro do filho\n');
      }
      const pula = cfg.naoEscreveNasChamadas?.includes(estado.chamadas) ?? false;
      if (cfg.escreveArquivo !== false && !pula) {
        await fs.writeFile(
          path.join(entrada.featureDir, 'contexto-execucao.md'),
          'x'.repeat(cfg.tamanhoArquivo ?? 350)
        );
      }
      const daVez = cfg.resultados?.[estado.chamadas - 1];
      return daVez ?? cfg.resultado ?? baseResult();
    },
  };
  return { adapter, estado };
}

/**
 * Espera falsa (CT-048). Nao aguarda tempo real: apenas registra a entrada e
 * devolve o desfecho programado, na ordem.
 */
function makeEspera(desfechos: Array<{ retomar: boolean; motivo?: string }>) {
  const entradas: Array<Record<string, unknown>> = [];
  const espera = {
    async aguardar(entrada: Record<string, unknown>) {
      entradas.push(entrada);
      const d = desfechos[entradas.length - 1] ?? { retomar: false, motivo: 'sem desfecho' };
      return {
        retomar: d.retomar,
        motivoDaDesistencia: d.retomar ? null : (d.motivo ?? 'teto de espera esgotado'),
      };
    },
  };
  return { espera, entradas };
}

/** Relogio falso: avanca `passoMs` a cada leitura. */
function makeRelogio(passoMs = 64_000) {
  let instante = BASE_MS;
  return {
    agora(): number {
      const atual = instante;
      instante += passoMs;
      return atual;
    },
    async esperar(): Promise<void> {},
  };
}

/** Canal unico de mensagens (RF-003): captura `(kind, texto)`. */
function makeCanal() {
  const mensagens: Array<[string, string]> = [];
  return {
    mensagens,
    onMensagem: (kind: string, texto: string): void => {
      mensagens.push([kind, texto]);
    },
  };
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
      model: 'sonnet',
      effort: 'low' as const,
      packMaxTokens: 8000,
      cacheTuning: true,
      packTimeoutSegundos: 0,
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
  const canal = makeCanal();

  await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));
  assert.deepEqual(canal.mensagens, [
    ['aviso', 'falha ao construir o Contexto de Execucao - seguindo sem ele'],
  ]);
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
  const canal = makeCanal();

  await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, packMaxTokens: 10 },
    })
  );
  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) =>
        kind === 'aviso' &&
        texto ===
          'Contexto de Execucao acima do teto: ~100 > 10 tokens. O excedente sera pago em cada task.'
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
  const canal = makeCanal();

  const r = await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, packMaxTokens: 0 },
    })
  );
  assert.equal(r.acimaDoTeto, false);
  assert.ok(!canal.mensagens.some(([, texto]) => texto.includes('acima do teto')));
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
      duracaoNaoContabilizadaSegundos: 0,
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
      duracaoNaoContabilizadaSegundos: 0,
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

// ---------------------------------------------------------------------------
// task-10: modelo do lote, modelo efetivo, canal unico e espera na construcao
// ---------------------------------------------------------------------------

test('a construcao usa o modelo e o esforco do LOTE, e o registro preserva os nomes de campo', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter({
    resultado: baseResult({ modelosReportados: 'claude-opus-4-6' }),
  });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  await svc.ensure(
    makeContexto({ opcoes: { ...makeContexto().opcoes, model: 'opus', effort: 'high' } })
  );

  // RF-012: o par chega ao adapter pelos NOMES vigentes de BuildContextPackArgsInput.
  assert.deepEqual(estado.entradas, [{ packModel: 'opus', packEffort: 'high' }]);

  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.pack_model, 'opus');
  assert.equal(ev.pack_effort, 'high');
});

test('a regra de divergencia nao dispara quando o reportado contem o solicitado', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({
    resultado: baseResult({ modelosReportados: 'claude-opus-4-6' }),
  });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, model: 'opus', effort: 'high' },
    })
  );

  assert.ok(!canal.mensagens.some(([kind]) => kind === 'aviso'));
  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.pack_model_divergente, false);
  assert.equal(ev.pack_model_efetivo, 'claude-opus-4-6');
});

test('a linha de conclusao traz o modelo efetivo, os bytes e a duracao formatada', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({
    tamanhoArquivo: 12480,
    resultado: baseResult({ modelosReportados: 'claude-opus-4-6' }),
  });
  const { logger } = makeLogger();
  const svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    null,
    makeRelogio(64_000) as never
  );
  const canal = makeCanal();

  await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, model: 'opus', packMaxTokens: 0 },
    })
  );

  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) =>
        kind === 'ok' &&
        texto === 'Contexto de Execucao construido em claude-opus-4-6 - 12.480 bytes - 1m 04s'
    )
  );
});

test('destilado reaproveitado publica so a mensagem de reaproveitamento pelo canal unico', async () => {
  await escreverFontes();
  await escreverDestilado(BASE_MS + 10_000);
  const { adapter, estado } = makeAdapter();
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  const r = await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));

  assert.equal(r.decisao, 'reaproveitado');
  assert.equal(estado.chamadas, 0);
  assert.deepEqual(canal.mensagens, [
    ['info', 'Contexto de Execucao em dia - reaproveitando o destilado existente'],
  ]);
  // Nenhuma linha de conclusao e nenhum pack_model_efetivo no reaproveitamento.
  assert.ok(!eventos.some((e) => e.event === 'pack_build'));
});

test('espera bem-sucedida durante a construcao refaz a construcao e o lote prossegue', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter({
    rateLimit: true,
    naoEscreveNasChamadas: [1],
    resultados: [
      baseResult({ isError: true, exitCode: 1, rawStdout: 'usage limit reached' }),
      baseResult({ modelosReportados: 'claude-sonnet-4-5' }),
    ],
  });
  const { logger, eventos } = makeLogger();
  const { espera, entradas } = makeEspera([{ retomar: true }]);
  const svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    espera as never,
    makeRelogio(1000) as never
  );

  const r = await svc.ensure(makeContexto({ opcoes: { ...makeContexto().opcoes, packMaxTokens: 0 } }));

  assert.equal(r.decisao, 'construido');
  assert.equal(estado.chamadas, 2);
  assert.equal(entradas.length, 1);
  assert.equal(entradas[0].contexto, 'context_pack');
  assert.equal(entradas[0].task, null);
  assert.equal(entradas[0].tentativa, 1);
  const rl = eventos.find((e) => e.event === 'rate_limited');
  assert.ok(rl);
  assert.equal(rl.contexto, 'context_pack');
});

test('divergencia COM a capacidade emite o aviso nomeando reportado e solicitado', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({
    relatoDeModeloEfetivo: true,
    resultado: baseResult({ modelosReportados: 'claude-sonnet-4-5' }),
  });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, model: 'opus', packMaxTokens: 0 },
    })
  );

  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) =>
        kind === 'aviso' &&
        texto === 'Contexto de Execucao construido em claude-sonnet-4-5, e não em opus'
    )
  );
  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.pack_model_divergente, true);
  assert.equal(ev.pack_model_efetivo, 'claude-sonnet-4-5');
});

test('divergencia SEM a capacidade nao emite aviso, mas grava pack_model_efetivo assim mesmo', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({
    relatoDeModeloEfetivo: false,
    resultado: baseResult({ modelosReportados: 'claude-sonnet-4-5' }),
  });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(
    makeContexto({
      onMensagem: canal.onMensagem,
      opcoes: { ...makeContexto().opcoes, model: 'opus', packMaxTokens: 0 },
    })
  );

  assert.ok(!canal.mensagens.some(([kind]) => kind === 'aviso'));
  // CT-047: a capacidade governa o aviso, nunca a gravacao do campo.
  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.pack_model_efetivo, 'claude-sonnet-4-5');
  // Sem relato confiavel a linha apresenta o SOLICITADO, identificado como tal.
  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) => kind === 'ok' && texto.includes('em opus (solicitado) - ')
    )
  );
});

test('espera esgotada na construcao devolve falhou/limite_de_uso e nao reaproveita destilado desatualizado', async () => {
  await escreverFontes();
  // Destilado antigo presente e DESATUALIZADO: techspec.md e mais recente.
  const antigo = await escreverDestilado(BASE_MS - 10_000, 'destilado velho');
  const { adapter, estado } = makeAdapter({
    rateLimit: true,
    escreveArquivo: false,
    resultado: baseResult({ isError: true, exitCode: 1, rawStdout: 'usage limit reached' }),
  });
  const { logger, eventos } = makeLogger();
  const { espera, entradas } = makeEspera([
    { retomar: false, motivo: 'teto de espera de 6h esgotado sem renovacao da cota' },
  ]);
  const svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    espera as never,
    makeRelogio(1000) as never
  );
  const canal = makeCanal();

  const r = await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));

  assert.equal(r.decisao, 'falhou');
  assert.equal(r.motivo, 'limite_de_uso');
  // RF-021: sem destilado. `caminhoParaInjecao` recusa o destilado desatualizado.
  assert.equal(r.caminho, null);
  assert.equal(svc.caminhoParaInjecao(r), null);
  assert.equal(await fs.readFile(antigo, 'utf8'), 'destilado velho');
  assert.equal(estado.chamadas, 1);
  assert.equal(entradas.length, 1);
  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) =>
        kind === 'aviso' &&
        texto === 'teto de espera de 6h esgotado sem renovacao da cota - encerrando o lote'
    )
  );
  // A tentativa barrada nao produz pack_build nem pack_build_failed.
  assert.ok(!eventos.some((e) => e.event === 'pack_build'));
  assert.ok(!eventos.some((e) => e.event === 'pack_build_failed'));
});

test('sucesso que menciona limite de uso no texto nao dispara espera', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter({
    rateLimit: true,
    resultado: baseResult({ rawStderr: 'aviso: usage limit perto do fim' }),
  });
  const { logger } = makeLogger();
  const { espera, entradas } = makeEspera([{ retomar: true }]);
  const svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    espera as never,
    makeRelogio(1000) as never
  );

  const r = await svc.ensure(makeContexto({ opcoes: { ...makeContexto().opcoes, packMaxTokens: 0 } }));

  assert.equal(r.decisao, 'construido');
  assert.equal(estado.chamadas, 1);
  assert.equal(entradas.length, 0);
});

test('a mensagem de reaproveitamento encerra o indicador antes de escrever e respeita o layout', async () => {
  await escreverFontes();
  await escreverDestilado(BASE_MS + 10_000);
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  const writes: string[] = [];
  const stream = {
    isTTY: true,
    write(texto: string): boolean {
      writes.push(String(texto));
      return true;
    },
  };
  const contexto: LayoutContext = {
    painter: createPainter(LEVEL.NONE),
    glyphLevel: GLYPH.ASCII,
    isTTY: true,
    largura: 100,
    stream: stream as unknown as NodeJS.WritableStream,
    estiloCabecalho: 'painel',
  };
  const layout = createLayout('coluna', contexto);

  // Indicador ativo: e o caso em que a escrita direta se sobreporia a ele.
  layout.taskStart({
    arquivo: 'task-1.md',
    numero: 1,
    posicao: 1,
    total: 1,
    model: 'sonnet',
    effort: 'low',
    usouContextoExecucao: false,
  });
  const antes = writes.length;

  await svc.ensure(makeContexto({ onMensagem: (k: StatusKind, t: string) => layout.message(k, t) }));
  layout.dispose();

  const publicadas = writes.slice(antes);
  const linha = publicadas.find((w) => w.includes('reaproveitando o destilado existente'));
  assert.ok(linha, 'a mensagem foi escrita pela camada de apresentacao');
  // RF-003: o rotulo e montado pela apresentacao, nao pelo servico.
  assert.match(linha, /\[INFO\]/);
  // O indicador foi encerrado ANTES da escrita: a linha da mensagem nao carrega
  // resto de quadro do indicador, e a sequencia de limpeza a precede.
  const indice = publicadas.indexOf(linha);
  assert.ok(
    publicadas.slice(0, indice).some((w) => w.includes('\x1b[2K') || w.includes('\r')),
    'o indicador e limpo antes da escrita'
  );
  assert.equal(linha.startsWith('\r'), false);
  assert.match(linha, /^\[INFO\]/);
});

// ---------------------------------------------------------------------------
// Feedback da construcao (RF-029) e morte do filho (CT-050).
// ---------------------------------------------------------------------------

/** Canal de etapa longa: captura inicio e fim, e a ordem em que chegam. */
function makeCanalDeEtapa(ordem: string[]) {
  const inicios: Array<{ rotulo: string; model: string; effort: string }> = [];
  const fins: Array<[string, string]> = [];
  return {
    inicios,
    fins,
    onEtapaInicio: (info: { rotulo: string; model: string; effort: string }): void => {
      ordem.push('etapaStart');
      inicios.push(info);
    },
    onEtapaFim: (kind: string, texto: string): void => {
      ordem.push('etapaEnd');
      fins.push([kind, texto]);
    },
  };
}

/**
 * Adapter que registra a ordem dos eventos e devolve um `TaskResult` de filho
 * morto por SIGTERM: `exitCode: -1`, stdout vazio, nenhum arquivo escrito.
 */
function makeAdapterMorto(
  ordem: string[],
  desfecho: { aborted?: boolean; timedOut?: boolean },
  aoInvocar?: () => void
) {
  const estado = { chamadas: 0, timeouts: [] as Array<number | undefined> };
  const adapter = {
    capacidades: { relatoDeModeloEfetivo: true },
    detectRateLimit(): boolean {
      return false;
    },
    async runPack(
      _prompt: string,
      _entrada: unknown,
      _cwd: string,
      _onStderrChunk?: (chunk: string) => void,
      _signal?: AbortSignal,
      timeoutMs?: number
    ): Promise<TaskResult> {
      ordem.push('runPack');
      estado.chamadas += 1;
      estado.timeouts.push(timeoutMs);
      aoInvocar?.();
      return baseResult({
        subtype: desfecho.aborted ? 'interrompido' : 'timeout',
        isError: true,
        exitCode: -1,
        rawStdout: '',
        signal: 'SIGTERM',
        aborted: desfecho.aborted === true,
        timedOut: desfecho.timedOut === true,
      });
    },
  };
  return { adapter, estado };
}

test('a mensagem de inicio da construcao e publicada ANTES da chamada a runPack', async () => {
  await escreverFontes();
  const ordem: string[] = [];
  const { adapter } = makeAdapter();
  const adapterInstrumentado = {
    ...adapter,
    async runPack(...args: Parameters<typeof adapter.runPack>) {
      ordem.push('runPack');
      return adapter.runPack(...args);
    },
  };
  const { logger } = makeLogger();
  const svc = new ContextPackService(
    adapterInstrumentado as never,
    new AccountingService(),
    logger as never
  );
  const etapa = makeCanalDeEtapa(ordem);

  await svc.ensure(makeContexto(etapa));

  assert.deepEqual(ordem, ['etapaStart', 'runPack', 'etapaEnd']);
  assert.deepEqual(etapa.inicios, [
    { rotulo: 'Construindo o Contexto de Execucao', model: 'sonnet', effort: 'low' },
  ]);
  assert.equal(etapa.fins[0]?.[0], 'ok');
});

test('a construcao interrompida vira pack_build_interrompido, e nao falha de construcao', async () => {
  await escreverFontes();
  const ordem: string[] = [];
  const { logger, eventos } = makeLogger();
  let svc: ContextPackService;
  const { adapter } = makeAdapterMorto(ordem, { aborted: true }, () => svc.abort());
  svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    null,
    makeRelogio(64_000) as never
  );
  const canal = makeCanal();
  const etapa = makeCanalDeEtapa(ordem);

  const r = await svc.ensure(makeContexto({ onMensagem: canal.onMensagem, ...etapa }));

  assert.equal(r.decisao, 'interrompido');
  assert.equal(r.motivo, 'interrompido');
  assert.equal(svc.caminhoParaInjecao(r), null);

  const interrompido = eventos.find((e) => e.event === 'pack_build_interrompido');
  assert.ok(interrompido, 'evento pack_build_interrompido nao foi gravado');
  assert.equal(interrompido.motivo, 'interrompido_pelo_usuario');
  assert.equal(interrompido.consumo_nao_contabilizado, true);
  assert.equal(interrompido.duracao_segundos, 64);
  assert.equal(eventos.filter((e) => e.event === 'pack_build_failed').length, 0);

  const todas = [...canal.mensagens, ...etapa.fins];
  assert.ok(
    !todas.some(([, texto]) => texto.includes('falha ao construir o Contexto de Execucao')),
    'o aviso de falha saiu depois de um Ctrl+C'
  );
  assert.equal(svc.consumoNaoContabilizadoSegundos, 64);
});

test('o teto de tempo mata a construcao, nomeia o motivo e nao aborta o lote', async () => {
  await escreverFontes();
  const ordem: string[] = [];
  const { adapter, estado } = makeAdapterMorto(ordem, { timedOut: true });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(
    adapter as never,
    new AccountingService(),
    logger as never,
    null,
    makeRelogio(64_000) as never
  );
  const etapa = makeCanalDeEtapa(ordem);

  const r = await svc.ensure(
    makeContexto({
      ...etapa,
      opcoes: { ...makeContexto().opcoes, packTimeoutSegundos: 900 },
    })
  );

  assert.deepEqual(estado.timeouts, [900_000], 'o teto nao chegou ao adapter');
  assert.equal(r.decisao, 'falhou');
  assert.equal(r.motivo, 'timeout');
  assert.equal(svc.caminhoParaInjecao(r), null);

  const ev = eventos.find((e) => e.event === 'pack_build_interrompido');
  assert.ok(ev);
  assert.equal(ev.motivo, 'timeout');

  const [kind, texto] = etapa.fins[0] ?? ['', ''];
  assert.equal(kind, 'aviso');
  assert.ok(texto.includes('teto de tempo'), texto);
  assert.ok(texto.includes('seguindo sem ele'), texto);
});

test('packTimeoutSegundos igual a 0 nao arma teto algum no adapter', async () => {
  await escreverFontes();
  const ordem: string[] = [];
  const { adapter, estado } = makeAdapterMorto(ordem, { timedOut: true });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);

  await svc.ensure(makeContexto());

  assert.deepEqual(estado.timeouts, [0]);
});

test('a falha ja ocorrida volta a ser anunciada em cada ensure seguinte', async () => {
  await escreverFontes();
  const { adapter, estado } = makeAdapter({ escreveArquivo: false });
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));
  const depoisDaPrimeira = canal.mensagens.length;
  const segunda = await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));

  assert.equal(estado.chamadas, 1, 'a construcao foi repetida');
  assert.equal(segunda.decisao, 'falhou');
  assert.ok(
    canal.mensagens.length > depoisDaPrimeira,
    'a segunda avaliacao devolveu o cache em silencio'
  );
  assert.ok(
    canal.mensagens
      .slice(depoisDaPrimeira)
      .some(([kind, texto]) => kind === 'aviso' && texto.includes('nao sera repetida'))
  );
});

test('architecture.md ausente a partir do projectRoot vira aviso, e nao silencio', async () => {
  await fs.writeFile(path.join(featureDir, 'techspec.md'), '# techspec');
  await fs.writeFile(path.join(featureDir, 'prd.md'), '# prd');
  const { adapter } = makeAdapter();
  const { logger } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));
  await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));

  const avisos = canal.mensagens.filter(([, texto]) =>
    texto.includes('specs/core/architecture.md nao encontrado')
  );
  assert.equal(avisos.length, 1, 'o aviso deveria sair uma unica vez por execucao');
});

test('permissao negada na construcao aparece na tela e no evento pack_build', async () => {
  await escreverFontes();
  const { adapter } = makeAdapter({
    resultado: baseResult({ permissionDenials: 2, ferramentasNegadas: 'WebFetch' }),
  });
  const { logger, eventos } = makeLogger();
  const svc = new ContextPackService(adapter as never, new AccountingService(), logger as never);
  const canal = makeCanal();

  await svc.ensure(makeContexto({ onMensagem: canal.onMensagem }));

  const ev = eventos.find((e) => e.event === 'pack_build');
  assert.ok(ev);
  assert.equal(ev.permission_denials, 2);
  assert.equal(ev.ferramentas_negadas, 'WebFetch');
  assert.ok(
    canal.mensagens.some(
      ([kind, texto]) =>
        kind === 'aviso' && texto.includes('permissao(oes) negada(s)') && texto.includes('WebFetch')
    )
  );
});
