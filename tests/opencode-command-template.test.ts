import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  detectarMarcadores,
  removerFrontmatter,
  resolverTemplateDoComando,
} from '../dist/utils/opencode-command-template.js';

let contador = 0;

async function dirTemporario(prefixo: string): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefixo}-${process.pid}-${contador++}`);
  await fs.ensureDir(dir);
  return dir;
}

async function prepararBase(): Promise<{ projeto: string; home: string; config: string; xdgAnterior: string | undefined }> {
  const projeto = await dirTemporario('opencode-template-projeto');
  const home = await dirTemporario('opencode-template-home');
  const config = await dirTemporario('opencode-template-config');
  const xdgAnterior = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = config;
  return { projeto, home, config, xdgAnterior };
}

function restaurarXdg(xdgAnterior: string | undefined): void {
  if (xdgAnterior === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = xdgAnterior;
  }
}

async function limpar(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await fs.remove(dir);
  }
}

function pacoteInexistente(): string {
  return path.join(os.tmpdir(), `opencode-template-ausente-${process.pid}-${contador++}`, 'executar-task.md');
}

test('projeto no layout command vence o global', async () => {
  const base = await prepararBase();
  try {
    await fs.outputFile(path.join(base.projeto, '.opencode', 'command', 'executar-task.md'), '---\ndescription: projeto\n---\n\nCORPO_PROJETO\n');
    await fs.outputFile(path.join(base.config, 'opencode', 'command', 'executar-task.md'), 'CORPO_GLOBAL\n');
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home);
    assert.notEqual(resolvido, null);
    assert.equal(resolvido?.origem, 'projeto');
    assert.equal(resolvido?.corpo, 'CORPO_PROJETO');
    assert.equal(resolvido?.caminho, path.join(base.projeto, '.opencode', 'command', 'executar-task.md'));
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('projeto no layout legado commands e resolvido com origem projeto', async () => {
  const base = await prepararBase();
  try {
    await fs.outputFile(path.join(base.projeto, '.opencode', 'commands', 'executar-task.md'), 'CORPO_LEGADO_PROJETO\n');
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home);
    assert.notEqual(resolvido, null);
    assert.equal(resolvido?.origem, 'projeto');
    assert.equal(resolvido?.corpo, 'CORPO_LEGADO_PROJETO');
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('global vence o pacote quando o projeto nao tem template', async () => {
  const base = await prepararBase();
  try {
    await fs.outputFile(path.join(base.config, 'opencode', 'command', 'executar-task.md'), 'CORPO_GLOBAL\n');
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home);
    assert.notEqual(resolvido, null);
    assert.equal(resolvido?.origem, 'global');
    assert.equal(resolvido?.corpo, 'CORPO_GLOBAL');
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('global no layout legado commands e resolvido com origem global', async () => {
  const base = await prepararBase();
  try {
    await fs.outputFile(path.join(base.config, 'opencode', 'commands', 'executar-task.md'), 'CORPO_LEGADO_GLOBAL\n');
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home);
    assert.notEqual(resolvido, null);
    assert.equal(resolvido?.origem, 'global');
    assert.equal(resolvido?.corpo, 'CORPO_LEGADO_GLOBAL');
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('pacote e usado como ultima fonte com frontmatter descartado', async () => {
  const base = await prepararBase();
  try {
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home);
    assert.notEqual(resolvido, null);
    assert.equal(resolvido?.origem, 'pacote');
    assert.ok((resolvido?.corpo.length ?? 0) > 0);
    assert.ok(!(resolvido?.corpo.startsWith('---') ?? true));
    assert.ok(!(resolvido?.corpo.includes('argument-hint') ?? true));
    assert.ok(resolvido?.corpo.includes('<system_instructions>') ?? false);
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('ausencia nas tres fontes devolve null', async () => {
  const base = await prepararBase();
  try {
    const resolvido = await resolverTemplateDoComando(base.projeto, base.home, pacoteInexistente());
    assert.equal(resolvido, null);
  } finally {
    restaurarXdg(base.xdgAnterior);
    await limpar([base.projeto, base.home, base.config]);
  }
});

test('removerFrontmatter descarta o bloco inicial e apara o restante', () => {
  assert.equal(removerFrontmatter('---\ndescription: algo\n---\n\ncorpo aqui\n'), 'corpo aqui');
});

test('removerFrontmatter aceita arquivo sem frontmatter', () => {
  assert.equal(removerFrontmatter('\n  corpo sem frontmatter  \n'), 'corpo sem frontmatter');
});

test('removerFrontmatter sem fechamento devolve o texto aparado', () => {
  assert.equal(removerFrontmatter('---\ncorpo sem fechamento\n'), '---\ncorpo sem fechamento');
});

test('detectarMarcadores reconhece $ARGUMENTS', () => {
  assert.equal(detectarMarcadores('execute $ARGUMENTS agora'), true);
});

test('detectarMarcadores reconhece referenciais posicionais de $1 a $9', () => {
  assert.equal(detectarMarcadores('primeiro $1'), true);
  assert.equal(detectarMarcadores('nono $9'), true);
  assert.equal(detectarMarcadores('meio $5 fim'), true);
});

test('detectarMarcadores reconhece bloco executavel iniciado por ```!', () => {
  assert.equal(detectarMarcadores('texto\n```!bash\necho oi\n```\n'), true);
});

test('detectarMarcadores devolve falso para corpo sem marcadores', () => {
  assert.equal(detectarMarcadores('corpo simples sem nada especial'), false);
  assert.equal(detectarMarcadores('preco $ e crase ``` sem exclamacao'), false);
});
