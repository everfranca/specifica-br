import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { PreflightService, abaixoDoPiso } from '../dist/utils/preflight-service.js';
import { TaskDiscoveryService } from '../dist/utils/task-discovery.js';
import type { ExecutarTasksOptions, PreflightContexto } from '../dist/types/executar-tasks.js';

const OPCOES_BASE: ExecutarTasksOptions = {
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
  packTimeout: 900,
  tasks: '',
  allow: [],
  preflight: true,
  skipPreflight: false,
  requireCmd: [],
  mcpTimeout: 15,
  mcpCheck: true,
  dryRun: false,
  yes: false,
};

let raiz: string;
let projetoDir: string;
let featureDir: string;
let homeDir: string;
let logsDir: string;

const MAPPING_CLAUDECODE = [
  {
    name: 'ClaudeCode',
    commands: '.claude/commands/',
    skills: '.claude/skills/',
    templates: 'specs/templates/',
    global: {
      commands: { base: 'home', path: '.claude/commands/' },
      skills: { base: 'home', path: '.claude/skills/' },
    },
  },
];

interface WhichMap {
  [cmd: string]: string | null;
}

function fakeRunner(which: WhichMap = {}): { which: (c: string) => Promise<string | null>; chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    which: async (cmd: string) => {
      chamadas.push(cmd);
      return Object.prototype.hasOwnProperty.call(which, cmd) ? which[cmd] : null;
    },
  };
}

function fakeAdapter(over: {
  versao?: string;
  mcpStatus?: Record<string, 'OK' | 'AVISO'>;
  modoDePermissao?: string;
} = {}): {
  getVersion: () => Promise<string>;
  modoDePermissaoEfetivo: (opcoes: ExecutarTasksOptions) => string;
  listMcps: (nomes: string[], t: number) => Promise<Array<{ nome: string; severidade: 'OK' | 'AVISO'; linha: null }>>;
  runTask: () => Promise<never>;
  mcpChamadas: number;
  runTaskChamadas: number;
  modoChamadas: number;
} {
  const estado = { mcpChamadas: 0, runTaskChamadas: 0, modoChamadas: 0 };
  return {
    get mcpChamadas() {
      return estado.mcpChamadas;
    },
    get runTaskChamadas() {
      return estado.runTaskChamadas;
    },
    get modoChamadas() {
      return estado.modoChamadas;
    },
    getVersion: async () => over.versao ?? '2.1.0 (Claude Code)',
    modoDePermissaoEfetivo: (opcoes: ExecutarTasksOptions) => {
      estado.modoChamadas += 1;
      if (over.modoDePermissao !== undefined) {
        return over.modoDePermissao;
      }
      if (opcoes.permissionMode) {
        return opcoes.permissionMode;
      }
      return opcoes.autoApprove ? 'bypassPermissions' : '';
    },
    listMcps: async (nomes: string[]) => {
      estado.mcpChamadas += 1;
      return nomes.map((nome) => ({
        nome,
        severidade: over.mcpStatus?.[nome] ?? 'AVISO',
        linha: null,
      }));
    },
    runTask: async () => {
      estado.runTaskChamadas += 1;
      throw new Error('runTask nao pode ser chamado pelo preflight');
    },
  };
}

function fakeFileService(mapping: unknown = MAPPING_CLAUDECODE): { loadToolsMapping: () => Promise<unknown> } {
  return { loadToolsMapping: async () => mapping };
}

function contexto(over: Partial<PreflightContexto> = {}): PreflightContexto {
  return {
    featureDir,
    projetoDir,
    home: homeDir,
    ferramenta: 'claudecode',
    tasksSelecionadas: [path.join(featureDir, 'task-1.md')],
    logsDir,
    opcoes: { ...OPCOES_BASE },
    ...over,
  };
}

function servico(runner: unknown, adapter: unknown, fileService: unknown): PreflightService {
  return new PreflightService(
    runner as never,
    adapter as never,
    fileService as never,
    new TaskDiscoveryService()
  );
}

const TASK_SECAO_9 = (itens: string): string =>
  `# Task\n\n| Metadata | Details |\n| :--- | :--- |\n| **Status** | TODO |\n\n## 9. Skills e MCPs\n\n${itens}\n\n---\n`;

async function cenarioFeliz(): Promise<void> {
  await fs.ensureDir(path.join(projetoDir, '.claude', 'commands'));
  await fs.writeFile(path.join(projetoDir, '.claude', 'commands', 'executar-task.md'), '# comando');
  await fs.ensureDir(path.join(projetoDir, '.claude', 'skills', 'validate-tasks'));
  await fs.writeFile(path.join(projetoDir, '.claude', 'skills', 'validate-tasks', 'SKILL.md'), '# skill');
  await fs.ensureDir(path.join(featureDir));
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **validate-tasks**\n    - *Tipo:* SKILL\n\n- [ ] **context7**\n    - *Tipo:* MCP')
  );
  await fs.writeFile(path.join(featureDir, 'tasks.md'), '# tasks');
  await fs.writeFile(path.join(featureDir, 'prd.md'), '# prd');
  await fs.writeFile(path.join(featureDir, 'techspec.md'), '# techspec');
  await fs.ensureDir(path.join(projetoDir, 'specs', 'core'));
  await fs.writeFile(path.join(projetoDir, 'specs', 'core', 'architecture.md'), '# arch');
  await fs.ensureDir(logsDir);
}

beforeEach(async () => {
  raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'pf-'));
  projetoDir = path.join(raiz, 'projeto');
  featureDir = path.join(projetoDir, 'specs', 'features', 'f');
  homeDir = path.join(raiz, 'home');
  logsDir = path.join(homeDir, '.specifica-br', 'logs', 'projeto-x');
  await fs.ensureDir(featureDir);
  await fs.ensureDir(homeDir);
});

afterEach(async () => {
  await fs.remove(raiz);
});

test('caminho feliz: todos os grupos OK, sem ERRO', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const adapter = fakeAdapter({ mcpStatus: { context7: 'OK' } });

  const resultado = await servico(runner, adapter, fakeFileService()).run(contexto());

  assert.strictEqual(resultado.temErro, false);
  assert.strictEqual(resultado.erros, 0);
  assert.ok(resultado.itens.some((i) => i.grupo === 'A' && i.severidade === 'OK'));
  assert.ok(resultado.itens.some((i) => i.grupo === 'B' && i.severidade === 'OK'));
  assert.ok(resultado.itens.some((i) => i.grupo === 'F' && i.severidade === 'OK'));
});

test('Grupo E extrai nome e tipo da secao 9 no formato de CT-014', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const adapter = fakeAdapter({ mcpStatus: { context7: 'OK' } });

  const resultado = await servico(runner, adapter, fakeFileService()).run(contexto());

  assert.ok(resultado.itens.some((i) => i.item === 'skill:validate-tasks'));
  assert.ok(resultado.itens.some((i) => i.item === 'mcp:context7'));
});

test('Grupo B aceita o comando instalado apenas no escopo global', async () => {
  await cenarioFeliz();
  await fs.remove(path.join(projetoDir, '.claude', 'commands'));
  await fs.ensureDir(path.join(homeDir, '.claude', 'commands'));
  await fs.writeFile(path.join(homeDir, '.claude', 'commands', 'executar-task.md'), '# comando');

  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const resultado = await servico(runner, fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(
    resultado.itens.some((i) => i.item === 'comando-executar-task' && i.severidade === 'OK')
  );
});

test('run nao escreve em stdout nem em stderr', async () => {
  await cenarioFeliz();
  const outW = process.stdout.write;
  const errW = process.stderr.write;
  let escreveu = 0;
  process.stdout.write = (() => {
    escreveu += 1;
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = (() => {
    escreveu += 1;
    return true;
  }) as typeof process.stderr.write;

  try {
    await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());
  } finally {
    process.stdout.write = outW;
    process.stderr.write = errW;
  }

  assert.strictEqual(escreveu, 0);
});

test('listMcps e invocado no maximo uma vez mesmo com varias tasks declarando MCPs', async () => {
  await cenarioFeliz();
  await fs.writeFile(
    path.join(featureDir, 'task-2.md'),
    TASK_SECAO_9('- [ ] **context7**\n    - *Tipo:* MCP')
  );
  const adapter = fakeAdapter({ mcpStatus: { context7: 'OK' } });
  const ctx = contexto({
    tasksSelecionadas: [path.join(featureDir, 'task-1.md'), path.join(featureDir, 'task-2.md')],
  });

  await servico(fakeRunner({ claude: '/c' }), adapter, fakeFileService()).run(ctx);

  assert.strictEqual(adapter.mcpChamadas, 1);
});

test('nao invoca listMcps com --no-mcp-check e registra item OK', async () => {
  await cenarioFeliz();
  const adapter = fakeAdapter();
  const ctx = contexto({
    opcoes: { ...OPCOES_BASE, mcpCheck: false },
  });

  const resultado = await servico(fakeRunner({ claude: '/c' }), adapter, fakeFileService()).run(ctx);

  assert.strictEqual(adapter.mcpChamadas, 0);
  assert.ok(resultado.itens.some((i) => i.item === 'mcp-check' && i.severidade === 'OK'));
});

function itemErro(resultado: { itens: Array<{ severidade: string; mensagem: string; item: string; grupo: string }> }, filtro: (i: { grupo: string; item: string }) => boolean) {
  return resultado.itens.find((i) => i.severidade === 'ERRO' && filtro(i));
}

test('Grupo A marca ERRO com a mensagem nominal quando a CLI nao esta no PATH', async () => {
  await cenarioFeliz();
  const resultado = await servico(fakeRunner({}), fakeAdapter({ versao: '' }), fakeFileService()).run(contexto());

  const erro = itemErro(resultado, (i) => i.grupo === 'A' && i.item === 'cli-claude');
  assert.strictEqual(
    erro?.mensagem,
    'CLI de claudecode nao encontrada no PATH. Abortado antes de gastar tokens.'
  );
});

test('Grupo A marca ERRO quando getVersion devolve string vazia', async () => {
  await cenarioFeliz();
  const resultado = await servico(
    fakeRunner({ claude: '/usr/bin/claude' }),
    fakeAdapter({ versao: '' }),
    fakeFileService()
  ).run(contexto());

  assert.ok(itemErro(resultado, (i) => i.grupo === 'A' && i.item === 'cli-versao'));
});

test('Grupo A verifica cada --require-cmd e marca ERRO para o ausente', async () => {
  await cenarioFeliz();
  const ctx = contexto({
    opcoes: { ...OPCOES_BASE, requireCmd: ['git', 'inexistente'] },
  });
  const resultado = await servico(
    fakeRunner({ claude: '/c', git: '/usr/bin/git' }),
    fakeAdapter(),
    fakeFileService()
  ).run(ctx);

  assert.ok(resultado.itens.some((i) => i.item === 'require-cmd:git' && i.severidade === 'OK'));
  assert.ok(itemErro(resultado, (i) => i.item === 'require-cmd:inexistente'));
});

test('Grupo A nao verifica jq, bc nem column', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/c' });
  await servico(runner, fakeAdapter(), fakeFileService()).run(contexto());

  for (const proibido of ['jq', 'bc', 'column']) {
    assert.ok(!runner.chamadas.includes(proibido));
  }
});

test('Grupo B marca ERRO com a mensagem nominal quando executar-task nao esta instalado', async () => {
  await cenarioFeliz();
  await fs.remove(path.join(projetoDir, '.claude', 'commands'));
  const resultado = await servico(
    fakeRunner({ claude: '/c' }),
    fakeAdapter(),
    fakeFileService()
  ).run(contexto());

  const erro = itemErro(resultado, (i) => i.item === 'comando-executar-task');
  assert.strictEqual(
    erro?.mensagem,
    'comando executar-task nao instalado para claudecode. Rode: specifica-br init'
  );
});

test('Grupo C marca ERRO quando nenhum modo de permissao foi informado', async () => {
  await cenarioFeliz();
  const ctx = contexto({
    opcoes: { ...OPCOES_BASE, autoApprove: false },
  });
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(ctx);

  const erro = itemErro(resultado, (i) => i.item === 'permissao');
  assert.strictEqual(
    erro?.mensagem,
    'nenhuma permissao concedida - as tasks travariam nos prompts. Use --auto-approve'
  );
});

test('Grupo C aceita --auto-approve e --permission-mode explicito', async () => {
  await cenarioFeliz();
  const ctxExplicito = contexto({
    opcoes: { ...OPCOES_BASE, autoApprove: false, permissionMode: 'acceptEdits' },
  });
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(ctxExplicito);

  assert.ok(resultado.itens.some((i) => i.item === 'permissao' && i.severidade === 'OK'));
  assert.ok(!itemErro(resultado, (i) => i.item === 'permissao'));
});

test('Grupo C obtem o modo de permissao do adapter da ferramenta resolvida', async () => {
  await cenarioFeliz();
  const adapter = fakeAdapter({ modoDePermissao: 'modoDoAdapter' });
  const ctx = contexto({ opcoes: { ...OPCOES_BASE, autoApprove: false } });

  const resultado = await servico(fakeRunner({ claude: '/c' }), adapter, fakeFileService()).run(ctx);

  assert.strictEqual(adapter.modoChamadas, 1);
  const item = resultado.itens.find((i) => i.item === 'permissao');
  assert.strictEqual(item?.severidade, 'OK');
  assert.strictEqual(item?.mensagem, 'modo de permissao efetivo: modoDoAdapter');
});

test('Grupo C marca ERRO quando o adapter devolve modo de permissao vazio', async () => {
  await cenarioFeliz();
  const adapter = fakeAdapter({ modoDePermissao: '' });
  const ctx = contexto({ opcoes: { ...OPCOES_BASE, autoApprove: true, permissionMode: 'acceptEdits' } });

  const resultado = await servico(fakeRunner({ claude: '/c' }), adapter, fakeFileService()).run(ctx);

  const erro = itemErro(resultado, (i) => i.item === 'permissao');
  assert.strictEqual(
    erro?.mensagem,
    'nenhuma permissao concedida - as tasks travariam nos prompts. Use --auto-approve'
  );
});

test('Grupo C marca ERRO para configuracao da ferramenta com JSON invalido, interpolando o caminho', async () => {
  await cenarioFeliz();
  const arquivo = path.join(projetoDir, '.mcp.json');
  await fs.writeFile(arquivo, '{ invalido');
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  const erro = itemErro(resultado, (i) => i.item === 'config:.mcp.json');
  assert.strictEqual(erro?.mensagem, `${arquivo} invalido - a ferramenta o ignora em silencio`);
});

test('Grupo C nao marca erro para arquivo de configuracao ausente', async () => {
  await cenarioFeliz();
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(!resultado.itens.some((i) => i.grupo === 'C' && i.item.startsWith('config:') && i.severidade === 'ERRO'));
});

test('Grupo D marca ERRO quando o diretorio de registros nao e gravavel', async () => {
  await cenarioFeliz();
  await fs.ensureDir(logsDir);
  await fs.chmod(logsDir, 0o500);
  try {
    const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());
    const erro = itemErro(resultado, (i) => i.grupo === 'D' && i.item === 'registros');
    assert.strictEqual(erro?.mensagem, 'sem permissao de escrita em ~/.specifica-br/logs/projeto-x/');
  } finally {
    await fs.chmod(logsDir, 0o700);
  }
});

test('Grupo D marca ERRO para task ilegivel e AVISO para legivel e nao gravavel', async () => {
  await cenarioFeliz();
  const ilegivel = path.join(featureDir, 'task-3.md');
  const soLeitura = path.join(featureDir, 'task-4.md');
  await fs.writeFile(ilegivel, '# x');
  await fs.writeFile(soLeitura, '# x');
  await fs.chmod(ilegivel, 0o000);
  await fs.chmod(soLeitura, 0o400);
  try {
    const ctx = contexto({ tasksSelecionadas: [ilegivel, soLeitura] });
    const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(ctx);
    assert.ok(itemErro(resultado, (i) => i.item === 'task:task-3.md'));
    assert.ok(resultado.itens.some((i) => i.item === 'task:task-4.md' && i.severidade === 'AVISO'));
  } finally {
    await fs.chmod(ilegivel, 0o600);
    await fs.chmod(soLeitura, 0o600);
  }
});

test('Grupo D marca AVISO, nao ERRO, quando tasks.md esta ausente', async () => {
  await cenarioFeliz();
  await fs.remove(path.join(featureDir, 'tasks.md'));
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  const item = resultado.itens.find((i) => i.item === 'tasks-md');
  assert.strictEqual(item?.severidade, 'AVISO');
  assert.strictEqual(item?.mensagem, 'tasks.md ausente - o comando manda atualiza-lo');
});

test('Grupo D nao le o conteudo de tasks.md', async () => {
  await cenarioFeliz();
  const alvo = path.join(featureDir, 'tasks.md');
  const conteudo = '# tasks\n- [ ] 1\n';
  await fs.writeFile(alvo, conteudo);
  const mtimeAntes = (await fs.stat(alvo)).mtimeMs;

  await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.strictEqual(await fs.readFile(alvo, 'utf-8'), conteudo);
  assert.strictEqual((await fs.stat(alvo)).mtimeMs, mtimeAntes);
});

test('Grupo D marca AVISO para artefato de contexto ausente, nunca ERRO', async () => {
  await cenarioFeliz();
  await fs.remove(path.join(featureDir, 'prd.md'));
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(resultado.itens.some((i) => i.item === 'contexto:prd.md' && i.severidade === 'AVISO'));
  assert.ok(!resultado.itens.some((i) => i.item === 'contexto:prd.md' && i.severidade === 'ERRO'));
});

test('Grupo E ignora item da secao 9 sem tipo reconhecivel', async () => {
  await cenarioFeliz();
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **sem-tipo**\n    - *Origem:* GLOBAL\n\n- [ ] **validate-tasks**\n    - *Tipo:* SKILL')
  );
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(!resultado.itens.some((i) => i.item.includes('sem-tipo')));
  assert.ok(resultado.itens.some((i) => i.item === 'skill:validate-tasks'));
});

test('Grupo E marca AVISO para skill declarada e nao encontrada', async () => {
  await cenarioFeliz();
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **fantasma**\n    - *Tipo:* SKILL')
  );
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  const item = resultado.itens.find((i) => i.item === 'skill:fantasma');
  assert.strictEqual(item?.severidade, 'AVISO');
  assert.strictEqual(
    item?.mensagem,
    'skill:fantasma declarada e nao encontrada - a task prosseguira sem ela'
  );
});

test('Grupo E marca todos os MCPs como AVISO quando listMcps devolve AVISO por timeout', async () => {
  await cenarioFeliz();
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **a**\n    - *Tipo:* MCP\n\n- [ ] **b**\n    - *Tipo:* MCP')
  );
  const adapter = fakeAdapter({ mcpStatus: { a: 'AVISO', b: 'AVISO' } });
  const resultado = await servico(fakeRunner({ claude: '/c' }), adapter, fakeFileService()).run(contexto());

  const mcps = resultado.itens.filter((i) => i.item.startsWith('mcp:'));
  assert.strictEqual(mcps.length, 2);
  assert.ok(mcps.every((i) => i.severidade === 'AVISO'));
});

test('Grupo E nunca produz item ERRO', async () => {
  await cenarioFeliz();
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **fantasma**\n    - *Tipo:* SKILL\n\n- [ ] **x**\n    - *Tipo:* MCP')
  );
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(!resultado.itens.some((i) => i.grupo === 'E' && i.severidade === 'ERRO'));
});

test('Grupo E nao registra credencial nem valor de variavel de ambiente', async () => {
  await cenarioFeliz();
  const segredo = 'sk-super-secreto-1234567890';
  await fs.writeFile(path.join(projetoDir, '.mcp.json'), JSON.stringify({ mcpServers: { x: { env: { TOKEN: segredo } } } }));
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **x**\n    - *Tipo:* MCP')
  );
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.ok(!resultado.itens.some((i) => i.mensagem.includes(segredo)));
});

test('Grupo F marca ERRO quando o caminho de logs nao e descendente do diretorio base', async () => {
  await cenarioFeliz();
  const ctx = contexto({ logsDir: path.join(raiz, 'fora', 'logs') });
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(ctx);

  assert.ok(itemErro(resultado, (i) => i.grupo === 'F' && i.item === 'logs-descendente'));
});

test('temErro e verdadeiro apenas quando ha ao menos um item ERRO', async () => {
  await cenarioFeliz();
  const semErro = await servico(fakeRunner({ claude: '/c' }), fakeAdapter({ mcpStatus: { context7: 'OK' } }), fakeFileService()).run(contexto());
  assert.strictEqual(semErro.temErro, false);

  const comErro = await servico(fakeRunner({}), fakeAdapter({ versao: '' }), fakeFileService()).run(contexto());
  assert.strictEqual(comErro.temErro, true);
});

test('erros e avisos sao contados corretamente', async () => {
  await cenarioFeliz();
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(contexto());

  assert.strictEqual(
    resultado.erros,
    resultado.itens.filter((i) => i.severidade === 'ERRO').length
  );
  assert.strictEqual(
    resultado.avisos,
    resultado.itens.filter((i) => i.severidade === 'AVISO').length
  );
});

test('uma verificacao que lanca excecao vira item AVISO, e run nao propaga', async () => {
  await cenarioFeliz();
  const fileServiceQueLanca = {
    loadToolsMapping: async () => {
      throw new Error('falha simulada');
    },
  };
  const adapterQueLanca = {
    getVersion: async () => {
      throw new Error('boom');
    },
    listMcps: async () => {
      throw new Error('boom');
    },
    runTask: async () => {
      throw new Error('nao');
    },
  };

  const resultado = await servico(fakeRunner({ claude: '/c' }), adapterQueLanca, fileServiceQueLanca).run(contexto());

  assert.ok(Array.isArray(resultado.itens));
  assert.ok(resultado.itens.some((i) => i.severidade === 'AVISO'));
});

test('run nao invoca a execucao de task em nenhum cenario de erro', async () => {
  await cenarioFeliz();
  const adapter = fakeAdapter({ versao: '' });
  const resultado = await servico(fakeRunner({}), adapter, fakeFileService()).run(contexto());

  assert.strictEqual(resultado.temErro, true);
  assert.strictEqual(adapter.runTaskChamadas, 0);
});

// --- Congelamento de contrato (RNF-001, task-1 de executar-tasks-opencode) ---
// A lista abaixo e a EFETIVAMENTE produzida hoje para o ClaudeCode no cenario feliz.
// Acrescentar, remover, renomear ou reclassificar um item quebra este teste de
// proposito: a introducao de novas ferramentas nao pode alterar o preflight atual.

/** Substitui a raiz temporaria pelos marcadores, para que o literal esperado seja estavel. */
function normalizarMensagem(mensagem: string): string {
  return mensagem.split(raiz).join('<RAIZ>');
}

test('preflight do claudecode congela identificadores, severidades e mensagens', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const adapter = fakeAdapter({ mcpStatus: { context7: 'OK' } });
  const resultado = await servico(runner, adapter, fakeFileService()).run(contexto());

  const congelado = resultado.itens.map((item) => ({
    grupo: item.grupo,
    item: item.item,
    severidade: item.severidade,
    mensagem: normalizarMensagem(item.mensagem),
  }));

  assert.deepStrictEqual(congelado, [
    { grupo: 'A', item: 'cli-claude', severidade: 'OK', mensagem: 'claude encontrado em /usr/bin/claude' },
    { grupo: 'A', item: 'cli-versao', severidade: 'OK', mensagem: 'claude 2.1.0 (Claude Code) em /usr/bin/claude' },
    {
      grupo: 'B',
      item: 'comando-executar-task',
      severidade: 'OK',
      mensagem: 'comando executar-task instalado: <RAIZ>/projeto/.claude/commands/executar-task.md',
    },
    { grupo: 'C', item: 'permissao', severidade: 'OK', mensagem: 'modo de permissao efetivo: bypassPermissions' },
    {
      grupo: 'D',
      item: 'registros',
      severidade: 'OK',
      mensagem: 'diretorio de registros gravavel: <RAIZ>/home/.specifica-br/logs/projeto-x',
    },
    { grupo: 'D', item: 'task:task-1.md', severidade: 'OK', mensagem: 'task legivel e gravavel: task-1.md' },
    { grupo: 'D', item: 'tasks-md', severidade: 'OK', mensagem: 'tasks.md presente e gravavel' },
    { grupo: 'D', item: 'contexto:prd.md', severidade: 'OK', mensagem: 'artefato de contexto legivel: prd.md' },
    { grupo: 'D', item: 'contexto:techspec.md', severidade: 'OK', mensagem: 'artefato de contexto legivel: techspec.md' },
    { grupo: 'D', item: 'contexto:architecture.md', severidade: 'OK', mensagem: 'artefato de contexto legivel: architecture.md' },
    {
      grupo: 'E',
      item: 'skill:validate-tasks',
      severidade: 'OK',
      mensagem: 'skill:validate-tasks encontrada em <RAIZ>/projeto/.claude/skills/validate-tasks',
    },
    { grupo: 'E', item: 'mcp:context7', severidade: 'OK', mensagem: 'mcp:context7 conectado' },
    {
      grupo: 'F',
      item: 'logs-descendente',
      severidade: 'OK',
      mensagem: 'diretorio de registros dentro de ~/.specifica-br/logs/',
    },
    { grupo: 'F', item: 'base-gravavel', severidade: 'OK', mensagem: '~/.specifica-br/ gravavel' },
  ]);
  assert.deepStrictEqual([resultado.erros, resultado.avisos, resultado.temErro], [0, 0, false]);
});

// --- Preflight do OpenCode (task-5): grupos A, B e C ---

const MAPPING_OPENCODE = [
  {
    name: 'OpenCode',
    commands: '.opencode/command/',
    legacyCommands: '.opencode/commands/',
    skills: '.agents/skills/',
    templates: 'specs/templates/',
    global: {
      commands: { base: 'config', path: 'opencode/command/' },
      skills: { base: 'home', path: '.agents/skills/' },
    },
  },
];

/** Cria o arquivo de apoio de execucao de CT-035 para este processo. */
async function criarArquivoDeApoio(): Promise<string> {
  const dir = path.join(homeDir, '.specifica-br', 'opencode');
  await fs.ensureDir(dir);
  const arquivo = path.join(dir, `executor-20260901-${process.pid}.json`);
  await fs.writeFile(arquivo, '{"$schema":"https://opencode.ai/config.json"}');
  return arquivo;
}

async function cenarioFelizOpenCode(): Promise<void> {
  await fs.ensureDir(path.join(projetoDir, '.opencode', 'command'));
  await fs.writeFile(path.join(projetoDir, '.opencode', 'command', 'executar-task.md'), '# comando');
  await fs.ensureDir(path.join(projetoDir, '.agents', 'skills', 'validate-tasks'));
  await fs.writeFile(path.join(projetoDir, '.agents', 'skills', 'validate-tasks', 'SKILL.md'), '# skill');
  await fs.writeFile(
    path.join(featureDir, 'task-1.md'),
    TASK_SECAO_9('- [ ] **validate-tasks**\n    - *Tipo:* SKILL\n\n- [ ] **context7**\n    - *Tipo:* MCP')
  );
  await fs.writeFile(path.join(featureDir, 'tasks.md'), '# tasks');
  await fs.writeFile(path.join(featureDir, 'prd.md'), '# prd');
  await fs.writeFile(path.join(featureDir, 'techspec.md'), '# techspec');
  await fs.ensureDir(path.join(projetoDir, 'specs', 'core'));
  await fs.writeFile(path.join(projetoDir, 'specs', 'core', 'architecture.md'), '# arch');
  await fs.ensureDir(logsDir);
  await criarArquivoDeApoio();
}

function contextoOpenCode(over: Partial<PreflightContexto> = {}): PreflightContexto {
  return contexto({ ferramenta: 'opencode', opcoes: { ...OPCOES_BASE }, ...over });
}

function servicoOpenCode(
  versao = '1.18.25',
  which: WhichMap = { opencode: '/usr/bin/opencode' }
): PreflightService {
  return servico(fakeRunner(which), fakeAdapter({ versao, mcpStatus: { context7: 'OK' } }), fakeFileService(MAPPING_OPENCODE));
}

function item(resultado: { itens: Array<{ item: string; severidade: string; mensagem: string }> }, id: string) {
  return resultado.itens.find((i) => i.item === id);
}

test('OpenCode: caminho feliz nao produz ERRO e traz os itens novos', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode().run(contextoOpenCode());

  assert.strictEqual(resultado.temErro, false);
  assert.strictEqual(item(resultado, 'cli-opencode')?.severidade, 'OK');
  assert.strictEqual(item(resultado, 'cli-versao')?.severidade, 'OK');
  assert.strictEqual(item(resultado, 'comando-executar-task')?.severidade, 'OK');
  assert.strictEqual(item(resultado, 'arquivo-apoio')?.severidade, 'OK');
});

test('OpenCode: permissao-sobreposta e sempre INFO, com a mensagem de RF-007', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode().run(contextoOpenCode());
  const sobreposta = item(resultado, 'permissao-sobreposta');

  assert.strictEqual(sobreposta?.severidade, 'INFO');
  assert.strictEqual(
    sobreposta?.mensagem,
    'as regras de permissao do seu projeto serao sobrepostas durante o lote'
  );
  assert.ok(!resultado.itens.some((i) => i.item.startsWith('deny')));
});

test('OpenCode: opencode.json e opencode.jsonc com comentario e virgula final sao validos', async () => {
  await cenarioFelizOpenCode();
  await fs.writeFile(
    path.join(projetoDir, 'opencode.json'),
    '{\n  // servidor local\n  "server": { "port": 4096, },\n}'
  );
  await fs.writeFile(
    path.join(projetoDir, 'opencode.jsonc'),
    '{\n  "mcp": { "c7": { "url": "https://mcp.context7.com/mcp" } },\n}'
  );

  const resultado = await servicoOpenCode().run(contextoOpenCode());

  assert.strictEqual(item(resultado, 'config:opencode.json')?.severidade, 'OK');
  assert.strictEqual(item(resultado, 'config:opencode.jsonc')?.severidade, 'OK');
  assert.strictEqual(resultado.temErro, false);
});

test('OpenCode: CLI ausente do PATH e ERRO com a mensagem nominal', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode('1.18.25', {}).run(contextoOpenCode());
  const erro = item(resultado, 'cli-opencode');

  assert.strictEqual(erro?.severidade, 'ERRO');
  assert.strictEqual(
    erro?.mensagem,
    'CLI de OpenCode nao encontrada no PATH. Abortado antes de gastar tokens.'
  );
  assert.strictEqual(resultado.temErro, true);
});

test('OpenCode: versao abaixo do piso 1.18.0 e AVISO, e o lote prossegue', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode('1.17.9').run(contextoOpenCode());
  const versao = item(resultado, 'cli-versao');

  assert.strictEqual(versao?.severidade, 'AVISO');
  assert.strictEqual(
    versao?.mensagem,
    'OpenCode 1.17.9 abaixo da versao minima suportada 1.18.0 - o lote pode falhar'
  );
  assert.strictEqual(resultado.temErro, false);
});

test('OpenCode: versao exatamente no piso nao gera aviso', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode('1.18.0').run(contextoOpenCode());

  assert.strictEqual(item(resultado, 'cli-versao')?.severidade, 'OK');
});

test('OpenCode: versao irreconhecivel por semver nao gera aviso algum', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode('dev-build-xyz').run(contextoOpenCode());

  assert.strictEqual(item(resultado, 'cli-versao')?.severidade, 'OK');
  assert.strictEqual(resultado.avisos, 0);
});

test('abaixoDoPiso: abaixo do piso, no piso, sem piso e versao irreconhecivel', () => {
  assert.strictEqual(abaixoDoPiso('opencode', '1.17.9'), true);
  assert.strictEqual(abaixoDoPiso('opencode', ' 1.17.9 '), true);
  assert.strictEqual(abaixoDoPiso('opencode', '1.18.0'), false);
  assert.strictEqual(abaixoDoPiso('opencode', '1.18.27'), false);
  assert.strictEqual(abaixoDoPiso('claudecode', '0.1.0'), false);
  assert.strictEqual(abaixoDoPiso('opencode', 'dev-build-xyz'), false);
  assert.strictEqual(abaixoDoPiso('opencode', ''), false);
});

test('OpenCode: versao vazia e ERRO', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode('').run(contextoOpenCode());

  assert.strictEqual(item(resultado, 'cli-versao')?.severidade, 'ERRO');
});

test('OpenCode: comando ausente em todos os candidatos e ERRO nominal', async () => {
  await cenarioFelizOpenCode();
  await fs.remove(path.join(projetoDir, '.opencode', 'command', 'executar-task.md'));

  const resultado = await servicoOpenCode().run(contextoOpenCode());
  const erro = item(resultado, 'comando-executar-task');

  assert.strictEqual(erro?.severidade, 'ERRO');
  assert.strictEqual(
    erro?.mensagem,
    'comando executar-task nao instalado para OpenCode. Rode: specifica-br init'
  );
});

test('OpenCode: opencode.json que nem o JSONC salva e ERRO nominal', async () => {
  await cenarioFelizOpenCode();
  const arquivo = path.join(projetoDir, 'opencode.json');
  await fs.writeFile(arquivo, '{ "server": }');

  const resultado = await servicoOpenCode().run(contextoOpenCode());
  const erro = item(resultado, 'config:opencode.json');

  assert.strictEqual(erro?.severidade, 'ERRO');
  assert.strictEqual(erro?.mensagem, `${arquivo} invalido - a ferramenta o ignora em silencio`);
  assert.strictEqual(resultado.temErro, true);
});

test('OpenCode: arquivo de configuracao ausente nao gera item algum', async () => {
  await cenarioFelizOpenCode();

  const resultado = await servicoOpenCode().run(contextoOpenCode());

  assert.ok(!resultado.itens.some((i) => i.item.startsWith('config:opencode')));
});

test('OpenCode: arquivo de apoio ausente e ERRO bloqueante', async () => {
  await cenarioFelizOpenCode();
  await fs.remove(path.join(homeDir, '.specifica-br', 'opencode'));

  const resultado = await servicoOpenCode().run(contextoOpenCode());
  const erro = item(resultado, 'arquivo-apoio');

  assert.strictEqual(erro?.severidade, 'ERRO');
  assert.strictEqual(erro?.mensagem, 'arquivo de apoio de execucao do specifica-br ausente ou ilegivel');
  assert.strictEqual(resultado.temErro, true);
});

test('OpenCode: arquivo de apoio de outro processo nao conta como o desta execucao', async () => {
  await cenarioFelizOpenCode();
  const dir = path.join(homeDir, '.specifica-br', 'opencode');
  await fs.remove(dir);
  await fs.ensureDir(dir);
  await fs.writeFile(path.join(dir, `executor-20260901-${process.pid + 1}.json`), '{}');

  const resultado = await servicoOpenCode().run(contextoOpenCode());

  assert.strictEqual(item(resultado, 'arquivo-apoio')?.severidade, 'ERRO');
});

test('OpenCode: OPENCODE_CONFIG preexistente e AVISO e nunca transcreve o valor', async () => {
  await cenarioFelizOpenCode();
  const anterior = process.env.OPENCODE_CONFIG;
  process.env.OPENCODE_CONFIG = '/caminho/secreto/do/usuario.json';

  try {
    const resultado = await servicoOpenCode().run(contextoOpenCode());
    const aviso = item(resultado, 'opencode-config-preexistente');

    assert.strictEqual(aviso?.severidade, 'AVISO');
    assert.strictEqual(
      aviso?.mensagem,
      'configuracao de ambiente do OpenCode definida pelo usuario sera sobrescrita durante o lote'
    );
    assert.ok(!resultado.itens.some((i) => i.mensagem.includes('/caminho/secreto/do/usuario.json')));
    assert.strictEqual(resultado.temErro, false);
  } finally {
    if (anterior === undefined) {
      delete process.env.OPENCODE_CONFIG;
    } else {
      process.env.OPENCODE_CONFIG = anterior;
    }
  }
});

test('OpenCode: sem OPENCODE_CONFIG no ambiente o item nao e criado', async () => {
  await cenarioFelizOpenCode();
  const anterior = process.env.OPENCODE_CONFIG;
  delete process.env.OPENCODE_CONFIG;

  try {
    const resultado = await servicoOpenCode().run(contextoOpenCode());

    assert.strictEqual(item(resultado, 'opencode-config-preexistente'), undefined);
  } finally {
    if (anterior !== undefined) {
      process.env.OPENCODE_CONFIG = anterior;
    }
  }
});

test('itens exclusivos do OpenCode nao aparecem para o ClaudeCode', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const adapter = fakeAdapter({ mcpStatus: { context7: 'OK' } });

  const resultado = await servico(runner, adapter, fakeFileService()).run(contexto());

  for (const id of ['arquivo-apoio', 'opencode-config-preexistente', 'permissao-sobreposta']) {
    assert.strictEqual(item(resultado, id), undefined);
  }
  assert.ok(!resultado.itens.some((i) => i.severidade === 'INFO'));
});

test('ClaudeCode nao ganha piso de versao: uma versao baixa continua OK', async () => {
  await cenarioFeliz();
  const runner = fakeRunner({ claude: '/usr/bin/claude' });
  const adapter = fakeAdapter({ versao: '0.0.1', mcpStatus: { context7: 'OK' } });

  const resultado = await servico(runner, adapter, fakeFileService()).run(contexto());

  assert.strictEqual(item(resultado, 'cli-versao')?.severidade, 'OK');
});

test('OpenCode: o comando global e procurado na base config, e nao no home', async () => {
  await cenarioFelizOpenCode();
  await fs.remove(path.join(projetoDir, '.opencode', 'command', 'executar-task.md'));
  const configDir = path.join(raiz, 'xdg-config');
  await fs.ensureDir(path.join(configDir, 'opencode', 'command'));
  await fs.writeFile(path.join(configDir, 'opencode', 'command', 'executar-task.md'), '# comando');

  const anterior = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = configDir;
  try {
    const resultado = await servicoOpenCode().run(contextoOpenCode());

    assert.strictEqual(item(resultado, 'comando-executar-task')?.severidade, 'OK');
  } finally {
    if (anterior === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = anterior;
    }
  }
});

test('OpenCode: o comando no home nao satisfaz a base config do mapeamento', async () => {
  await cenarioFelizOpenCode();
  await fs.remove(path.join(projetoDir, '.opencode', 'command', 'executar-task.md'));
  await fs.ensureDir(path.join(homeDir, 'opencode', 'command'));
  await fs.writeFile(path.join(homeDir, 'opencode', 'command', 'executar-task.md'), '# comando');

  const anterior = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = path.join(raiz, 'xdg-vazio');
  try {
    const resultado = await servicoOpenCode().run(contextoOpenCode());

    assert.strictEqual(item(resultado, 'comando-executar-task')?.severidade, 'ERRO');
  } finally {
    if (anterior === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = anterior;
    }
  }
});
