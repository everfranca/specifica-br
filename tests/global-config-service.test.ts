import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';

import { GlobalConfigService } from '../dist/utils/global-config-service.js';

const INVALID_CONFIG_MESSAGE = '~/.specifica-br/config.json invalido. Corrija ou remova o arquivo.';

let homeOriginal: string | undefined;
let tmpHome: string;

beforeEach(async () => {
  homeOriginal = process.env.HOME;
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'gcs-'));
  process.env.HOME = tmpHome;
});

afterEach(async () => {
  if (homeOriginal === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = homeOriginal;
  }
  await fs.remove(tmpHome);
});

function novoServico(): GlobalConfigService {
  return new GlobalConfigService();
}

async function escreverConfig(servico: GlobalConfigService, conteudo: string): Promise<void> {
  await fs.ensureDir(path.dirname(servico.configPath));
  await fs.writeFile(servico.configPath, conteudo, 'utf-8');
}

test('load sem arquivo devolve o default e nao cria arquivo', async () => {
  const servico = novoServico();
  const config = await servico.load();

  assert.deepStrictEqual(config, { version: 1, layout: 'coluna', cabecalho: 'painel', projetos: {} });
  assert.strictEqual(await fs.pathExists(servico.configPath), false);
  assert.strictEqual(await fs.pathExists(path.join(tmpHome, '.specifica-br')), false);
});

test('save grava JSON com indentacao 2 e version 1', async () => {
  const servico = novoServico();
  await servico.save({ version: 1, layout: 'moldura', projetos: {} });

  const texto = await fs.readFile(servico.configPath, 'utf-8');
  assert.strictEqual(texto, '{\n  "version": 1,\n  "layout": "moldura",\n  "projetos": {}\n}');
});

test('save nao deixa arquivo temporario para tras', async () => {
  const servico = novoServico();
  await servico.save({ version: 1, layout: 'coluna', projetos: {} });

  const entradas = await fs.readdir(path.join(tmpHome, '.specifica-br'));
  assert.deepStrictEqual(entradas.filter((nome) => nome.includes('.tmp')), []);
});

test('setProjectTool nao altera o registro dos demais projetos', async () => {
  const servico = novoServico();
  await servico.setProjectTool('projeto-a', 'claudecode');
  await servico.setProjectTool('projeto-b', 'cursor');
  await servico.setProjectTool('projeto-a', 'kiro');

  const config = await servico.load();
  assert.strictEqual(config.projetos?.['projeto-a']?.ferramenta, 'kiro');
  assert.strictEqual(config.projetos?.['projeto-b']?.ferramenta, 'cursor');
});

test('setProjectTool grava atualizadoEm em ISO 8601', async () => {
  const servico = novoServico();
  await servico.setProjectTool('projeto-a', 'opencode');

  const config = await servico.load();
  const valor = config.projetos?.['projeto-a']?.atualizadoEm ?? '';
  assert.ok(valor.endsWith('Z'));
  assert.strictEqual(new Date(valor).toISOString(), valor);
});

test('setLayout persiste entre instancias', async () => {
  await novoServico().setLayout('regua');
  assert.strictEqual(await novoServico().getLayout(), 'regua');
});

test('load com layout invalido devolve coluna sem lancar', async () => {
  const servico = novoServico();
  await escreverConfig(servico, JSON.stringify({ version: 1, layout: 'invalido', projetos: {} }));

  const config = await servico.load();
  assert.strictEqual(config.layout, 'coluna');
});

test('load com JSON invalido lanca erro bloqueante e nao sobrescreve o arquivo', async () => {
  const servico = novoServico();
  await escreverConfig(servico, '{');

  await assert.rejects(servico.load(), new RegExp(INVALID_CONFIG_MESSAGE.replace(/[.]/g, '\\.')));
  assert.strictEqual(await fs.readFile(servico.configPath, 'utf-8'), '{');
});

test('load com raiz nao-objeto lanca erro bloqueante', async () => {
  const servico = novoServico();

  await escreverConfig(servico, JSON.stringify([1, 2, 3]));
  await assert.rejects(servico.load(), { message: INVALID_CONFIG_MESSAGE });

  await escreverConfig(servico, JSON.stringify('texto'));
  await assert.rejects(servico.load(), { message: INVALID_CONFIG_MESSAGE });
});

test('load com version diferente de 1 lanca erro bloqueante', async () => {
  const servico = novoServico();
  await escreverConfig(servico, JSON.stringify({ version: 2, projetos: {} }));

  await assert.rejects(servico.load(), { message: INVALID_CONFIG_MESSAGE });
});

test('load com ferramenta fora dos cinco slugs lanca a mensagem nominal', async () => {
  const servico = novoServico();
  await escreverConfig(
    servico,
    JSON.stringify({ version: 1, projetos: { p: { ferramenta: 'inexistente', atualizadoEm: 'x' } } })
  );

  await assert.rejects(servico.load(), {
    message: 'ferramenta registrada inexistente nao e suportada. Rode: specifica-br config',
  });
});

test('setLayout com valor fora dos quatro lanca erro de validacao', async () => {
  const servico = novoServico();
  await assert.rejects(servico.setLayout('xpto' as never));
});

test('setProjectTool com slug fora dos cinco lanca erro de validacao', async () => {
  const servico = novoServico();
  await assert.rejects(servico.setProjectTool('projeto-a', 'vscode' as never));
});

test('load com cabecalho valido devolve o estilo guardado', async () => {
  const servico = novoServico();
  await escreverConfig(
    servico,
    JSON.stringify({ version: 1, layout: 'coluna', cabecalho: 'regua', projetos: {} })
  );

  assert.strictEqual((await servico.load()).cabecalho, 'regua');
});

test('setHeaderStyle grava a chave e preserva version, layout e projetos', async () => {
  const servico = novoServico();
  await servico.setLayout('moldura');
  await servico.setProjectTool('projeto-a', 'cursor');

  await servico.setHeaderStyle('compacto');

  const config = await servico.load();
  assert.strictEqual(config.version, 1);
  assert.strictEqual(config.layout, 'moldura');
  assert.strictEqual(config.cabecalho, 'compacto');
  assert.strictEqual(config.projetos?.['projeto-a']?.ferramenta, 'cursor');
});

test('setHeaderStyle seguido de setLayout preserva as duas chaves', async () => {
  const servico = novoServico();
  await servico.setHeaderStyle('regua');
  await servico.setLayout('lote');

  const config = await novoServico().load();
  assert.strictEqual(config.cabecalho, 'regua');
  assert.strictEqual(config.layout, 'lote');
});

test('load de configuracao da 1.9.0 sem a chave devolve painel e nao reescreve o arquivo', async () => {
  const servico = novoServico();
  const antes = JSON.stringify(
    { version: 1, layout: 'moldura', projetos: { p: { ferramenta: 'kiro', atualizadoEm: 'x' } } },
    null,
    2
  );
  await escreverConfig(servico, antes);

  const config = await servico.load();

  assert.strictEqual(config.cabecalho, 'painel');
  assert.strictEqual(config.layout, 'moldura');
  assert.strictEqual(await fs.readFile(servico.configPath, 'utf-8'), antes);
});

test('load com cabecalho invalido devolve painel sem lancar e nao reescreve o arquivo', async () => {
  const servico = novoServico();
  const antes = JSON.stringify({ version: 1, layout: 'coluna', cabecalho: 'xpto', projetos: {} });
  await escreverConfig(servico, antes);

  const config = await servico.load();

  assert.strictEqual(config.cabecalho, 'painel');
  assert.strictEqual(await fs.readFile(servico.configPath, 'utf-8'), antes);
});

test('setHeaderStyle com valor fora das tres formas lanca erro de validacao', async () => {
  const servico = novoServico();
  await assert.rejects(servico.setHeaderStyle('xpto' as never));
});

