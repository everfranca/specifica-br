import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  OpenCodeExecutorConfigService,
  montarExecutorConfig,
  traduzirAllow,
} from '../dist/utils/opencode-executor-config.js';

let contador = 0;

async function homeTemporario(): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `opencode-executor-test-${process.pid}-${contador++}`
  );
  await fs.ensureDir(dir);
  return dir;
}

function entrada(over: Record<string, unknown> = {}) {
  return {
    runId: '20260901_120000',
    pid: 12345,
    formaDeInjecao: 'prompt' as const,
    destiladoPath: null,
    allow: [] as string[],
    ...over,
  };
}

async function lerConfig(caminho: string): Promise<Record<string, unknown>> {
  const bruto = await fs.readFile(caminho, 'utf-8');
  return JSON.parse(bruto) as Record<string, unknown>;
}

test('grava o arquivo em ~/.specifica-br/opencode com o RUN_ID e o PID no nome', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  const gravado = await servico.ensure(entrada());

  assert.equal(
    gravado.caminho,
    path.join(home, '.specifica-br', 'opencode', 'executor-20260901_120000-12345.json')
  );
  assert.equal(await fs.pathExists(gravado.caminho), true);
  assert.deepEqual(gravado.avisos, []);
});

test('forma instructions com destilado declara um unico caminho absoluto', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  const destilado = path.join(home, 'specs', 'features', 'exemplo', 'contexto-execucao.md');

  const gravado = await servico.ensure(
    entrada({ formaDeInjecao: 'instructions', destiladoPath: destilado })
  );
  const config = await lerConfig(gravado.caminho);

  assert.deepEqual(config.instructions, [destilado]);
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
});

test('forma prompt omite a chave instructions, nunca a escreve como lista vazia', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  const destilado = path.join(home, 'contexto-execucao.md');

  const gravado = await servico.ensure(
    entrada({ formaDeInjecao: 'prompt', destiladoPath: destilado })
  );
  const config = await lerConfig(gravado.caminho);

  assert.equal('instructions' in config, false);
});

test('o agente se chama specifica-executor, e primary e comeca por curinga allow', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  const gravado = await servico.ensure(entrada({ allow: ['Read'] }));
  const config = await lerConfig(gravado.caminho);
  const agentes = config.agent as Record<string, Record<string, unknown>>;
  const executor = agentes['specifica-executor'];

  assert.equal(executor.description, 'Executor de tasks do specifica-br (uso nao-interativo)');
  assert.equal(executor.mode, 'primary');
  assert.equal(Object.keys(executor.permission as object)[0], '*');
  assert.equal((executor.permission as Record<string, unknown>)['*'], 'allow');
});

test('traduz Ferramenta e Ferramenta(padrao) em regras allow com o nome em minusculas', () => {
  const { regras, avisos } = traduzirAllow(['Read', 'Bash(git commit:*)']);

  assert.deepEqual(regras, {
    read: { '*': 'allow' },
    bash: { 'git commit:*': 'allow' },
  });
  assert.deepEqual(avisos, []);
});

test('as regras traduzidas entram depois do curinga, na ordem informada', () => {
  const { config } = montarExecutorConfig(
    entrada({ allow: ['Read', 'Bash(git commit:*)'] })
  );
  const permission = config.agent['specifica-executor'].permission;

  assert.deepEqual(Object.keys(permission), ['*', 'read', 'bash']);
});

test('remove o arquivo deste lote no encerramento', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  const gravado = await servico.ensure(entrada());

  await servico.remover();

  assert.equal(await fs.pathExists(gravado.caminho), false);
});

test('dois RUN_ID distintos produzem arquivos distintos, sem sobrescrita', async () => {
  const home = await homeTemporario();
  const primeiro = new OpenCodeExecutorConfigService(home);
  const segundo = new OpenCodeExecutorConfigService(home);

  const a = await primeiro.ensure(entrada({ runId: '20260901_120000', pid: 111 }));
  const b = await segundo.ensure(entrada({ runId: '20260901_130000', pid: 222 }));

  assert.notEqual(a.caminho, b.caminho);
  assert.equal(await fs.pathExists(a.caminho), true);
  assert.equal(await fs.pathExists(b.caminho), true);
});

test('forma nao reconhecivel de --allow e descartada com aviso nominal, uma por regra', () => {
  const { regras, avisos } = traduzirAllow([
    'mcp__servidor__ferramenta',
    'Read',
    '???',
  ]);

  assert.deepEqual(regras, { read: { '*': 'allow' } });
  assert.deepEqual(avisos, [
    '--allow mcp__servidor__ferramenta nao tem equivalente no OpenCode - ignorada',
    '--allow ??? nao tem equivalente no OpenCode - ignorada',
  ]);
});

test('padroes distintos da mesma ferramenta se acumulam sob a mesma chave', () => {
  const { regras } = traduzirAllow(['Bash(git commit:*)', 'Bash(npm test:*)']);

  assert.deepEqual(regras, {
    bash: { 'git commit:*': 'allow', 'npm test:*': 'allow' },
  });
});

function vereditos(valor: unknown): string[] {
  if (typeof valor === 'string') {
    return [valor];
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.values(valor as Record<string, unknown>).flatMap(vereditos);
  }
  return [];
}

test('nenhum veredito deny e produzido, qualquer que seja o --allow', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  const gravado = await servico.ensure(
    entrada({ allow: ['Read', 'Bash(rm -rf *)', 'deny', 'Write(deny)'] })
  );
  const config = await lerConfig(gravado.caminho);
  const agentes = config.agent as Record<string, Record<string, unknown>>;
  const todos = vereditos(agentes['specifica-executor'].permission);

  assert.equal(todos.length > 0, true);
  assert.deepEqual([...new Set(todos)], ['allow']);
});

test('a escrita e atomica: nenhum .tmp sobrevive ao final', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  await servico.ensure(entrada());

  const entradas = await fs.readdir(path.join(home, '.specifica-br', 'opencode'));

  assert.deepEqual(entradas.filter((e) => e.endsWith('.tmp')), []);
});

test('rechamar ensure reescreve o mesmo caminho, sem deixar temporario', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  const destilado = path.join(home, 'contexto-execucao.md');

  const primeiro = await servico.ensure(entrada());
  const segundo = await servico.ensure(
    entrada({ formaDeInjecao: 'instructions', destiladoPath: destilado })
  );

  assert.equal(primeiro.caminho, segundo.caminho);
  const config = await lerConfig(segundo.caminho);
  assert.deepEqual(config.instructions, [destilado]);
  const entradas = await fs.readdir(path.join(home, '.specifica-br', 'opencode'));
  assert.equal(entradas.length, 1);
});

test('forma instructions sem destilado tambem omite a chave', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  const gravado = await servico.ensure(
    entrada({ formaDeInjecao: 'instructions', destiladoPath: null })
  );
  const config = await lerConfig(gravado.caminho);

  assert.equal('instructions' in config, false);
});

test('limparRestos remove executor-*.json antigo e preserva o recente', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  const dir = path.join(home, '.specifica-br', 'opencode');
  await fs.ensureDir(dir);

  const antigo = path.join(dir, 'executor-antigo-1.json');
  const recente = path.join(dir, 'executor-recente-2.json');
  const alheio = path.join(dir, 'outro-arquivo.json');
  await fs.writeFile(antigo, '{}');
  await fs.writeFile(recente, '{}');
  await fs.writeFile(alheio, '{}');

  const agora = Date.now();
  const vinteECincoHoras = agora - 25 * 60 * 60 * 1000;
  await fs.utimes(antigo, vinteECincoHoras / 1000, vinteECincoHoras / 1000);

  await servico.limparRestos(agora);

  assert.equal(await fs.pathExists(antigo), false);
  assert.equal(await fs.pathExists(recente), true);
  assert.equal(await fs.pathExists(alheio), true);
});

test('limparRestos com o diretorio inexistente nao lanca', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  await servico.limparRestos();

  assert.equal(await fs.pathExists(path.join(home, '.specifica-br', 'opencode')), false);
});

test('remover antes de ensure e silencioso, e remover duas vezes tambem', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);

  await servico.remover();
  const gravado = await servico.ensure(entrada());
  await servico.remover();
  await servico.remover();

  assert.equal(await fs.pathExists(gravado.caminho), false);
});

test('falha de escrita produz a mensagem unica de arquivo de apoio', async () => {
  const home = await homeTemporario();
  const servico = new OpenCodeExecutorConfigService(home);
  await fs.writeFile(path.join(home, '.specifica-br'), 'nao sou um diretorio');

  await assert.rejects(
    () => servico.ensure(entrada()),
    /^Error: arquivo de apoio de execucao do specifica-br ausente ou ilegivel$/
  );
});

test('a remocao no encerramento do runner nao apaga o arquivo de outro lote', async () => {
  const home = await homeTemporario();
  const meu = new OpenCodeExecutorConfigService(home);
  const alheio = new OpenCodeExecutorConfigService(home);

  const meuArquivo = await meu.ensure(entrada({ runId: 'a', pid: 1 }));
  const alheioArquivo = await alheio.ensure(entrada({ runId: 'b', pid: 2 }));

  await meu.remover();

  assert.equal(await fs.pathExists(meuArquivo.caminho), false);
  assert.equal(await fs.pathExists(alheioArquivo.caminho), true);
});
