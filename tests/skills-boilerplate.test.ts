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

function executarValidador(script: string, ...alvos: string[]): { codigo: number; saida: string } {
  const resultado = spawnSync(process.execPath, [script, ...alvos], { encoding: 'utf8' });

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

test('dispatchers das skills convertidas apontam para a skill e sao neutros de ferramenta e SO', () => {
  const casos = [
    { arquivo: 'gerar-prd.md', skill: 'gerar-prd', argumentHint: '"[descrição da funcionalidade]"' },
    { arquivo: 'realizar-codereview.md', skill: 'realizar-codereview', argumentHint: '"[branch, arquivo ou diretório]"' },
    { arquivo: 'gerar-techspec.md', skill: 'gerar-techspec', argumentHint: '"[caminho do prd.md]"' },
    { arquivo: 'gerar-tasks.md', skill: 'gerar-tasks', argumentHint: '"[caminho do prd.md] [caminho do techspec.md]"' },
    { arquivo: 'gerar-visao.md', skill: 'gerar-visao', argumentHint: '"[ideia do projeto]"' },
    { arquivo: 'gerar-contexto.md', skill: 'gerar-contexto', argumentHint: '"[caminho do projeto]"' }
  ];

  for (const caso of casos) {
    const conteudo = readFileSync(path.join(DIRETORIO_COMMANDS, caso.arquivo), 'utf-8');
    const frontmatter = extrairFrontmatter(conteudo);

    assert.ok(
      frontmatter.description && frontmatter.description.length > 0,
      `${caso.arquivo}: description derivada da skill esta vazia`
    );
    assert.equal(frontmatter['argument-hint'], caso.argumentHint, `${caso.arquivo}: argument-hint do frontmatter alterado`);
    assert.ok(conteudo.includes(`\`${caso.skill}\``), `${caso.arquivo}: dispatcher nao referencia a skill ${caso.skill}`);
    assert.ok(conteudo.includes('assets/'), `${caso.arquivo}: dispatcher nao menciona assets/`);
    assert.ok(conteudo.includes('scripts/'), `${caso.arquivo}: dispatcher nao menciona scripts/`);

    const ferramentas = ['Claude', 'OpenCode', 'Cursor', 'Gemini', 'Kiro', 'Codex'];
    for (const ferramenta of ferramentas) {
      assert.ok(!conteudo.includes(ferramenta), `${caso.arquivo}: dispatcher menciona ferramenta "${ferramenta}"`);
    }

    assert.ok(!conteudo.includes('\\'), `${caso.arquivo}: dispatcher contem barra invertida`);
  }
});

test('executar-task permanece comando integral, nunca dispatcher gerado', () => {
  const conteudo = readFileSync(path.join(DIRETORIO_COMMANDS, 'executar-task.md'), 'utf-8');
  const frontmatter = extrairFrontmatter(conteudo);

  assert.equal(
    frontmatter.description,
    'Executa os itens pendentes de um task-N.md e atualiza o status na task e no tasks.md.',
    'executar-task.md: description alterada'
  );
  assert.ok(
    !conteudo.includes('apenas um dispatcher'),
    'executar-task.md: virou dispatcher - a conversao e proibida'
  );
  assert.ok(conteudo.length > 1000, 'executar-task.md: conteudo integral foi perdido');
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

const TECHSPEC_CONFORME = [
  '# Technical Specification: recibo-digital',
  '',
  '| Metadata | Details |',
  '| :--- | :--- |',
  '| **Status** | Draft |',
  '| **Data** | 2026-09-10 |',
  '| **Referência PRD** | [Link PRD](./prd.md) |',
  '<!-- Status: DRAFT -> IN_PROGRESS -> APPROVED -->',
  '',
  '---',
  '',
  '## 1. Introdução e contexto',
  'Contexto da feature de recibo digital.',
  '',
  '## 2. High-Level Architecture [Obrigatório]',
  'Componente único de aplicação.',
  '',
  '## 3. Design e Persistência de Dados [Se aplicável]',
  'Tabela recibos.',
  '',
  '## 4. Contratos de Integracao (Boundaries) [Obrigatorio]',
  '',
  '### Tabela Resumo de Contratos',
  '',
  '| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |',
  '|:---|:---|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | HTTP | PROPOSTO | 4.1 |',
  '| CT-002 | Backend-Database | INSERT recibos | SQL | DESCOBERTO (schema.sql:12) | 4.2 |',
  '| ENV-001 | Application-Environment | RECIBO_API_KEY | env | SOLICITADO | 4.8 |',
  '',
  '### 4.1 Contrato Client-Backend [Se aplicavel]',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Como Obtido** | PROPOSTO |',
  '',
  '### 4.8 Contrato Application-Environment [Obrigatorio]',
  'Variável RECIBO_API_KEY obrigatória.',
  '',
  '## 5. Lógica de negócio e algoritmos principais [Obrigatório]',
  'Fluxo principal passo a passo.',
  '',
  '## 6. Observability & Operational Readiness [Se aplicável]',
  'Logging com correlationId.',
  '',
  '## 7. Segurança & Compliance [Se aplicável]',
  'Inputs sanitizados.',
  '',
  '## 8. Plano de Implementação [Obrigatório]',
  'Passo 1 e Passo 2 independentes.',
  '',
  '## 9. Skills e MCPs Utilizados [Obrigatorio]',
  '',
  '| Nome | Tipo | Origem | Situacao | Secoes/Decisoes Embasadas |',
  '|:---|:---|:---|:---|:---|',
  '| context7 | MCP | GLOBAL | UTILIZADO | Secao 4: contratos de terceiros |'
].join('\n');

const TECHSPEC_COM_VIOLACOES = [
  '# Technical Specification: {{FEATURE_NAME}}',
  '',
  '| Metadata | Details |',
  '| :--- | :--- |',
  '| **Status** | Draft |',
  '| **Data** | {{DATA_ATUAL}} |',
  '<!-- Status: DRAFT -> IN_PROGRESS -> APPROVED -->',
  '<!-- Formato: instruções de autoria que não devem permanecer no artefato. -->',
  '',
  '## 1. Introdução e contexto',
  'Contexto.',
  '',
  '## 2. High-Level Architecture [Obrigatório]',
  'Componente.',
  '',
  '## 3. Design e Persistência de Dados [Se aplicável]',
  'Tabela.',
  '',
  '## 4. Contratos de Integracao (Boundaries) [Obrigatorio]',
  '',
  '### Tabela Resumo de Contratos',
  '',
  '| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |',
  '|:---|:---|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | HTTP | {{ORIGEM}} | 4.1 |',
  '',
  '### 4.1 Contrato Client-Backend [Se aplicavel]',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |',
  '',
  '## 5. Lógica de negócio e algoritmos principais [Obrigatório]',
  'Fluxo.',
  '',
  '## 6. Observability & Operational Readiness [Se aplicável]',
  'Logs.',
  '',
  '## 7. Segurança & Compliance [Se aplicável]',
  'Segurança.',
  '',
  '## 8. Plano de Implementação [Obrigatório]',
  'Passos.'
].join('\n');

const TECHSPEC_PARA_TASKS = [
  '# Technical Specification: recibo-digital',
  '',
  '## 4. Contratos de Integracao (Boundaries) [Obrigatorio]',
  '',
  '### Tabela Resumo de Contratos',
  '',
  '| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |',
  '|:---|:---|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | HTTP | PROPOSTO | 4.1 |',
  '| CT-002 | Backend-Database | INSERT recibos | SQL | DESCOBERTO (schema.sql:12) | 4.2 |',
  '| ENV-001 | Application-Environment | RECIBO_API_KEY | env | SOLICITADO | 4.8 |',
  '',
  '## 7. Segurança & Compliance [Se aplicável]',
  'Requisito SEC-001 exige sanitização de entrada.'
].join('\n');

const TECHSPEC_PARA_TASKS_VIOLACAO = [
  '# Technical Specification: recibo-digital',
  '',
  '## 4. Contratos de Integracao (Boundaries) [Obrigatorio]',
  '',
  '### Tabela Resumo de Contratos',
  '',
  '| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |',
  '|:---|:---|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | HTTP | PROPOSTO | 4.1 |',
  '| CT-002 | Backend-Database | INSERT recibos | SQL | DESCOBERTO (schema.sql:12) | 4.2 |',
  '| CT-003 | Backend-External | Stripe Payment Intent | HTTP | SOLICITADO | 4.5 |',
  '',
  '## 7. Segurança & Compliance [Se aplicável]',
  'Requisito SEC-001 exige sanitização de entrada.'
].join('\n');

const TASKS_MD_CONFORME = [
  '# Lista de tarefas da funcionalidade recibo-digital',
  '',
  '## Contratos (Resumo da Techspec Seção 4)',
  '',
  '| ID | Fronteira | Contrato | Seção Techspec |',
  '|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | 4.1 |',
  '| CT-002 | Backend-Database | INSERT recibos | 4.2 |',
  '',
  '## Tarefas',
  '- [ ] task-1.md - Implementar endpoint de recibos (CT-001)',
  '- [ ] task-2.md - Criar migration de recibos (CT-002, ENV-001)'
].join('\n');

const TASKS_MD_COM_VIOLACOES = [
  '# Lista de tarefas da funcionalidade recibo-digital',
  '',
  '## Contratos (Resumo da Techspec Seção 4)',
  '',
  '| ID | Fronteira | Contrato | Seção Techspec |',
  '|:---|:---|:---|:---|',
  '| CT-001 | Client-Backend | POST /api/v1/recibos | 4.1 |',
  '| CT-002 | Backend-Database | INSERT recibos | 4.2 |',
  '',
  '## Tarefas',
  '- [ ] task-1.md - Implementar endpoint e migration (CT-001, CT-002)',
  '- [ ] task-3.md - Sincronizar documentos CORE'
].join('\n');

function montarTaskConforme(id: string, titulo: string, corpoContratos: string[], secaoNove: string[]): string {
  return [
    `# Task: ${id} - ${titulo}`,
    '',
    '| Metadata | Details |',
    '| :--- | :--- |',
    '| **Status** | TODO |',
    '| **Data** | 2026-09-10 |',
    '<!-- Status: TODO -> IN_PROGRESS -> DONE -->',
    '',
    '## 1. Contexto e Objetivo',
    `${titulo}.`,
    '',
    '## 2. Requisitos da Tarefa',
    '### 2.1 Funcionais (Comportamento)',
    '- [ ] (RF-001) Emitir recibo digital',
    '',
    '### 2.3 Contratos (Boundaries)',
    ...corpoContratos,
    '',
    '## 3. Plano de Execução (Sub-tarefas)',
    '- [ ] **Passo 1: Estruturas de Dados e Contratos**',
    '- [ ] **Passo 2: Implementação da Lógica de Negócio**',
    '',
    '## 4. Detalhes de Implementacao & Contratos',
    'Schemas conforme techspec.md seção 4.',
    '',
    '## 5. Contexto de Arquivos (File Context)',
    '### 5.1 Arquivos de Leitura',
    '- `./specs/features/recibo-digital/prd.md`',
    '',
    '## 6. Criterios de Aceite (Definition of Done)',
    '- [ ] O código compila sem erros.',
    '',
    '## 7. Arquivos Relevantes (Obrigatório)',
    'Nenhum adicional.',
    '',
    '## 8. Notas de Execução (Scratchpad)',
    'Atende SEC-001 com sanitização de entrada.',
    '',
    '## 9. Skills e MCPs',
    ...secaoNove
  ].join('\n');
}

const TASK_1_CONFORME = montarTaskConforme(
  '1',
  'Implementar endpoint de recibos',
  ['- [ ] (CT-001) POST /api/v1/recibos - Seção 4.1 do techspec.md - origem: PROPOSTO'],
  [
    '- **context7**',
    '    - *Tipo:* MCP',
    '    - *Origem:* GLOBAL',
    '    - *Motivo:* Passo 2 valida o schema do CT-001',
    '    - *Passos de Aplicação:* Passo 2'
  ]
);

const TASK_2_CONFORME = montarTaskConforme(
  '2',
  'Criar migration de recibos',
  [
    '- [ ] (CT-002) INSERT recibos - Seção 4.2 do techspec.md - origem: DESCOBERTO',
    '- [ ] (ENV-001) RECIBO_API_KEY - obrigatória: sim'
  ],
  [
    'Nenhuma skill ou MCP aplicavel a esta task.',
    'Justificativa: task de migration sem itens pertinentes no inventario.'
  ]
);

const TASK_1_COM_VIOLACOES = [
  '# Task: 1 - Implementar endpoint e migration',
  '',
  '| Metadata | Details |',
  '| :--- | :--- |',
  '| **Status** | TODO |',
  '| **Data** | {{DATA_ATUAL}} |',
  '<!-- Status: TODO -> IN_PROGRESS -> DONE -->',
  '<!-- Comentário de autoria que não deve permanecer. -->',
  '',
  '## 1. Contexto e Objetivo',
  'Task mista proposital para o teste.',
  '',
  '## 2. Requisitos da Tarefa',
  '### 2.3 Contratos (Boundaries)',
  '- [ ] (CT-001) POST /api/v1/recibos - Seção 4.1 do techspec.md',
  '- [ ] (CT-002) INSERT recibos - Seção 4.2 do techspec.md',
  '',
  '## 3. Plano de Execução (Sub-tarefas)',
  '- [ ] **Passo 1: Estruturas de Dados e Contratos**',
  '',
  '## 4. Detalhes de Implementacao & Contratos',
  'Schemas.',
  '',
  '## 5. Contexto de Arquivos (File Context)',
  '### 5.1 Arquivos de Leitura',
  '- `./specs/features/recibo-digital/prd.md`',
  '',
  '## 6. Criterios de Aceite (Definition of Done)',
  '- [ ] Compila sem erros.',
  '',
  '## 7. Arquivos Relevantes (Obrigatório)',
  'Nenhum.',
  '',
  '## 8. Notas de Execução (Scratchpad)',
  'Notas.',
  '',
  '## 9. Skills e MCPs',
  '- **context7**',
  '    - *Tipo:* MCP'
].join('\n');

const PRODUCT_VISION_CONFORME = [
  '# PRODUCT VISION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | APPROVED |',
  '| **Data** | 2026-09-10 |',
  '| **Projeto** | Agenda de Clínicas |',
  '<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->',
  '',
  '## 1. Declaração do Problema',
  '**Problema Central:**',
  '* Clínicas perdem 10% dos agendamentos por conflito de agenda.',
  '',
  '## 2. Personas e Público-Alvo',
  '| Persona | Descrição | Principais Necessidades | Dores Atuais |',
  '|:---|:---|:---|:---|',
  '| **Recepcionista** | Opera a agenda diária | Agendar sem conflito | Ligações manuais |',
  '',
  '## 3. Proposta de Valor',
  '**Promessa Central:**',
  '* Agendamento sem conflito de agenda.',
  '',
  '## 4. Métricas de Sucesso',
  '| Métrica | Como Medir | Meta Inicial | Meta Futura |',
  '|:---|:---|:---|:---|',
  '| **Retenção** | % de retornos em 30 dias | 40% | 60% |',
  '',
  '## 5. Fronteiras do Produto (Scope)',
  '### 5.1. Escopo Includente (IN-SCOPE)',
  '* [ ] **Agendamento:** gestão completa da agenda da clínica',
  '',
  '## 6. Jornada do Usuário',
  '### 6.1. Primeiro Contato',
  '* Indicação de outras clínicas.',
  '',
  '## 7. Riscos e Suposições',
  '| Suposição | Plano de Validação | Risco se Falso |',
  '|:---|:---|:---|',
  '| Clínicas adotam autoatendimento | Entrevistas | Baixa adoção |',
  '',
  '## 8. Visão de Futuro',
  '**Evolução Planejada:**',
  '* **Curto Prazo (6 meses):** validar a proposta de valor.',
  '',
  '## 9. Stakeholders',
  '| Stakeholder | Interesse | Poder de Influência | Estratégia de Engajamento |',
  '|:---|:---|:---:|:---|'
].join('\n');

const ARCHITECTURE_CONFORME = [
  '# ARCHITECTURE DEFINITION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | APPROVED |',
  '| **Data** | 2026-09-10 |',
  '| **Nível de Profundidade** | HIGH_LEVEL |',
  '<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->',
  '',
  '## 1. Paradigma Arquitetural',
  '**Padrão Arquitetural Principal:**',
  '* Clean Architecture em monolito modular.',
  '',
  '## 2. Stack Tecnológico',
  '### 2.1. Backend',
  '| Categoria | Tecnologia | Versão Específica | Justificativa |',
  '|:---|:---|:---|:---|',
  '| **Linguagem** | C# | C# 12 | Produtividade do time |',
  '',
  '### 2.3. Banco de Dados',
  '| Categoria | Tecnologia | Versão Específica | Justificativa |',
  '|:---|:---|:---|:---|',
  '| **Tipo** | PostgreSQL | 15.x | Dados relacionais |',
  '',
  '## 3. Padrões de Design e Convenções',
  '### 3.1. Convenções de Nomenclatura',
  '| Tipo | Convenção | Exemplo |',
  '|:---|:---|:---|',
  '| **Classes** | PascalCase | UserRepository |'
].join('\n');

const PRODUCT_VISION_COM_VIOLACOES = [
  '# PRODUCT VISION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | DRAFT |',
  '| **Data** | {{DATA_ATUAL}} |',
  '<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->',
  '<!-- Instruções de preenchimento que não devem permanecer. -->',
  '',
  '## 1. Declaração do Problema',
  '* Clínicas perdem agendamentos por conflito de agenda.',
  '',
  '## 2. Personas e Público-Alvo',
  '| Persona | Descrição |',
  '|:---|:---|',
  '| **Recepcionista** | Opera a agenda |',
  '',
  '## 3. Proposta de Valor',
  '* Interface construída em React para agilizar o agendamento.',
  '',
  '## 4. Métricas de Sucesso',
  '| Métrica | Como Medir | Meta |',
  '|:---|:---|:---|',
  '| **Retenção** | % retornos | 40% |',
  '',
  '## 5. Fronteiras do Produto (Scope)',
  '* [ ] **Agendamento:** gestão da agenda',
  '',
  '## 6. Jornada do Usuário',
  '* Indicação de outras clínicas.',
  '',
  '## 7. Riscos e Suposições',
  '| Suposição | Plano | Risco |',
  '|:---|:---|:---|',
  '| Adoção do autoatendimento | Entrevistas | Baixa adoção |',
  '',
  '## 8. Visão de Futuro',
  '* **Curto Prazo:** validar a proposta.'
].join('\n');

const ARCHITECTURE_COM_VIOLACOES = [
  '# ARCHITECTURE DEFINITION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | DRAFT |',
  '| **Data** | 2026-09-10 |',
  '| **Nível de Profundidade** | COMPREHENSIVE |',
  '',
  '## 1. Paradigma Arquitetural',
  '* Clean Architecture.',
  '',
  '## 2. Stack Tecnológico',
  '### 2.1. Backend',
  '| Categoria | Tecnologia | Versão |',
  '|:---|:---|:---|',
  '| **Linguagem** | C# | C# 12 |',
  '',
  '## 3. Padrões de Design e Convenções',
  '* Persona de operação não é tema deste documento, mas citada aqui para o teste de contaminação.'
].join('\n');

const ARCHITECTURE_CONTEXTO_CONFORME = [
  '# ARCHITECTURE DEFINITION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | APPROVED |',
  '| **Data** | 2026-09-10 |',
  '| **Nível de Profundidade** | COMPREHENSIVE |',
  '<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->',
  '',
  '## 1. Paradigma Arquitetural',
  '* Clean Architecture com violações locais documentadas como debt técnico.',
  '',
  '## 2. Stack Tecnológico',
  '| Tecnologia | Confiança | Justificativa |',
  '|:---|:---:|:---|',
  '| **.NET 8** | 100% | .csproj com TargetFramework net8.0 |',
  '| **PostgreSQL 15** | 75% | connection string sem versão explícita |',
  '',
  '## 12. Integrações Externas',
  '| Serviço | Tipo | Versão |',
  '|:---|:---|:---|',
  '| **Stripe** | Payment | v14.2 |',
  '',
  '## 13. Maturidade de Testes',
  '| Framework | Jest v29.7 |',
  '|:---|:---|',
  '| **Nível** | INTERMEDIÁRIO |',
  '',
  '## 14. Domínio Inferido (DDD)',
  '| Contexto | Confiança |',
  '|:---|:---:|',
  '| **Users** | 85% |'
].join('\n');

const PRODUCT_VISION_CONTEXTO_CONFORME = [
  '# PRODUCT VISION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | DRAFT |',
  '| **Data** | 2026-09-10 |',
  '| **Projeto** | Plataforma de Pedidos |',
  '<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->',
  '',
  '## 1. Declaração do Problema',
  '* Pedidos telefônicos geram erro de anotação.',
  '',
  '## 2. Personas e Público-Alvo',
  '| Persona | Descrição |',
  '|:---|:---|',
  '| **Consumidor** | Faz pedidos pelo canal digital |',
  '',
  '## 3. Proposta de Valor',
  '* Pedido sem erro de anotação.',
  '',
  '## 4. Métricas de Sucesso',
  '| Métrica | Como Medir | Meta |',
  '|:---|:---|:---|',
  '| **Retenção** | % de recompra | 40% |',
  '',
  '## 5. Fronteiras do Produto (Scope)',
  '* [ ] **Pedidos:** ciclo completo do pedido',
  '',
  '## 6. Jornada do Usuário',
  '* Descoberta por busca orgânica.',
  '',
  '## 7. Riscos e Suposições',
  '| Suposição | Plano | Risco |',
  '|:---|:---|:---|',
  '| Adoção do canal digital | Dados de venda | Baixa conversão |',
  '',
  '## 8. Visão de Futuro',
  '* **Curto Prazo:** validar o canal digital.',
  '',
  '## 9. Stakeholders',
  '| Stakeholder | Interesse |',
  '|:---|:---|',
  '| **Operação** | Redução de retrabalho |',
  '',
  '## 10. Inferências do Código Legado',
  '| Inferência de Negócio | Fonte Técnica | Confiança |',
  '|:---|:---|:---:|',
  '| **Pagamentos assíncronos** | Stripe webhooks, background jobs | 95% |',
  '| **Sistema em escala** | Rate limiting (Redis), load balancer | 78% |'
].join('\n');

const ARCHITECTURE_CONTEXTO_COM_VIOLACOES = [
  '# ARCHITECTURE DEFINITION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | DRAFT |',
  '| **Data** | 2026-09-10 |',
  '',
  '## 1. Paradigma Arquitetural',
  '* Clean Architecture [REVISAR] com violações detectadas.',
  '',
  '## 2. Stack Tecnológico',
  '* Stack detectada com níveis de confiança.',
  '',
  '## 12. Integrações Externas',
  '| Serviço | Tipo |',
  '|:---|:---|',
  '| **Stripe** | Payment |',
  '',
  '## 13. Maturidade de Testes',
  '* Nível INTERMEDIÁRIO. A persona de operação não é tema aqui, citada para o teste.'
].join('\n');

const PRODUCT_VISION_CONTEXTO_COM_VIOLACOES = [
  '# PRODUCT VISION',
  '',
  '| Metadata | Details |',
  '|:---|:---|',
  '| **Status** | DRAFT |',
  '| **Data** | {{DATA_ATUAL}} |',
  '| **Projeto** | Plataforma de Pedidos |',
  '',
  '## 1. Declaração do Problema',
  '* Pedidos armazenados em PostgreSQL geram lentidão na anotação.',
  '',
  '## 2. Personas e Público-Alvo',
  '| Persona | Descrição |',
  '|:---|:---|',
  '| **Consumidor** | Faz pedidos |',
  '',
  '## 3. Proposta de Valor',
  '* Pedido sem erro.',
  '',
  '## 4. Métricas de Sucesso',
  '| Métrica | Meta |',
  '|:---|:---|',
  '| **Retenção** | 40% |',
  '',
  '## 5. Fronteiras do Produto (Scope)',
  '* [ ] **Pedidos:** ciclo completo',
  '',
  '## 6. Jornada do Usuário',
  '* Busca orgânica.',
  '',
  '## 7. Riscos e Suposições',
  '| Suposição | Risco |',
  '|:---|:---|',
  '| Adoção digital | Baixa conversão |',
  '',
  '## 8. Visão de Futuro',
  '* Validar o canal.',
  '',
  '## 9. Stakeholders',
  '| Stakeholder | Interesse |',
  '|:---|:---|',
  '| **Operação** | Menos retrabalho |'
].join('\n');

test('bloco de descoberta (BLOCO-DESC CT-006) identico byte a byte entre gerar-techspec e gerar-tasks', () => {
  const caminhoTechspec = path.join(DIRETORIO_SKILLS, 'gerar-techspec', 'references', 'descoberta-skills-mcps.md');
  const caminhoTasks = path.join(DIRETORIO_SKILLS, 'gerar-tasks', 'references', 'descoberta-skills-mcps.md');
  const conteudoTechspec = readFileSync(caminhoTechspec);
  const conteudoTasks = readFileSync(caminhoTasks);

  assert.ok(conteudoTechspec.equals(conteudoTasks), 'references/descoberta-skills-mcps.md difere entre gerar-techspec e gerar-tasks');

  const texto = conteudoTechspec.toString('utf-8');
  assert.ok(texto.includes('<!-- INICIO BLOCO-DESC (CT-006)'), 'marcador de inicio do BLOCO-DESC ausente');
  assert.ok(texto.includes('<!-- FIM BLOCO-DESC (CT-006) -->'), 'marcador de fim do BLOCO-DESC ausente');
});

test('templates compartilhados identicos entre gerar-visao e gerar-contexto e sincronizados com o boilerplate', () => {
  const pares = ['product_vision-template.md', 'architecture-template.md'];
  const diretorioTemplates = path.join(RAIZ_PROJETO, 'src', 'assets', 'boilerplate', 'templates');

  for (const nome of pares) {
    const visao = readFileSync(path.join(DIRETORIO_SKILLS, 'gerar-visao', 'assets', nome));
    const contexto = readFileSync(path.join(DIRETORIO_SKILLS, 'gerar-contexto', 'assets', nome));
    const canonicos = readFileSync(path.join(diretorioTemplates, nome));

    assert.ok(visao.equals(contexto), `assets/${nome} difere entre gerar-visao e gerar-contexto`);
    assert.ok(visao.equals(canonicos), `assets/${nome} da skill difere do template canonico do boilerplate`);
  }

  const techspecAsset = readFileSync(path.join(DIRETORIO_SKILLS, 'gerar-techspec', 'assets', 'techspec-template.md'));
  const techspecCanonico = readFileSync(path.join(diretorioTemplates, 'techspec-template.md'));
  assert.ok(techspecAsset.equals(techspecCanonico), 'assets/techspec-template.md difere do template canonico');

  for (const nome of ['task-template.md', 'tasks-template.md']) {
    const asset = readFileSync(path.join(DIRETORIO_SKILLS, 'gerar-tasks', 'assets', nome));
    const canonico = readFileSync(path.join(diretorioTemplates, nome));
    assert.ok(asset.equals(canonico), `assets/${nome} difere do template canonico`);
  }
});

test('SKILL.md das skills convertidas tem menos de 500 linhas e padrao critical no topo e rodape', () => {
  const skillsConvertidas = ['gerar-techspec', 'gerar-tasks', 'gerar-visao', 'gerar-contexto'];

  for (const skill of skillsConvertidas) {
    const conteudo = readFileSync(path.join(DIRETORIO_SKILLS, skill, 'SKILL.md'), 'utf-8');
    const totalLinhas = conteudo.split(/\r?\n/).length;

    assert.ok(totalLinhas < 500, `skill ${skill}: SKILL.md com ${totalLinhas} linhas (limite 500)`);
    assert.equal(
      conteudo.split('</critical>').length - 1,
      2,
      `skill ${skill}: SKILL.md deveria ter bloco critical no topo e no rodape`
    );
  }
});

test('referencias com mais de 100 linhas possuem sumario', () => {
  const skillsConvertidas = ['gerar-techspec', 'gerar-tasks', 'gerar-visao', 'gerar-contexto'];

  for (const skill of skillsConvertidas) {
    const diretorioReferences = path.join(DIRETORIO_SKILLS, skill, 'references');

    for (const nome of readdirSync(diretorioReferences)) {
      const conteudo = readFileSync(path.join(diretorioReferences, nome), 'utf-8');
      const totalLinhas = conteudo.split(/\r?\n/).length;

      if (totalLinhas > 100) {
        assert.ok(
          conteudo.includes('## Sumário') || conteudo.includes('## Sumario'),
          `skill ${skill}: references/${nome} com ${totalLinhas} linhas deveria ter sumario`
        );
      }
    }
  }
});

test('validador do gerar-techspec aprova techspec conforme', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-techspec-ok-'));

  try {
    const alvo = path.join(diretorio, 'techspec.md');
    writeFileSync(alvo, TECHSPEC_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-techspec', 'scripts', 'validar-techspec.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-techspec rejeita techspec com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-techspec-erro-'));

  try {
    const alvo = path.join(diretorio, 'techspec.md');
    writeFileSync(alvo, TECHSPEC_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-techspec', 'scripts', 'validar-techspec.mjs');
    const resultado = executarValidador(script, alvo);

    assert.equal(resultado.codigo, 1, 'techspec com violacoes deveria ser rejeitado');

    const esperados = [
      '{{',
      '## 9.',
      'comentário de autoria',
      'origem válida',
      'Como Obtido'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-tasks aprova conjunto de tasks conforme', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-tasks-ok-'));

  try {
    const techspec = path.join(diretorio, 'techspec.md');
    const tasksMd = path.join(diretorio, 'tasks.md');
    const task1 = path.join(diretorio, 'task-1.md');
    const task2 = path.join(diretorio, 'task-2.md');
    writeFileSync(techspec, TECHSPEC_PARA_TASKS);
    writeFileSync(tasksMd, TASKS_MD_CONFORME);
    writeFileSync(task1, TASK_1_CONFORME);
    writeFileSync(task2, TASK_2_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-tasks', 'scripts', 'validar-tasks.mjs');
    const resultado = executarValidador(script, techspec, tasksMd, task1, task2);

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-tasks rejeita conjunto com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-tasks-erro-'));

  try {
    const techspec = path.join(diretorio, 'techspec.md');
    const tasksMd = path.join(diretorio, 'tasks.md');
    const task1 = path.join(diretorio, 'task-1.md');
    writeFileSync(techspec, TECHSPEC_PARA_TASKS_VIOLACAO);
    writeFileSync(tasksMd, TASKS_MD_COM_VIOLACOES);
    writeFileSync(task1, TASK_1_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-tasks', 'scripts', 'validar-tasks.mjs');
    const resultado = executarValidador(script, techspec, tasksMd, task1);

    assert.equal(resultado.codigo, 1, 'conjunto com violacoes deveria ser rejeitado');

    const esperados = [
      'CT-003',
      'task-3.md',
      'mistura camadas',
      'cinco campos',
      '{{',
      'comentário de autoria'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-visao aprova artefatos conformes', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-visao-ok-'));

  try {
    const visao = path.join(diretorio, 'product_vision.md');
    const arquitetura = path.join(diretorio, 'architecture.md');
    writeFileSync(visao, PRODUCT_VISION_CONFORME);
    writeFileSync(arquitetura, ARCHITECTURE_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-visao', 'scripts', 'validar-visao.mjs');
    const resultado = executarValidador(script, visao, arquitetura, 'HIGH');

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-visao rejeita artefatos com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-visao-erro-'));

  try {
    const visao = path.join(diretorio, 'product_vision.md');
    const arquitetura = path.join(diretorio, 'architecture.md');
    writeFileSync(visao, PRODUCT_VISION_COM_VIOLACOES);
    writeFileSync(arquitetura, ARCHITECTURE_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-visao', 'scripts', 'validar-visao.mjs');
    const resultado = executarValidador(script, visao, arquitetura, 'COMPREHENSIVE');

    assert.equal(resultado.codigo, 1, 'artefatos com violacoes deveriam ser rejeitados');

    const esperados = [
      '{{',
      '## 9.',
      'react',
      'comentário de autoria',
      'persona',
      '## 4.'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-contexto aprova artefatos conformes', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-contexto-ok-'));

  try {
    const arquitetura = path.join(diretorio, 'architecture.md');
    const visao = path.join(diretorio, 'product_vision.md');
    writeFileSync(arquitetura, ARCHITECTURE_CONTEXTO_CONFORME);
    writeFileSync(visao, PRODUCT_VISION_CONTEXTO_CONFORME);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-contexto', 'scripts', 'validar-contexto.mjs');
    const resultado = executarValidador(script, arquitetura, visao);

    assert.equal(resultado.codigo, 0, `saida: ${resultado.saida}`);
    assert.ok(resultado.saida.includes('OK'), 'resumo de sucesso deveria conter OK');
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

test('validador do gerar-contexto rejeita artefatos com violacoes conhecidas', () => {
  const diretorio = mkdtempSync(path.join(tmpdir(), 'validar-contexto-erro-'));

  try {
    const arquitetura = path.join(diretorio, 'architecture.md');
    const visao = path.join(diretorio, 'product_vision.md');
    writeFileSync(arquitetura, ARCHITECTURE_CONTEXTO_COM_VIOLACOES);
    writeFileSync(visao, PRODUCT_VISION_CONTEXTO_COM_VIOLACOES);

    const script = path.join(DIRETORIO_SKILLS, 'gerar-contexto', 'scripts', 'validar-contexto.mjs');
    const resultado = executarValidador(script, arquitetura, visao);

    assert.equal(resultado.codigo, 1, 'artefatos com violacoes deveriam ser rejeitados');

    const esperados = [
      'Domínio Inferido',
      '[REVISAR]',
      'persona',
      'postgresql',
      '## 10',
      '{{'
    ];

    for (const esperado of esperados) {
      assert.ok(resultado.saida.includes(esperado), `saida deveria mencionar: ${esperado}`);
    }
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});
