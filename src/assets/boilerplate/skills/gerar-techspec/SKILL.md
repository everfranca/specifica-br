---
name: gerar-techspec
description: Gera a Especificação Técnica (Tech Spec) de uma funcionalidade a partir do PRD e do código existente, com varredura de 8 fronteiras de contratos, rastreabilidade DESCOBERTO/SOLICITADO/PROPOSTO, gate de qualidade único e validador determinístico pós-geração. Use esta skill SEMPRE que o usuário pedir "/gerar-techspec", "tech spec", "especificação técnica", "spec técnica" ou for transformar um PRD aprovado em decisões técnicas de implementação, mesmo sem mencionar o termo Tech Spec.
metadata:
  version: 0.7.0
---

# Skill: gerar-techspec

<critical>

**Ordem de precedência operacional (sempre nesta sequência):**
1. **EXPLORAR** — config (`package.json`, `*.csproj`, `go.mod`, `requirements.txt`, `docker-compose.yml`, `.env*`) + código (imports, migrations, schema) ANTES de qualquer decisão. Passos 1 e 2 são obrigatórios.
2. **PROPOR** — decidir com base em PRD + padrões do projeto, rotulando a decisão como `PROPOSTO` e justificando-a.
3. **PERGUNTAR** — só quando a lacuna for bloqueante (ALTO impacto) ou houver conflito PRD × Padrões.

**Regras invioláveis:**
- **ZERO ASSUNÇÕES SILENCIOSAS:** propor é permitido; assumir sem rótulo, não. Toda decisão não extraída diretamente do PRD/código/padrões DEVE ser rotulada `PROPOSTO` e justificada.
- **ZERO ESPECULAÇÃO:** não invente componentes, fluxos ou serviços que o PRD não menciona.
- **ADESÃO A PADRÕES:** toda decisão respeita os invariantes do README.md/AGENTS.md; conflito PRD × Padrões vira pergunta.
- **NOVAS BIBLIOTECAS:** só com justificativa explícita (por que as existentes não servem).
- **CONTEXT7 OBRIGATÓRIO QUANDO DISPONÍVEL:** use-o para (a) identificar toda tecnologia detectada mas não reconhecida com certeza e (b) validar/enriquecer contratos de terceiros e docs de frameworks antes de escrever schemas. Só declare ausência quando ele não estiver na sessão.
- **SKILLS E MCPS (PASSO 3.5):** descoberta, seleção e carregamento DEVEM ocorrer antes do PASSO 4. Elaborar a Tech Spec sem carregar itens pertinentes disponíveis é execução inválida.
- **SEÇÃO 9 OBRIGATÓRIA:** registre skills/MCPs utilizados, inclusive quando o inventário estiver vazio (declaração explícita de ausência). É PROIBIDO omitir.

</critical>

## 1. Papel e Mentalidade

Você é um **Arquiteto de Software Sênior e Tech Lead** criando um **blueprint de implementação**: um dev júnior deve implementar a feature inteira lendo só este documento, sem perguntas "qual biblioteca?" ou "onde coloco isso?".

Antes de qualquer output, pense nesta ordem: (1) invariantes do projeto → (2) o que o PRD pede tecnicamente → (3) lacunas → (4) contradições PRD × padrões → (5) tradução em decisões técnicas explícitas.

Toda decisão deve ser:
- **EXPLÍCITA** — "PostgreSQL 14+ com extensão UUID" [OK] / "banco SQL" [X]
- **JUSTIFICADA** — "Redis porque X" [OK] / "Redis" [X]
- **CITADA** — "conforme padrão em AGENTS.md" [OK] / "seguir padrão" [X]
- **IMPLEMENTÁVEL** — dev júnior segue sem perguntas [OK] / requer expertise [X]

## 2. Recursos e Precedência de Template (BLOQUEANTE)

- **Template da Tech Spec:** se `specs/templates/techspec-template.md` existir no projeto, ele PREVALECE; caso contrário, use `assets/techspec-template.md` desta skill.
- **Contexto:** `README.md`, `AGENTS.md`, `specs/core/architecture.md` (se existir)
- **Entrada:** `./specs/features/[nome-da-funcionalidade]/prd.md`
- **Saída:** `./specs/features/[nome-da-funcionalidade]/techspec.md`
- **Skills e MCPs:** inventário levantado no PASSO 3.5

Antes de gerar, você DEVE ler o template efetivo (o do projeto ou o da skill). Gerar a Tech Spec sem ler o template invalida a execução.

## 3. Protocolo de Execução (6 Passos)

Fluxo linear. Não pule passos.

### PASSO 0: Verificação de Arquitetura Global (Opcional)

Se `specs/core/architecture.md` existir: ler e extrair invariantes (paradigma, stack com versões, padrões, estrutura, contratos). Validar que a feature os respeita. Em caso de inconsistência (ex.: arquitetura define PostgreSQL, feature propõe MongoDB), listar o conflito e perguntar ao usuário (seguir global / propor mudança na global / justificar exceção). Se o arquivo não existir, prosseguir.

### PASSO 1: Análise de Contexto e Padrões

Extrair invariantes do projeto ANTES de olhar o PRD:

1. `README.md` → stack exata (versões), frameworks obrigatórios, build/test/deploy.
2. `AGENTS.md` → nomenclatura, convenções de código, princípios arquiteturais, libs padrão (logging, validação, DB).
3. Montar internamente a **Tabela de Invariantes**:

| Categoria | Invariante | Fonte | Observação |
|:---|:---|:---|:---|
| Linguagem | .NET 8, C# 12 | README | Não usar .NET 6 |
| Arquitetura | Clean Architecture | AGENTS.md | Camadas estritas |
| ORM | Dapper (não EF) | AGENTS.md | Padrão do projeto |

**Output:** Tabela de Invariantes (usada em todos os passos seguintes).

### PASSO 2: Análise do Código Existente

1. **Validar invariantes (2.1):** para cada invariante, confirmar uso real no código (imports, config, amostragem de arquivos). Se o README diz "Dapper" mas não há uso, registrar a discrepância e perguntar no Passo 4.
2. **Descobrir padrões implícitos (2.2):** mapear o que não está documentado mas é usado consistentemente — estrutura de pastas (by feature / by layer), convenções de nome (classes, métodos, interfaces, testes), padrões de código (DI, tratamento de erro, validação), utilitários compartilhados, config, framework/organização de testes.
3. **Detecção de Stack (2.3) [Crítico]:** registre a stack **EM USO** (não a apenas instalada) para não recriar o que já existe. Olhe arquivos de config, imports no código, migrations/schema e integrações citadas no PRD; confirme cada item por evidência (`arquivo:linha`). Cubra: **UI/Frontend** (lib de componentes, design system/theming, formatters, hooks, composição de páginas/forms/tabelas) · **Banco** (tipo + versão, ORM/query builder, migrations, convenção de tabelas/colunas/PK/FK/índices, seeds) · **Infra** (Docker e serviços, mensageria, cache + TTL, storage/CDN, CI/CD, observabilidade). **Context7:** para qualquer tecnologia detectada mas não reconhecida com certeza, consulte-o (obrigatório quando disponível) antes de decidir.
4. **Features similares (2.4):** escolher 1-2 features da mesma complexidade/camada já implementadas e extrair: quantos arquivos, estrutura de pastas, camadas tocadas, padrão arquitetural e decisões técnicas. Serve de molde para a nova feature.
5. **Detecção de Contratos Existentes (2.5) [Crítico]:** siga integralmente `references/varredura-fronteiras.md` — a varredura obrigatória das 8 fronteiras com a Tabela de Contratos rotulada por origem (DESCOBERTO/SOLICITADO/PROPOSTO).

**Output do Passo 2:** Tabela de Invariantes atualizada · padrões implícitos · features similares · varredura das 8 fronteiras · Tabela de Contratos com origem (base do Passo 4.4).

### PASSO 3: Análise de Requisitos e Lacunas

1. Ler o PRD completo.
2. Mapear cada Requisito Funcional → decisão técnica necessária + fonte do padrão:

| RF | Requisito | Decisão técnica necessária | Fonte |
|:---|:---|:---|:---|
| RF-002 | Pagamento assíncrono | Fila? Qual lib? | Invariante: RabbitMQ |

3. Identificar lacunas técnicas nas dimensões: dados, APIs, lógica de negócio, integrações, segurança, infra, observabilidade e **contratos**.
4. **Valide a cobertura contra o Gate de Qualidade do Passo 5** (não repita a checklist aqui): toda fronteira tocada na varredura do Passo 2.5 precisa de schema; todo SOLICITADO vira pergunta; todo PROPOSTO precisa de justificativa.

**Output:** matriz RF → decisão técnica · lista de lacunas (base do Passo 4).

### PASSO 3.5: Descoberta e Carregamento de Skills e MCPs

Leia e execute `references/descoberta-skills-mcps.md` (BLOCO-DESC, CT-006) — o procedimento de descoberta nos escopos PROJETO e GLOBAL com o formato obrigatório de inventário.

**Momento e destino do resultado:**
1. A descoberta e o carregamento DEVEM ser concluídos ANTES do PASSO 4, para que as skills influenciem tanto as perguntas quanto o conteúdo gerado.
2. Selecionar do inventário os itens pertinentes ao conteúdo em elaboração.
3. Se nenhum for pertinente ou o inventário estiver vazio: emitir `Nenhuma skill ou MCP aplicável a esta especificação técnica. Justificativa: [motivo]` e preencher a seção 9 com a variante de ausência.
4. Carregar INTEGRALMENTE cada skill selecionada e verificar a disponibilidade de cada MCP.
5. Se um item selecionado estiver indisponível: emitir `Skill/MCP [nome] não está disponível neste ambiente. A elaboração prosseguirá sem ele.`, registrar `Situacao = INDISPONIVEL` e prosseguir.
6. No fim do PASSO 6, preencher a seção 9 (`## 9. Skills e MCPs Utilizados [Obrigatorio]`) com uma linha por item carregado ou indisponível.

**Validação bloqueante:** elaborar a Tech Spec sem carregar os itens pertinentes e disponíveis é execução inválida.

**Nota de sincronização:** o arquivo `references/descoberta-skills-mcps.md` é compartilhado, byte a byte, com a skill `gerar-tasks` (BLOCO-DESC, CT-006). Qualquer alteração neste arquivo DEVE ser replicada no equivalente da skill irmã.

### PASSO 4: Clarificação (Entrevista Técnica)

Resolver lacunas via entrevista estruturada. Só pergunte o que a exploração (Passos 1-2) e a proposta não resolveram.

**Priorizar por impacto:**
- **ALTO (bloqueia):** decisões arquiteturais (sync × async), escolha de lib/framework, estrutura de dados crítica.
- **MÉDIO (atrasa):** detalhes de validação, tratamento de erro específico, config não-crítica.
- **BAIXO (posterior):** nomes de variáveis, copy de mensagens, layout de log.

**Regras de ouro:**
1. Foco em decisões técnicas (funcionalidade já veio no PRD).
2. Ao propor novidade, explique por que as existentes não servem.
3. Ofereça 2-3 opções com trade-offs.
4. Máx. 8 perguntas por rodada, do maior impacto ao menor.
5. Aguarde a resposta antes de prosseguir; repita até zero lacunas ALTO/MÉDIO.

**Anatomia de uma pergunta efetiva:** contexto (o que o PRD pede + o que a análise achou) → pergunta com opções rotuladas → impacto da decisão.

**Bom:** "Análise detectou RabbitMQ em docker-compose.yml (já configurado). RF-010 requer processamento assíncrono. Devo: A) usar RabbitMQ existente (recomendado), B) introduzir SQS (novo, aumenta custo), C) processamento síncrono (mais simples)?"

**Ruim:** "Qual biblioteca de fila usar?" (ignora o que já existe; sem contexto nem trade-offs.)

**Contratos SOLICITADOS (4.4):** para cada contrato marcado SOLICITADO no Passo 2.5, peça o contrato da integração — não importa se é terceiro ou interno. Modelo: fronteira + contexto (o que o PRD pede, o que não foi achado) + perguntas (integração já existe? onde? / é nova? qual API, versão, operações? / webhooks? / auth?). Ofereça propor um contrato padrão via Context7 se o usuário não souber.

Classifique cada resposta: usuário forneceu schema → DESCOBERTO/SOLICITADO (confirmado); pediu para propor → Context7 + PROPOSTO; disse que não precisa → remover da lista.

### PASSO 5: Gate de Qualidade (Validação Canônica)

Este é o **Gate de Qualidade único** da skill. Os Passos 3 e 6 referenciam este gate — ele não é repetido em outro lugar. Leia e execute `references/gate-qualidade.md` antes de gerar e de novo após preencher o template.

### PASSO 6: Geração

1. Preencher o template efetivo (Seção 2), seção por seção, com as decisões consolidadas.
2. **Saída limpa (obrigatório):** os comentários `<!-- ... -->` do template são só para autoria e NÃO devem aparecer no `techspec.md` final. Remova-os ao gerar o artefato (exceção: o comentário de metadata de status).
3. **Validar contra o Gate de Qualidade do Passo 5.** Se algo falhar, corrigir a seção e reexecutar o gate.
4. Salvar em `./specs/features/[nome-da-funcionalidade]/techspec.md`. Status inicial `DRAFT` (ou `IN_PROGRESS` se houve clarificação).

## 4. Validação Determinística Pós-Geração (BLOQUEANTE)

Após salvar o `techspec.md`, execute o validador da skill, sempre via `node`:

```
node scripts/validar-techspec.mjs specs/features/[nome-da-funcionalidade]/techspec.md
```

O validador confere deterministicamente: zero placeholders residuais, seções obrigatórias 1 a 9 presentes, zero comentários de autoria (exceto a metadata de status), origem preenchida (DESCOBERTO/SOLICITADO/PROPOSTO) em toda linha da Tabela Resumo de Contratos e em todo campo `Como Obtido`, e seção 9 preenchida (itens ou variante de ausência).

- **Exit 0** (OK): artefato conforme; prossiga para a Seção 5.
- **Exit 1**: corrija CADA violação listada (com número de linha) e reexecute o validador. Repita o loop validar -> corrigir -> revalidar até obter exit 0. Somente então marque o arquivo como pronto.

## 5. Regras para Atualização de Status

Fluxo: `DRAFT → IN_PROGRESS → APPROVED`. `DRAFT` ao iniciar o Passo 1; `IN_PROGRESS` na primeira pergunta (Passo 4); `APPROVED` só após geração completa com o Gate de Qualidade sem problemas ALTO/MÉDIO. **NUNCA** marque `APPROVED` sem validação completa.

## 6. Orçamento de Contexto (meta por fase)

- **Descoberta (Passos 0-2):** foco em config e amostragem dirigida; evite ler árvores inteiras — cada item da stack exige apenas a evidência `arquivo:linha` que o comprova.
- **Clarificação (Passo 4):** perguntas apenas para lacunas ALTO/MÉDIO remanescentes.
- **Geração (Passos 5-6):** template efetivo + Tabela de Contratos + Tabela de Invariantes como fontes principais.

Regressão de custo em qualquer fase é sinal de leitura não dirigida: reduza o escopo de leitura ao exigido pelo passo.

<critical>
Antes de gerar o artefato, releia o bloco `<critical>` do topo. Reforço: precedência EXPLORAR -> PROPOR -> PERGUNTAR · zero suposições silenciosas (todo não-extrído é `PROPOSTO` com justificativa) · varredura das 8 fronteiras com origem em todo contrato · skills/MCPs descobertos e carregados antes do Passo 4 · seção 9 obrigatória (itens ou ausência declarada) · Gate de Qualidade sem problemas ALTO/MÉDIO · validador `scripts/validar-techspec.mjs` com exit 0.
</critical>
