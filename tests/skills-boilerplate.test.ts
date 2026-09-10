import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRETORIO_SKILLS = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'skills');
const DIRETORIO_COMMANDS = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'commands');

function extrairFrontmatter(conteudo: string): Record<string, string> {
  const linhas = conteudo.split(/\r?\n/);

  if (linhas[0] !== '---') {
    throw new Error('Arquivo sem bloco de frontmatter');
  }

  const campos: Record<string, string> = {};

  for (const linha of linhas.slice(1)) {
    if (linha === '---') {
      return campos;
    }

    const campo = linha.match(/^([a-zA-Z-]+):\s*(.*)$/);

    if (campo) {
      campos[campo[1]] = campo[2].trim();
    }
  }

  throw new Error('Frontmatter sem fechamento');
}

function executarValidador(script: string, alvo: string): { codigo: number; saida: string } {
  const resultado = spawnSync(process.execPath, [script, alvo], { encoding: 'utf8' });

  return {
    codigo: resultado.status ?? 1,
    saida: `${resultado.stdout}${resultado.stderr}`
  };
}

const PRD_CONFORME = [
  '# PRODUCT REQUIREMENTS DOCUMENT (PRD)',
  '',
  '| Metadata | Details |',
  '| :--- | :--- |',
  '| **Status** | Draft |',
  '| **Data** | 2026-09-10 |',
  '| **Feature** | recibo-digital |',
  '<!-- Status: DRAFT -> IN_PROGRESS -> IN_REVIEW -> APPROVED -->',
  '',
  '---',
  '',
  '## 1. Contexto e Problema',
  '',
  '**O Problema (Estado Atual):**',
  '* Lançamentos manuais geram 10% de erro.',
  '',
  '**Causa Raiz (Hipótese):**',
  '* Digitação manual sem validação.',
  '',
  '**O Objetivo (Estado Futuro):**',
  '* Reduzir erros de lançamento para menos de 1%.',
  '',
  '---',
  '',
  '## 2. Escopo',
  '',
  '### 2.1. O que Faremos (In-Scope)',
  '* [ ] Emissão de recibo digital',
  '',
  '### 2.2. O que NÃO Faremos (Out-of-Scope)',
  '* [ ] Integração com contabilidade',
  '',
  '### 2.3. Dependências de Sistema',
  '',
  '| ID | Dependência | Tipo (Interna/Externa) | Crítico? | Observações |',
  '|:---|:---|:---|:---|:---|',
  '| DEP-001 | Módulo Usuários | Interna | Não | Versão >= 2.0 |',
  '',
  '---',
  '',
  '## 3. Personas e User Stories',
  '',
  '| ID | Persona | Ação (Quero...) | Benefício (Para...) |',
  '|:---|:---|:---|:---|',
  '| US-001 | Contador | Lançar recibo automatizado | Reduzir erros manuais em 80% |',
  '| US-002 | Gerente | Aprovar recibos em lote | Agilizar fechamento mensal |',
  '',
  '---',
  '',
  '## 4. Requisitos Funcionais e Regras de Negócio',
  '',
  '### 4.1. Regras Principais (Happy Path)',
  '* **[RF-001] Lançamento automatizado:**',
  '    * **Comportamento:** Lança recibo a partir do upload.',
  '    * **Critério de Sucesso:** Recibo lançado em até 2s.',
  '    * **Fonte:** [US-001]',
  '    * **Cenário de Teste (Gherkin):**',
  '        - DADO que o upload foi concluído',
  '        - QUANDO o sistema processa o arquivo',
  '        - ENTÃO o recibo é lançado',
  '',
  '* **[RF-002] Aprovação em lote:**',
  '    * **Comportamento:** Aprova os recibos selecionados.',
  '    * **Critério de Sucesso:** Lote aprovado em uma única ação.',
  '    * **Fonte:** [US-002]',
  '',
  '---',
  '',
  '## 5. Fluxos de Exceção e Tratamento de Erros (Unhappy Path)',
  '',
  '| Cenário de Erro | Severidade | Comportamento do Sistema | Mensagem |',
  '| :--- | :--- | :--- | :--- |',
  '| **Upload inválido** | Bloqueante | Bloquear submissão | O arquivo deve ser PDF |',
  '',
  '---',
  '',
  '## 6. Requisitos Não-Funcionais (Qualidade)',
  '',
  '* **[RNF-001] Performance:** Carregamento não deve exceder 2s para 95% das requisições.',
  '',
  '---',
  '',
  '## 7. Itens em Aberto e Dúvidas (TBD)',
  '',
  '| ID | Questão / Dúvida | Quem deve responder? | Impacto | Ação Decisória |',
  '| :--- | :--- | :--- | :--- | :--- |',
  '| **[TBD-001]** | Texto final do e-mail de confirmação | Marketing | Baixo | Definir até Q3 |',
  '',
  '---',
  '',
  '## 8. Critérios de Aceite (Definition of Done)',
  '',
  '1. [ ] Cumprir todos os Requisitos Funcionais listados (seção 4).',
  '2. [ ] Tratar graciosamente todos os Fluxos de Exceção listados (seção 5).',
  ''
].join('\n');

const PRD_COM_VIOLACOES = [
  '# PRODUCT REQUIREMENTS DOCUMENT (PRD)',
  '',
  '| Metadata | Details |',
  '| :--- | :--- |',
  '| **Status** | Draft |',
  '| **Data** | {{DATA_ATUAL}} |',
  '| **Feature** | [nome-da-funcionalidade] |',
  '<!-- Status: DRAFT -> IN_PROGRESS -> IN_REVIEW -> APPROVED -->',
  '<!-- Formato: "Como [persona], quero [ação], para [benefício]". -->',
  '',
  '---',
  '',
  '## 1. Contexto e Problema',
  '',
  '**O Problema (Estado Atual):**',
  '* Lançamentos manuais geram 10% de erro.',
  '',
  '---',
  '',
  '## 2. Escopo',
  '',
  '### 2.1. O que Faremos (In-Scope)',
  '* [ ] Emissão de recibo digital',
  '',
  '---',
  '',
  '## 3. Personas e User Stories',
  '',
  '| ID | Persona | Ação (Quero...) | Benefício (Para...) |',
  '|:---|:---|:---|:---|',
  '| US-001 | Contador | Lançar recibo automatizado | Reduzir erros manuais |',
  '| US-002 | Gerente | Aprovar recibos em lote | Agilizar fechamento |',
  '| US-003 | Auditor | Auditar recibos | Garantir conformidade |',
  '',
  '---',
  '',
  '## 4. Requisitos Funcionais e Regras de Negócio',
  '',
  '* **[RF-001] Lançamento automatizado:**',
  '    * **Comportamento:** Lança recibo a partir do upload.',
  '    * **Critério de Sucesso:** Recibo lançado em até 2s.',
  '    * **Fonte:** [US-001, US-999]',
  '',
  '* **[RF-002] Aprovação em lote:**',
  '    * **Comportamento:** Aprova os recibos selecionados.',
  '    * **Critério de Sucesso:** Lote aprovado em uma única ação.',
  '',
  '---',
  '',
  '## 6. Requisitos Não-Funcionais (Qualidade)',
  '',
  '* **[RNF-001] Performance:** Carregamento não deve exceder 2s.',
  '',
  '---',
  '',
  '## 7. Itens em Aberto e Dúvidas (TBD)',
  '',
  'Sem itens em aberto.',
  '',
  '---',
  '',
  '## 8. Critérios de Aceite (Definition of Done)',
  '',
  '1. [ ] Cumprir todos os Requisitos Funcionais listados (seção 4).',
  ''
].join('\n');

const CODEREVIEW_CONFORME = [
  '# Code Review - recibo-digital',
  '',
  '## Metadados',
  '- **Escopo**: branch feature/recibo-digital',
  '- **Data**: 2026-09-10',
  '- **Contexto**: Projeto TypeScript',
  '- **Especificações**: specs/features/recibo-digital/prd.md',
  '',
  '## Resumo',
  '| Severidade | Quantidade |',
  '|:---|---:|',
  '| CRITICAL | 0 |',
  '| HIGH | 1 |',
  '| MEDIUM | 0 |',
  '| LOW | 0 |',
  '| **Total** | **1** |',
  '',
  '## Findings Críticos (BLOCKER)',
  '',
  '*Nenhum finding crítico encontrado.*',
  '',
  '## Findings Alta Prioridade',
  '',
  '### [F-001] Concatenação de query SQL',
  '`src/db/users.ts:12` | **HIGH** | Segurança',
  '',
  '**Problema**: Concatena input do usuário em consulta SQL, permitindo injeção.',
  '',
  '**Código atual**:',
  '```typescript',
  'const query = `SELECT * FROM users WHERE name LIKE \'${name}\'`;',
  '```',
  '',
  '**Correção recomendada**:',
  '```typescript',
  'const query = \'SELECT * FROM users WHERE name LIKE $1\';',
  'return db.query(query, [name]);',
  '```',
  '*Por que*: Parametrização previne injeção independente do input.',
  '',
  '## Demais Findings',
  '',
  '### Média Prioridade',
  '*Nenhum finding de média prioridade encontrado.*',
  '',
  '### Baixa Prioridade (Sugestões)',
  '*Nenhum finding de baixa prioridade encontrado.*',
  '',
  '## Pontos Positivos',
  '- Cobertura de testes ampla nos handlers.',
  '',
  '## Veredito',
  '',
  '**Status**: APROVADO COM RESSALVAS',
  '',
  '**Justificativa**: ',
  'Zero findings críticos; F-001 requer correção antes do merge. Código bem estruturado e aderente aos padrões do projeto.',
  '',
  '**Pré-condições para merge**:',
  '- [ ] **Obrigatório**: Corrigir F-001 (injeção de SQL) - bloqueador de segurança',
  '',
  '**Recomendações gerais**:',
  'Manter parametrização de queries em todo o acesso a dados.',
  '',
  '---',
  '',
  '## Formato de Finding (Referência)',
  '',
  'Use este formato para cada finding:',
  ''
].join('\n');

const CODEREVIEW_COM_VIOLACOES = [
  '# Code Review - {{FEATURE_NAME}}',
  '',
  '## Metadados',
  '- **Escopo**: branch feature/recibo-digital',
  '- **Data**: 2026-09-10',
  '- **Contexto**: Projeto TypeScript',
  '- **Especificações**: specs/features/recibo-digital/prd.md',
  '',
  '## Resumo',
  '| Severidade | Quantidade |',
  '|:---|---:|',
  '| CRITICAL | 0 |',
  '| HIGH | 1 |',
  '| MEDIUM | 0 |',
  '| LOW | 0 |',
  '| **Total** | **1** |',
  '',
  '## Findings Críticos (BLOCKER)',
  '',
  '*Nenhum finding crítico encontrado.*',
  '',
  '## Findings Alta Prioridade',
  '',
  '### [F-002] Tratamento de erro ausente',
  '',
  '**Problema**: Falha silenciosa quando o serviço externo retorna erro.',
  '',
  '## Demais Findings',
  '',
  '### Média Prioridade',
  '*Nenhum finding de média prioridade encontrado.*',
  '',
  '### Baixa Prioridade (Sugestões)',
  '*Nenhum finding de baixa prioridade encontrado.*',
  '',
  '## Veredito',
  '',
  '**Status**: {{VEREDICTO_STATUS}}',
  '',
  '**Recomendações gerais**:',
  'Melhorar tratamento de erros.',
  '',
  '---',
  '',
  '## Formato de Finding (Referência)',
  '',
  'Use este formato para cada finding:',
  ''
].join('\n');

test('toda skill do boilerplate tem frontmatter com name igual ao diretorio e description nao vazia', () => {
  const skills = readdirSync(DIRETORIO_SKILLS, { withFileTypes: true })
    .filter(entrada => entrada.isDirectory());

  assert.ok(skills.length > 0, 'nenhuma skill encontrada no boilerplate');

  for (const skill of skills) {
    const conteudo = readFileSync(path.join(DIRETORIO_SKILLS, skill.name, 'SKILL.md'), 'utf-8');
    const frontmatter = extrairFrontmatter(conteudo);

    assert.match(skill.name, /^[a-z0-9-]+$/, `diretorio ${skill.name} fora do padrao minusculas/hifens`);
    assert.equal(frontmatter.name, skill.name, `skill ${skill.name}: name do frontmatter difere do diretorio`);
    assert.ok(
      frontmatter.description && frontmatter.description.length > 0,
      `skill ${skill.name}: description vazia`
    );
  }
});

test('dispatchers de gerar-prd e realizar-codereview preservam frontmatter e apontam para a skill', () => {
  const casos = [
    {
      arquivo: 'gerar-prd.md',
      skill: 'gerar-prd',
      description: 'Gera o PRD de uma funcionalidade a partir da descrição do usuário.',
      argumentHint: '"[descrição da funcionalidade]"'
    },
    {
      arquivo: 'realizar-codereview.md',
      skill: 'realizar-codereview',
      description: 'Faz code review de uma branch, arquivo ou codebase e gera relatório.',
      argumentHint: '"[branch, arquivo ou diretório]"'
    }
  ];

  for (const caso of casos) {
    const conteudo = readFileSync(path.join(DIRETORIO_COMMANDS, caso.arquivo), 'utf-8');
    const frontmatter = extrairFrontmatter(conteudo);

    assert.equal(frontmatter.description, caso.description, `${caso.arquivo}: description do frontmatter alterada`);
    assert.equal(frontmatter['argument-hint'], caso.argumentHint, `${caso.arquivo}: argument-hint do frontmatter alterado`);
    assert.ok(conteudo.includes(`\`${caso.skill}\``), `${caso.arquivo}: dispatcher nao referencia a skill ${caso.skill}`);
    assert.ok(conteudo.includes('assets/'), `${caso.arquivo}: dispatcher nao menciona assets/`);
    assert.ok(conteudo.includes('scripts/'), `${caso.arquivo}: dispatcher nao menciona scripts/`);

    const ferramentas = ['Claude', 'OpenCode', 'Cursor', 'Gemini', 'Kiro'];
    for (const ferramenta of ferramentas) {
      assert.ok(!conteudo.includes(ferramenta), `${caso.arquivo}: dispatcher menciona ferramenta "${ferramenta}"`);
    }

    assert.ok(!conteudo.includes('\\'), `${caso.arquivo}: dispatcher contem barra invertida`);
  }
});

test('validador do gerar-prd aprova PRD conforme', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-prd-ok-'));

  try {
    const alvo = path.join(diretorio, 'prd.md');
    writeFileSync(alvo, PRD_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-prd', 'scripts', 'validar-prd.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-prd rejeita PRD com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-prd-erro-'));

  try {
    const alvo = path.join(diretorio, 'prd.md');
    writeFileSync(alvo, PRD_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-prd', 'scripts', 'validar-prd.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 1, 'PRD com violacoes deveria ser rejeitado');

    const esperados = [
      '{{',
      '[nome-da-funcionalidade]',
      '## 5.',
      'comentário de autoria',
      'US-003',
      'US-999',
      'RF-002'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do realizar-codereview aprova relatorio conforme', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-review-ok-'));

  try {
    const alvo = path.join(diretorio, 'code-review.md');
    writeFileSync(alvo, CODEREVIEW_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'realizar-codereview', 'scripts', 'validar-codereview.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do realizar-codereview rejeita relatorio com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-review-erro-'));

  try {
    const alvo = path.join(diretorio, 'code-review.md');
    writeFileSync(alvo, CODEREVIEW_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'realizar-codereview', 'scripts', 'validar-codereview.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 1, 'relatorio com violacoes deveria ser rejeitado');

    const esperados = [
      '{{',
      'Pontos Positivos',
      'F-002',
      'status de veredito inválido',
      'Justificativa',
      'Pré-condições'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});
