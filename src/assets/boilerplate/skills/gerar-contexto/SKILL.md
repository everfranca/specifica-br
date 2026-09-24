---
name: gerar-contexto
description: Analisa um repositório existente (brownfield) e infere a visão de produto e a arquitetura técnica com níveis de confiança por evidência, gerando specs/core/architecture.md e specs/core/product_vision.md com validação iterativa e o mínimo de perguntas. Use esta skill SEMPRE que o usuário pedir "/gerar-contexto", "analisar projeto existente", "gerar contexto", "documentar código legado", "inferir arquitetura de projeto existente", "reverse engineer da visão de produto" ou apontar um repositório já existente que precisa dos artefatos fundacionais em specs/core/, mesmo sem mencionar os nomes dos arquivos.
metadata:
  version: 0.2.0
---

# Skill: gerar-contexto

<critical>

- **INFERÊNCIA NÃO ESPECULAÇÃO:** baseie todas as conclusões em evidências no código, não em suposições.
- **NÍVEIS DE CONFIANÇA OBRIGATÓRIOS:** cada inferência deve ter % de confiança justificado.
- **APROVAÇÃO ITERATIVA:** gerar architecture.md primeiro, validar, depois product_vision.md.
- **MÁXIMO 2 PERGUNTAS POR CATEGORIA:** apenas para itens com confiança < 70%.
- **ZERO CÓDIGO GERADO:** esta skill cria apenas especificações.
- **NÃO EXPOR SEGREDOS:** ao ler `.env`, registre apenas nomes de variáveis, não valores.

</critical>

## 1. Papel

Atue como **Engenheiro de Software Sênior e Arquiteto de Software**.

**Sua responsabilidade é:**
- Na análise técnica: investigar o código existente para identificar padrões, stack e invariantes.
- Na inferência de negócio: traduzir decisões técnicas em inferências de domínio de negócio.
- **CRÍTICO:** atribuir níveis de confiança a cada inferência e marcar itens incertos para validação.

## 2. Recursos e Precedência de Templates (BLOQUEANTE)

- **Template Arquitetura:** se `specs/templates/architecture-template.md` existir no projeto, ele PREVALECE; caso contrário, use `{{SKILL_DIR}}/assets/architecture-template.md` desta skill.
- **Template Visão de Produto:** se `specs/templates/product_vision-template.md` existir no projeto, ele PREVALECE; caso contrário, use `{{SKILL_DIR}}/assets/product_vision-template.md` desta skill.
- **Destino Arquitetura:** `./specs/core/architecture.md`
- **Destino Visão:** `./specs/core/product_vision.md`
- **Context7:** use para documentação de frameworks quando necessário.

Antes de gerar cada artefato, você DEVE ler o template efetivo (o do projeto ou o da skill). Gerar sem ler o template invalida a execução.

### Resolução do diretório da skill

Os caminhos desta skill apontam para onde ela foi instalada. Se algum caminho de `assets/` ou `scripts/` falhar, resolva o diretório da skill nesta ordem antes de desistir:

1. Diretório anunciado pelo carregador de skills da sessão (nota de base directory).
2. Localização do `SKILL.md` desta skill por busca nos diretórios de skills do projeto e do usuário (padrão típico: `**/skills/<nome-da-skill>/SKILL.md`).

Localizado o diretório, use-o como base para todos os templates (`assets/`) e validadores (`scripts/`). Sem localizar a skill, informe o usuário e não prossiga improvisando.

**Nota de sincronização:** os dois templates em `assets/` são compartilhados, byte a byte, com a skill `gerar-visao`. Qualquer alteração neles DEVE ser replicada nos equivalentes da skill irmã.

## 3. Protocolo de Execução (7 Passos Obrigatórios)

Fluxo linear. NÃO pule passos. Cada referência é carregada sob demanda, apenas no passo que a exige.

### PASSO 1: Verificação de Diretório e Arquivos Existentes

1. Se o diretório `specs/core/` não existir, criá-lo.
2. Se `specs/core/architecture.md` existir: perguntar "Arquivo specs/core/architecture.md já existe. Deseja sobrescrever? (SIM/NÃO)". Resposta NÃO -> encerrar execução; SIM -> continuar.
3. Se `specs/core/product_vision.md` existir: mesma pergunta e mesmo comportamento.

Checkpoint: diretório existe ou foi criado; confirmação obtida para sobrescrever arquivos existentes (se aplicável).

### PASSO 2: Leitura Proativa da Estrutura do Repositório

Leia `references/varredura-repositorio.md` e execute a varredura dirigida: análise de stack (arquivos de config por ecossistema), catálogo de integrações externas (APIs de terceiros, webhooks, rate limiting, auth externa), maturidade de testes (framework, tipos, coverage, fixtures) e estrutura de diretórios/padrões de código. Outputs internos: Tabela de Stack, Catálogo de Integrações, Matriz de Maturidade de Testes, Mapa de Estrutura.

Ao ler `.env` e arquivos de configuração: registre APENAS nomes de variáveis e serviços, nunca valores.

### PASSO 3: Identificação de Stack com Níveis de Confiança

Leia a seção 1 de `references/inferencia-dominio.md` (Sistema de Níveis de Confiança) e atribua a cada tecnologia detectada: ALTA (90-100%, evidência explícita), MÉDIA (60-89%, evidência indireta) ou BAIXA (< 60%, inferência por convenções), sempre com justificativa. Todo item com confiança < 70% DEVE ser marcado **[REVISAR]** — será priorizado no Passo 6.

### PASSO 4: Inferência de Padrões Arquiteturais e Domínio

Leia a seção 2 de `references/inferencia-dominio.md` e identifique: paradigma arquitetural (Clean/Hexagonal/DDD/MVC/Microservices, com indicadores e violações), elementos de DDD (bounded contexts, aggregates, value objects, domain events, repositories, services) e o mapa completo de domínio, cada um com nível de confiança e itens [REVISAR].

### PASSO 5: Geração Iterativa — architecture.md

1. Preencher o template efetivo com os fatos detectados: Paradigma Arquitetural (Passo 4), Stack Tecnológico (Passo 3), Padrões e Convenções + Estrutura de Diretórios (Passo 2), Contratos e Interfaces (de controllers/endpoints), Pipeline de CI/CD (se detectado) e, por NOME de seção do template: Integrações Externas (Passo 2), Maturidade de Testes (Passo 2) e Domínio Inferido (Passo 4).
2. Marcar cada inferência com confiança < 70% com **[REVISAR]** + justificativa da baixa confiança.
3. Metadados: Status `DRAFT`, data atual, Nível de Profundidade detalhado automaticamente.
4. Apresentar resumo executivo focado nos itens críticos (stack com confianças, paradigma com violações, integrações, maturidade de testes, domínio inferido) e a lista numerada de itens [REVISAR], com as opções:

```
QUAL SUA DECISÃO?

A) APROVAR -> confirmo que a arquitetura inferida está correta; prosseguir para gerar product_vision.md
B) REVISAR -> abrir o arquivo e ajustar manualmente; depois voltarei para confirmar
C) REGER [REVISAR] itens específicos -> corrigir inferências com baixa confiança (máx 3)
D) CANCELAR -> encerrar sem salvar alterações (arquivo permanece DRAFT)
```

5. Processar: APROVAR -> status `APPROVED`, seguir para o Passo 6 (se houver [REVISAR]) ou Passo 7; REVISAR -> aguardar edição e reapresentar; REGER -> re-analisar os itens apontados, recalcular confianças e reapresentar; CANCELAR -> informar que o arquivo ficou salvo como DRAFT e encerrar.

### PASSO 6: Validação e Clarificação (Apenas itens com baixa confiança)

**Só execute se houver itens [REVISAR] do Passo 5. Se todos tiverem confiança >= 70%, PULE para o Passo 7.**

Leia a seção 3 de `references/inferencia-dominio.md` (Clarificação de itens com baixa confiança): filtre itens < 70%, agrupe por categoria (DOMÍNIO, ARQUITETURA, STACK), priorize por impacto, monte no máximo 2 perguntas por categoria (total máximo 6) usando o modelo de pergunta com contexto-evidência-análise-opções, processe as respostas (confiança sobe para 90-100% quando o usuário confirma) e gere novamente o `architecture.md` com status `APPROVED`, sem tags [REVISAR].

### PASSO 7: Geração Final — product_vision.md

1. Ler o `architecture.md` aprovado como fonte de verdade e aplicar o mapeamento técnico -> negócio da seção 4 de `references/inferencia-dominio.md`: bounded contexts -> subdomínios, aggregates -> entidades, controllers/actions -> casos de uso, webhooks/events -> eventos críticos, rate limiting -> escala, JWT/OAuth -> autenticação corporativa, integrações -> proposta de valor.
2. Inferir cada seção do template de visão: Declaração do Problema (de webhooks/events/errors), Personas (de aggregates/controllers), Proposta de Valor (de integrações/infra), Métricas (de monitoring/logging), Escopo IN/OUT (de bounded contexts), Jornada do Usuário (de integration tests), Riscos (de baixa cobertura e debt técnico).
3. Preencher a seção 10 "Inferências do Código Legado" com o mapa inferência -> fonte técnica -> confiança (é a ponte controlada entre os dois mundos; fora dela, zero técnica no documento).
4. Status `DRAFT`; salvar em `./specs/core/product_vision.md`.
5. Apresentar resumo final: artefatos gerados (arquitetura APPROVED, visão DRAFT), estatísticas das inferências (bounded contexts, entidades, casos de uso, confiança média por domínio) e próximos passos (revisar product_vision.md; `/gerar-prd`; `/gerar-techspec`).

## 4. Validação Determinística Pós-Geração (BLOQUEANTE)

Após salvar ambos os arquivos (e após cada regeneração), execute o validador da skill, sempre via `node`:

```
node {{SKILL_DIR}}/scripts/validar-contexto.mjs specs/core/architecture.md specs/core/product_vision.md
```

O validador confere deterministicamente: zero placeholders residuais, zero comentários de autoria, zero tags [REVISAR] remanescentes no architecture.md, seções obrigatórias (Paradigma e Stack; Integrações Externas, Maturidade de Testes e Domínio Inferido por nome; visão 1 a 9 + seção 10 de Inferências), e zero contaminação cruzada (termos técnicos na visão fora da seção 10; termos de negócio na arquitetura — listas configuráveis no script).

- **Exit 0** (OK): artefatos conformes.
- **Exit 1**: corrija CADA violação listada (com número de linha) e reexecute o validador. Repita o loop validar -> corrigir -> revalidar até obter exit 0. Somente então considere a execução concluída.

## 5. Orçamento de Contexto (meta por fase)

- **Varredura (Passos 2-3):** leitura dirigida por dimensão — configs e amostragem de código que fundamentam cada evidência; evite varrer árvores inteiras. É a fase mais custosa: cada item detectado exige apenas a evidência que o comprova.
- **Clarificação (Passo 6):** no máximo 6 perguntas, apenas itens < 70% de confiança com impacto ALTO/MÉDIO.
- **Geração (Passos 5 e 7):** template efetivo + resultados consolidados da varredura como fontes principais; `references/inferencia-dominio.md` carregada por seção, no passo que a exige.

Regressão de custo em qualquer fase é sinal de varredura não dirigida: reduza o escopo de leitura ao exigido pelo passo.

<critical>
Antes de finalizar, releia o bloco `<critical>` do topo. Reforço: toda inferência com % de confiança justificado por evidência · itens < 70% marcados [REVISAR] e questionados (máx 2 por categoria) · architecture.md primeiro, product_vision.md depois · zero tags [REVISAR] no aprovado · segredos nunca transcritos (apenas nomes) · validador `scripts/validar-contexto.mjs` com exit 0.
</critical>
