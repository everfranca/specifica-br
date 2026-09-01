import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { PreflightService } from '../dist/utils/preflight-service.js';
import { TaskDiscoveryService } from '../dist/utils/task-discovery.js';
import type { PreflightContexto } from '../dist/types/executar-tasks.js';

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
} = {}): {
  getVersion: () => Promise<string>;
  listMcps: (nomes: string[], t: number) => Promise<Array<{ nome: string; severidade: 'OK' | 'AVISO'; linha: null }>>;
  runTask: () => Promise<never>;
  mcpChamadas: number;
  runTaskChamadas: number;
} {
  const estado = { mcpChamadas: 0, runTaskChamadas: 0 };
  return {
    get mcpChamadas() {
      return estado.mcpChamadas;
    },
    get runTaskChamadas() {
      return estado.runTaskChamadas;
    },
    getVersion: async () => over.versao ?? '2.1.0 (Claude Code)',
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
    opcoes: {
      autoApprove: true,
      permissionMode: '',
      requireCmd: [],
      mcpCheck: true,
      mcpTimeout: 15,
    },
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
    opcoes: { autoApprove: true, permissionMode: '', requireCmd: [], mcpCheck: false, mcpTimeout: 15 },
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
    opcoes: { autoApprove: true, permissionMode: '', requireCmd: ['git', 'inexistente'], mcpCheck: true, mcpTimeout: 15 },
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
    opcoes: { autoApprove: false, permissionMode: '', requireCmd: [], mcpCheck: true, mcpTimeout: 15 },
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
    opcoes: { autoApprove: false, permissionMode: 'acceptEdits', requireCmd: [], mcpCheck: true, mcpTimeout: 15 },
  });
  const resultado = await servico(fakeRunner({ claude: '/c' }), fakeAdapter(), fakeFileService()).run(ctxExplicito);

  assert.ok(resultado.itens.some((i) => i.item === 'permissao' && i.severidade === 'OK'));
  assert.ok(!itemErro(resultado, (i) => i.item === 'permissao'));
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
