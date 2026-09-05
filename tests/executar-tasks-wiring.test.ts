import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  montarAdapter,
  prepararArquivoDeApoio,
} from '../dist/utils/executar-tasks-wiring.js';
import { OpenCodeExecutorConfigService } from '../dist/utils/opencode-executor-config.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function homeTemporario(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'specifica-wiring-'));
}

/**
 * O teste que faltava: afirma o ambiente montado pela **producao**, e nao por
 * construcao manual do adapter. E ele que pega a divergencia de instancia que
 * fazia `OPENCODE_CONFIG` nunca ser exportada (ENV-002).
 */
test('o adapter montado pelo comando exporta OPENCODE_CONFIG do arquivo que o proprio comando gravou', async () => {
  const home = await homeTemporario();

  const { adapter, servico } = montarAdapter({
    ferramenta: 'opencode',
    home,
    onAviso: () => undefined,
  });
  const { executorConfig, avisosDoAllow } = await prepararArquivoDeApoio(servico, {
    runId: 'RUN',
    pid: 4242,
    opcoes: { contextInjection: 'prompt', allow: [] },
  });

  assert.notEqual(servico, null);
  assert.notEqual(executorConfig, null);
  assert.deepEqual(avisosDoAllow, []);

  const caminho = servico!.caminho;
  assert.equal(typeof caminho, 'string');
  assert.equal(adapter.buildEnv(false, { PATH: '/usr/bin' }).OPENCODE_CONFIG, caminho);
  assert.equal(await fs.pathExists(caminho as string), true);

  await fs.remove(home);
});

test('o arquivo gravado traz o agente allow-all de RF-007 e a forma de injecao', async () => {
  const home = await homeTemporario();
  const { servico } = montarAdapter({
    ferramenta: 'opencode',
    home,
    onAviso: () => undefined,
  });
  await prepararArquivoDeApoio(servico, {
    runId: 'RUN',
    pid: 1,
    opcoes: { contextInjection: 'prompt', allow: ['Bash(git status)'] },
  });

  const conteudo = await fs.readJson(servico!.caminho as string);
  const agente = conteudo.agent['specifica-executor'];

  assert.equal(agente.permission['*'], 'allow');
  assert.deepEqual(agente.permission.bash, { 'git status': 'allow' });
  assert.equal('instructions' in conteudo, false);

  await fs.remove(home);
});

test('aplicarDestilado regrava a chave instructions no MESMO arquivo lido pelo adapter', async () => {
  const home = await homeTemporario();
  const destilado = path.join(home, 'destilado.md');
  await fs.writeFile(destilado, '# contexto');

  const { adapter, servico } = montarAdapter({
    ferramenta: 'opencode',
    home,
    onAviso: () => undefined,
  });
  const { executorConfig } = await prepararArquivoDeApoio(servico, {
    runId: 'RUN',
    pid: 7,
    opcoes: { contextInjection: 'instructions', allow: [] },
  });

  await executorConfig!.aplicarDestilado(destilado);

  const caminho = adapter.buildEnv(false, {}).OPENCODE_CONFIG as string;
  const conteudo = await fs.readJson(caminho);
  assert.deepEqual(conteudo.instructions, [destilado]);

  await executorConfig!.remover();
  assert.equal(await fs.pathExists(caminho), false);

  await fs.remove(home);
});

test('regra de --allow nao traduzivel volta como aviso para o cabecalho', async () => {
  const home = await homeTemporario();
  const { servico } = montarAdapter({
    ferramenta: 'opencode',
    home,
    onAviso: () => undefined,
  });

  const { avisosDoAllow } = await prepararArquivoDeApoio(servico, {
    runId: 'RUN',
    pid: 2,
    opcoes: { contextInjection: 'prompt', allow: ['Bash(git status)', 'nao/traduzivel!'] },
  });

  assert.deepEqual(avisosDoAllow, [
    '--allow nao/traduzivel! nao tem equivalente no OpenCode - ignorada',
  ]);

  await fs.remove(home);
});

test('o canal de avisos montado pelo comando chega ao adapter', () => {
  const avisos: string[] = [];
  const { adapter } = montarAdapter({
    ferramenta: 'opencode',
    home: os.tmpdir(),
    onAviso: (mensagem) => avisos.push(mensagem),
  });

  adapter.modoDePermissaoEfetivo({ permissionMode: 'dontAsk' } as never);

  assert.deepEqual(avisos, [
    '--permission-mode dontAsk nao tem equivalente no OpenCode - ignorado',
  ]);
});

test('em ClaudeCode nao ha servico nem executorConfig, e nenhum OPENCODE_CONFIG e exportado', async () => {
  const { adapter, servico } = montarAdapter({
    ferramenta: 'claudecode',
    home: os.tmpdir(),
    onAviso: () => undefined,
  });
  const { executorConfig, avisosDoAllow } = await prepararArquivoDeApoio(servico, {
    runId: 'RUN',
    pid: 3,
    opcoes: { contextInjection: 'prompt', allow: [] },
  });

  assert.equal(servico, null);
  assert.equal(executorConfig, null);
  assert.deepEqual(avisosDoAllow, []);
  assert.equal(adapter.buildEnv(false, { PATH: '/usr/bin' }).OPENCODE_CONFIG, undefined);
});

test('ferramenta sem contrato validado e recusada na montagem, antes de qualquer I/O', () => {
  assert.throws(
    () =>
      montarAdapter({
        ferramenta: 'kiro',
        home: os.tmpdir(),
        onAviso: () => undefined,
      }),
    /contrato de execucao de Kiro ainda nao validado/
  );
});

test('a instancia usada e a informada pelo seam, nunca uma criada por dentro', async () => {
  const home = await homeTemporario();
  const informada = new OpenCodeExecutorConfigService(home);

  const { servico } = montarAdapter({
    ferramenta: 'opencode',
    home: '/caminho/ignorado',
    onAviso: () => undefined,
    criarConfigService: () => informada,
  });

  assert.equal(servico, informada);

  await fs.remove(home);
});

const CAMPOS_DE_DADOS_DE_ABERTURA = [
  'feature',
  'tasksSelecionadas',
  'tasksTotal',
  'criterioDeSelecao',
  'ferramenta',
  'executavel',
  'versao',
  'model',
  'effort',
  'fallbackModel',
  'permissoes',
  'contextoLigado',
  'contextoSimulado',
  'contextoTeto',
  'contextoInjecao',
  'cacheTuning',
  'dirsExtras',
  'tetoCustoPorTask',
  'tetoJanela',
  'tetoEspera',
  'registroPath',
];

test('o comando monta DadosDeAbertura com todos os campos da secao 3.1 (CT-046, RF-005)', () => {
  const fonte = readFileSync(
    path.join(raiz, 'src', 'commands', 'executar-tasks.ts'),
    'utf-8'
  );

  const abertura = fonte.indexOf('layout.header({');
  assert.notEqual(abertura, -1, 'o comando deveria chamar layout.header com dados');
  const trecho = fonte.slice(abertura, fonte.indexOf('});', abertura));

  for (const campo of CAMPOS_DE_DADOS_DE_ABERTURA) {
    const preenchido = trecho.includes(`${campo}:`) || trecho.includes(`${campo},`);
    assert.ok(preenchido, `DadosDeAbertura deveria preencher ${campo}`);
  }
});

test('nenhuma string de cabecalho e montada dentro do comando (RF-005)', () => {
  const fonte = readFileSync(
    path.join(raiz, 'src', 'commands', 'executar-tasks.ts'),
    'utf-8'
  );

  assert.ok(
    !fonte.includes("from '../utils/cabecalho"),
    'o comando nao deveria importar a familia do cabecalho'
  );
  assert.ok(!fonte.includes('renderCabecalho'), 'renderCabecalho nao pertence ao comando');

  const caracteresDeMoldura = ['═', '─', '│', '┌', '┐', '└', '┘', '├', '┤', '╭', '╮', '╯', '╰'];
  for (const caractere of caracteresDeMoldura) {
    assert.ok(
      !fonte.includes(caractere),
      `o comando nao deveria conter o caractere de moldura ${caractere}`
    );
  }
});
