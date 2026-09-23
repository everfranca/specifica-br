import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FileService } from '../dist/utils/file-service.js';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRETORIO_SKILLS = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'skills');

let cwdOriginal: string;
let dirTemp: string;
let fileService: FileService;

beforeEach(async () => {
  cwdOriginal = process.cwd();
  dirTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'init-templates-'));
  process.chdir(dirTemp);
  fileService = new FileService();
});

afterEach(async () => {
  process.chdir(cwdOriginal);
  await fs.remove(dirTemp);
});

test('init --local sem --templates nao cria specs/templates e instala comandos e skills', async () => {
  const mappings = await fileService.loadToolsMapping();
  const claude = mappings.filter((m) => m.name === 'ClaudeCode');

  await fileService.createStructure(claude, 'local', false);

  assert.equal(
    fs.pathExistsSync(path.join(dirTemp, 'specs', 'templates')),
    false,
    'specs/templates nao deveria ser criado sem a flag --templates'
  );

  const comandos = readdirSync(path.join(dirTemp, '.claude', 'commands')).sort();
  assert.deepEqual(comandos, [
    'executar-task.md',
    'gerar-contexto.md',
    'gerar-prd.md',
    'gerar-tasks.md',
    'gerar-techspec.md',
    'gerar-visao.md',
    'realizar-codereview.md'
  ]);

  const skills = readdirSync(path.join(dirTemp, '.claude', 'skills')).sort();
  assert.deepEqual(skills, [
    'gerar-contexto',
    'gerar-prd',
    'gerar-tasks',
    'gerar-techspec',
    'gerar-visao',
    'product-manager',
    'realizar-codereview',
    'techspec-generator'
  ]);
});

test('init --local --templates cria specs/templates com os 7 templates', async () => {
  const mappings = await fileService.loadToolsMapping();
  const claude = mappings.filter((m) => m.name === 'ClaudeCode');

  await fileService.createStructure(claude, 'local', true);

  const templates = readdirSync(path.join(dirTemp, 'specs', 'templates')).sort();
  assert.deepEqual(templates, [
    'architecture-template.md',
    'codereview-template.md',
    'prd-template.md',
    'product_vision-template.md',
    'task-template.md',
    'tasks-template.md',
    'techspec-template.md'
  ]);
});

test('escopo global sem flag nao produz target de templates; com flag, restaura a copia classica', async () => {
  const mappings = await fileService.loadToolsMapping();
  const claude = mappings.filter((m) => m.name === 'ClaudeCode');

  const semFlag = fileService.resolveTargets(claude, 'global', false);
  assert.equal(semFlag.filter((t) => t.kind === 'templates').length, 0);

  const comFlag = fileService.resolveTargets(claude, 'global', true);
  const templates = comFlag.filter((t) => t.kind === 'templates');
  assert.equal(templates.length, 1);
  assert.equal(templates[0].dir, path.join(dirTemp, 'specs/templates/'));
});

test('skills de geracao declaram a precedencia permanente do template do projeto', () => {
  const skills = [
    'gerar-prd',
    'realizar-codereview',
    'gerar-techspec',
    'gerar-tasks',
    'gerar-visao',
    'gerar-contexto'
  ];

  for (const skill of skills) {
    const conteudo = readFileSync(path.join(DIRETORIO_SKILLS, skill, 'SKILL.md'), 'utf-8');

    assert.ok(
      conteudo.includes('specs/templates/') && /PREVALE[CM]/.test(conteudo),
      `skill ${skill}: regra de precedencia do template do projeto ausente`
    );
  }
});

test('install do Codex instala apenas skills, sem diretorio de comandos', async () => {
  const mappings = await fileService.loadToolsMapping();
  const codex = mappings.filter((m) => m.name === 'Codex');

  const targets = fileService.resolveTargets(codex, 'local', false);

  assert.equal(targets.filter((t) => t.kind === 'commands').length, 0);
  assert.equal(targets.filter((t) => t.kind === 'skills').length, 1);
  assert.equal(targets[0].dir, path.join(dirTemp, '.agents/skills/'));
});
