import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FileService } from '../dist/utils/file-service.js';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_MAPPING = path.join(RAIZ_PROJETO, 'src', 'assets', 'tools-mapping.json');

let cwdOriginal: string;
let dirTemp: string;

beforeEach(async () => {
  cwdOriginal = process.cwd();
  dirTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'tools-mapping-'));
  process.chdir(dirTemp);
});

afterEach(async () => {
  process.chdir(cwdOriginal);
  await fs.remove(dirTemp);
});

test('tools-mapping.json tem 6 ferramentas, incluindo o Codex com diretorios oficiais', () => {
  const mappings = JSON.parse(readFileSync(CAMINHO_MAPPING, 'utf-8'));

  assert.equal(mappings.length, 6);

  const codex = mappings.find((m: { name: string }) => m.name === 'Codex');

  assert.ok(codex, 'entrada do Codex ausente');
  assert.equal(codex.skills, '.agents/skills/');
  assert.equal(codex.templates, 'specs/templates/');
  assert.equal(codex.global.skills.base, 'home');
  assert.equal(codex.global.skills.path, '.agents/skills/');
  assert.equal(
    codex.commands,
    undefined,
    'Codex nao pode mapear comandos: custom prompts sao deprecated e apenas globais na documentacao oficial'
  );
});

test('loadToolsMapping valida e devolve as 6 entradas', async () => {
  const fileService = new FileService();
  const mappings = await fileService.loadToolsMapping();

  assert.equal(mappings.length, 6);
  assert.ok(mappings.some((m) => m.name === 'Codex'));
});

test('diretorio ~/.agents/skills/ compartilhado e deduplicado entre Gemini CLI, OpenCode e Codex', async () => {
  const fileService = new FileService();
  const mappings = await fileService.loadToolsMapping();
  const alvo = mappings.filter((m) => ['Gemini CLI', 'OpenCode', 'Codex'].includes(m.name));

  const targets = fileService.resolveTargets(alvo, 'global', false);

  const skills = targets.filter((t) => t.kind === 'skills');
  assert.equal(skills.length, 1, 'skills deveriam gerar um unico target deduplicado');
  assert.deepEqual(skills[0].tools, ['Gemini CLI', 'OpenCode', 'Codex']);

  const commands = targets.filter((t) => t.kind === 'commands');
  assert.equal(commands.length, 2, 'Gemini CLI e OpenCode tem diretorios de comandos distintos');
  for (const target of commands) {
    assert.ok(
      !target.tools.includes('Codex'),
      'Codex nao pode aparecer em target de comandos'
    );
  }
});

test('templates so viram target quando a flag --templates esta ativa', async () => {
  const fileService = new FileService();
  const mappings = await fileService.loadToolsMapping();
  const claude = mappings.filter((m) => m.name === 'ClaudeCode');

  const semFlag = fileService.resolveTargets(claude, 'local', false);
  assert.equal(semFlag.filter((t) => t.kind === 'templates').length, 0);

  const comFlag = fileService.resolveTargets(claude, 'local', true);
  const templates = comFlag.filter((t) => t.kind === 'templates');
  assert.equal(templates.length, 1);
  assert.equal(templates[0].dir, path.join(dirTemp, 'specs/templates/'));
});
