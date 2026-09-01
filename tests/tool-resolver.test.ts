import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { ToolResolver } from '../dist/utils/tool-resolver.js';
import type { ToolSlug } from '../dist/types/config.js';

const MAPPING = [
  { name: 'ClaudeCode', commands: '.claude/commands/' },
  { name: 'Cursor', commands: '.cursor/commands/' },
  { name: 'Gemini CLI', commands: '.gemini/commands/' },
  { name: 'Kiro', commands: '.kiro/commands/' },
  { name: 'OpenCode', commands: '.opencode/command/' },
];

function fakeConfig(registrada?: ToolSlug) {
  const setCalls: Array<[string, string]> = [];
  return {
    setCalls,
    async getProjectTool(): Promise<ToolSlug | undefined> {
      return registrada;
    },
    async setProjectTool(projeto: string, ferramenta: string): Promise<void> {
      setCalls.push([projeto, ferramenta]);
    },
  };
}

function fakeFileService() {
  const state = { chamadas: 0 };
  return {
    state,
    async loadToolsMapping() {
      state.chamadas++;
      return MAPPING;
    },
  };
}

function entradaFake(escolha: ToolSlug | undefined) {
  const state = { chamadas: 0 };
  return {
    state,
    async selecionarFerramenta(): Promise<ToolSlug | undefined> {
      state.chamadas++;
      return escolha;
    },
  };
}

async function cwdComComandos(...relativos: string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tr-'));
  for (const relativo of relativos) {
    await fs.ensureDir(path.join(dir, relativo));
  }
  return dir;
}

function novoResolver(
  cfg: ReturnType<typeof fakeConfig>,
  fsvc: ReturnType<typeof fakeFileService>,
  entrada: ReturnType<typeof entradaFake>,
  isTTY: boolean
): ToolResolver {
  return new ToolResolver(cfg as never, fsvc as never, entrada, () => isTTY);
}

test('--tool vence o registro do projeto e e gravado', async () => {
  const cfg = fakeConfig('kiro');
  const fsvc = fakeFileService();
  const dir = await cwdComComandos();

  try {
    const resolvida = await novoResolver(cfg, fsvc, entradaFake(undefined), false).resolve(
      'proj',
      'cursor',
      dir
    );
    assert.equal(resolvida, 'cursor');
    assert.deepEqual(cfg.setCalls, [['proj', 'cursor']]);
  } finally {
    await fs.remove(dir);
  }
});

test('o registro do projeto e usado quando --tool nao e informado', async () => {
  const cfg = fakeConfig('kiro');
  const fsvc = fakeFileService();
  const dir = await cwdComComandos();

  try {
    const resolvida = await novoResolver(cfg, fsvc, entradaFake(undefined), false).resolve(
      'proj',
      undefined,
      dir
    );
    assert.equal(resolvida, 'kiro');
    assert.deepEqual(cfg.setCalls, [['proj', 'kiro']]);
  } finally {
    await fs.remove(dir);
  }
});

test('deteccao com exatamente uma ferramenta adota e grava sem perguntar', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const entrada = entradaFake('cursor');
  const dir = await cwdComComandos('.claude/commands');

  try {
    const resolvida = await novoResolver(cfg, fsvc, entrada, true).resolve('proj', undefined, dir);
    assert.equal(resolvida, 'claudecode');
    assert.deepEqual(cfg.setCalls, [['proj', 'claudecode']]);
    assert.equal(entrada.state.chamadas, 0);
  } finally {
    await fs.remove(dir);
  }
});

test('deteccao com duas ferramentas em TTY apresenta a selecao e grava a resposta', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const entrada = entradaFake('cursor');
  const dir = await cwdComComandos('.claude/commands', '.cursor/commands');

  try {
    const resolvida = await novoResolver(cfg, fsvc, entrada, true).resolve('proj', undefined, dir);
    assert.equal(resolvida, 'cursor');
    assert.equal(entrada.state.chamadas, 1);
    assert.deepEqual(cfg.setCalls, [['proj', 'cursor']]);
  } finally {
    await fs.remove(dir);
  }
});

test('deteccao inconclusiva sem TTY lanca a mensagem nominal', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const dir = await cwdComComandos();

  try {
    await assert.rejects(
      novoResolver(cfg, fsvc, entradaFake(undefined), false).resolve('proj', undefined, dir),
      {
        message:
          'nenhuma ferramenta registrada para este projeto e a deteccao foi inconclusiva. Informe --tool',
      }
    );
    assert.deepEqual(cfg.setCalls, []);
  } finally {
    await fs.remove(dir);
  }
});

test('a ferramenta resolvida e sempre gravada, inclusive quando veio de --tool', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const dir = await cwdComComandos();

  try {
    await novoResolver(cfg, fsvc, entradaFake(undefined), false).resolve('proj', 'ClaudeCode', dir);
    assert.deepEqual(cfg.setCalls, [['proj', 'claudecode']]);
  } finally {
    await fs.remove(dir);
  }
});

test('cancelamento da selecao interativa nao grava ferramenta nenhuma', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const entrada = entradaFake(undefined);
  const dir = await cwdComComandos('.claude/commands', '.cursor/commands');

  try {
    const resolvida = await novoResolver(cfg, fsvc, entrada, true).resolve('proj', undefined, dir);
    assert.equal(resolvida, null);
    assert.deepEqual(cfg.setCalls, []);
    assert.equal(entrada.state.chamadas, 1);
  } finally {
    await fs.remove(dir);
  }
});

test('--tool invalido lanca erro de validacao', async () => {
  const cfg = fakeConfig(undefined);
  const fsvc = fakeFileService();
  const dir = await cwdComComandos();

  try {
    await assert.rejects(
      novoResolver(cfg, fsvc, entradaFake(undefined), false).resolve('proj', 'vscode', dir)
    );
    assert.deepEqual(cfg.setCalls, []);
  } finally {
    await fs.remove(dir);
  }
});

test('na segunda execucao do mesmo projeto nenhuma deteccao e feita', async () => {
  const cfg = fakeConfig('opencode');
  const fsvc = fakeFileService();
  const dir = await cwdComComandos('.claude/commands', '.cursor/commands');

  try {
    await novoResolver(cfg, fsvc, entradaFake(undefined), true).resolve('proj', undefined, dir);
    assert.equal(fsvc.state.chamadas, 0);
  } finally {
    await fs.remove(dir);
  }
});

// CR-006: a deteccao unica fala com o usuario e por isso passa pela camada de
// identidade visual, nunca por `console.log` cru (RF-011 + RF-013).
test('a mensagem de deteccao unica sai pelo emissor injetado, nao pelo console', async () => {
  const cfg = fakeConfig();
  const fsvc = fakeFileService();
  const dir = await cwdComComandos('.claude/commands');
  const emitidas: string[] = [];

  const consoleOriginal = console.log;
  const doConsole: string[] = [];
  console.log = ((...args: unknown[]): void => {
    doConsole.push(args.join(' '));
  }) as typeof console.log;

  try {
    const resolver = new ToolResolver(
      cfg as never,
      fsvc as never,
      entradaFake(undefined),
      () => false,
      (texto: string) => emitidas.push(texto)
    );
    const resolvida = await resolver.resolve('proj', undefined, dir);

    assert.equal(resolvida, 'claudecode');
    assert.equal(doConsole.length, 0);
    assert.equal(emitidas.length, 1);
    assert.ok(emitidas[0].includes('ferramenta detectada'));
    // O rotulo `[ INFO]` e responsabilidade do emissor (`status`), nao do texto.
    assert.ok(!emitidas[0].includes('[ INFO]'));
  } finally {
    console.log = consoleOriginal;
    await fs.remove(dir);
  }
});
