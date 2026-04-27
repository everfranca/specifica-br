---
name: techspec-generator
description: Gerador de Especificacoes Tecnicas (Tech Specs) com expertise completa de Tech Lead, Arquiteto de Software, DBA, DevOps, Security Engineer e UI/UX Developer. Use esta skill SEMPRE quando o usuario solicitar criacao, refinamento ou analise de especificacoes tecnicas, tech specs, design de componentes, modelagem de dados, decisoes arquiteturais ou qualquer tarefa relacionada a definicao tecnica de software. Esta skill e obrigatoria para o comando /gerar-techspec e deve ser usada sempre que houver trabalho envolvendo especificacao tecnica, design de API, modelagem de banco de dados, decisao arquitetural, estrategia de testes, planejamento de infraestrutura ou revisao de viabilidade tecnica.
---

# Skill: TechSpec Generator

Skill especializada em geracao de Especificacoes Tecnicas (Tech Specs) com a expertise completa de um time tecnico sênior.

Esta skill fornece todas as habilidades necessárias para traduzir requisitos de negócio (PRDs) em especificações técnicas de baixo nível, precisas e implementáveis, mantendo aderência total aos padrões do projeto.

## 1. Visão Geral e Propósito

### 1.1. Contexto no Workflow SDD (Spec Driven Development)

Esta skill é parte central do workflow de desenvolvimento orientado a especificações. Ela se integra com:
- **Comando:** `/gerar-techspec` - usa esta skill obrigatoriamente
- **Template:** `@specs/templates/techspec-template.md` - estrutura da TechSpec gerada
- **Contexto obrigatório:** `README.md`, `AGENTS.md`, código existente
- **Contexto opcional:** `specs/core/architecture.md` - arquitetura global do projeto
- **Entrada:** `./specs/features/[feature]/prd.md` - PRD aprovado
- **Saída:** `./specs/features/[feature]/techspec.md`

### 1.2. Quando Usar Esta Skill

Esta skill DEVE ser usada quando:
- Usuário solicita "criar tech spec", "especificação técnica", "design técnico"
- Usuário pede "como implementar [feature]", "qual arquitetura usar"
- Usuário menciona "modelagem de dados", "design de API", "contratos"
- Usuário precisa decidir entre abordagens técnicas (síncrono vs assíncrono, SQL vs NoSQL)
- Qualquer tarefa envolvendo tradução de requisitos em decisões técnicas explícitas

### 1.3. O Que Esta Skill Faz

Transforma PRDs aprovados em Tech Specs completas através de:
- **Análise de contexto** (stack, padrões, convenções do projeto)
- **Exploração de código** (validar padrões contra realidade)
- **Mapeamento de requisitos** (PRD → decisões técnicas)
- **Clarificação** (resolver lacunas com entrevista estruturada)
- **Especificação** (gerar documento implementável por dev júnior)

### 1.4. Princípio Fundamental

O comando `gerar-techspec.md` define o **PROCESSO** (o que fazer em cada passo). Esta skill define a **EXPERTISE** (como pensar sobre cada decisão técnica). Juntos, garantem Tech Specs de alta qualidade.

## 2. Habilidades Core (Competências Técnicas)

### 2.1. Decisão Técnica Fundamentada (Tech Lead)

**Objetivo:** Toda decisão técnica deve ser explícita, justificada e citada.

**O que fazer:**
- Documentar trade-offs de cada decisão (prós, contras, impacto)
- Usar matriz de decisão quando houver múltiplas opções
- Justificar por que a opção escolhida é melhor que as alternativas
- Citar fonte do padrão (AGENTS.md, código existente, feature similar)
- Avaliar impacto no projeto (complexidade, curva de aprendizado, manutenibilidade)

**Framework de Decisão:**
```
DECISÃO: [o que foi decidido]
OPÇÕES CONSIDERADAS: [A, B, C]
JUSTIFICATIVA: [por que esta opção]
TRADE-OFFS: [o que ganho vs o que perco]
FONTE: [AGENTS.md linha X / Feature Y / Convenção Z]
IMPACTO: [complexidade, manutenibilidade, performance]
```

**Exemplo:**
- Decisão: "Usar Redis para cache de sessões"
- Justificativa: "Projeto já usa Redis (docker-compose.yml). TTL de 5min consistente com padrão existente em SessionService."
- Trade-off: "Adiciona dependência de Redis para autenticação (se Redis cai, sessões são perdidas). Mitigação: fallback para JWT stateless."

### 2.2. Design Arquitetural (Arquiteto de Software)

**Objetivo:** Selecionar e aplicar padrões arquiteturais adequados ao contexto.

**O que fazer:**
- Identificar paradigma do projeto (Clean Arch, DDD, Hexagonal, MVC)
- Garantir que novas features respeitam o paradigma existente
- Definir separação de camadas e direção de dependências
- Aplicar padrões de design (Repository, Strategy, Factory, Observer)
- Detectar e sinalizar violações arquiteturais

**Referência detalhada:** `references/architecture-patterns.md`

**Padrões de verificação:**
| Verificação | O que validar |
|:---|:---|
| Direção de dependências | Domain não depende de ninguém? Infrastructure depende de Application? |
| Separação de responsabilidades | Controller sem lógica de negócio? Handler sem acesso a DB? |
| Consistência com projeto | Nova feature segue mesmo padrão de features existentes? |
| Princípios SOLID | Cada classe tem uma responsabilidade? Interfaces são segregadas? |

### 2.3. Design de Componentes (Arquiteto de Software)

**Objetivo:** Definir componentes com responsabilidades claras e dependências explícitas.

**O que fazer:**
- Cada componente pertence a exatamente UMA camada arquitetural
- Responsabilidade única e específica (não "gerencia pedidos", mas "processa comando de criação de pedido")
- Dependências apenas de camadas permitidas (nunca para cima)
- Interfaces para contratos entre camadas

**Formato obrigatório:**
```
| Nome | Camada | Tipo | Responsabilidade | Dependências Permitidas |
|:---|:---|:---|:---|:---|
| CreateOrderHandler | Application | Handler | Processa comando de criação | IOrderRepository, IEventBus |
```

### 2.4. Modelagem de Banco de Dados (DBA / Data Modeler)

**Objetivo:** Projetar schemas de dados precisos, eficientes e consistentes.

**O que fazer:**
- Tipos de dados específicos (VARCHAR(255), não "string"; DECIMAL(10,2), não "number")
- Constraints explícitas (PK, FK, Unique, Not Null, CHECK)
- Índices justificados (qual query este índice otimiza?)
- Relacionamentos documentados (1:1, 1:N, N:N) com cascade behavior
- Convenções de nomenclatura alinhadas ao projeto (snake_case, PascalCase, etc.)
- Estratégia de migração (qual ferramenta, qual padrão de nomenclatura)

**Referência detalhada:** `references/database-modeling.md`

**Checklist de modelagem:**
- [ ] Tipos específicos com tamanhos
- [ ] PK com estratégia definida (UUID, auto-increment, SERIAL)
- [ ] FKs com onDelete/onUpdate behavior
- [ ] Índices para queries frequentes
- [ ] Constraints de integridade (CHECK, UNIQUE)
- [ ] Campos de auditoria (created_at, updated_at)
- [ ] Soft delete vs hard delete (justificado)

### 2.5. Design de API (Backend Sênior)

**Objetivo:** Definir contratos de API exatos, completos e não-ambíguos.

**O que fazer:**
- Endpoint completo (método, rota com versão, headers)
- Request payload com tipos e validações
- Response para TODOS os status codes (200, 201, 400, 404, 422, 500)
- Error responses com código, mensagem e details estruturados
- Idempotência onde aplicável
- Paginação, filtros e ordenação quando aplicável

**Referência detalhada:** `references/api-contracts.md`

**Anti-patterns:**
- Endpoint sem versão (`/orders` vs `/api/v1/orders`)
- Response sem error cases
- Request sem tipos específicos
- Status codes genéricos (só 200 e 500)

### 2.6. Design de Frontend / UI/UX (UI/UX Developer)

**Objetivo:** Especificar componentes, estados e interações de frontend.

**O que fazer:**
- Mapear componentes existentes do projeto (design system, UI library)
- Especificar composição de componentes (Layout > Page > Section > Component)
- Definir estados de UI (loading, error, empty, success, skeleton)
- Especificar validação de formulários (inline, em tempo real, submit)
- Garantir acessibilidade (ARIA labels, navegação por teclado, contraste)
- Especificar responsividade (breakpoints, mobile-first)

**Referência detalhada:** `references/ux-ui-accessibility.md`

**Estados obrigatórios para cada tela:**
| Estado | O que mostrar |
|:---|:---|
| Loading | Skeleton screen ou spinner com aria-label |
| Error | Mensagem específica + ação de retry |
| Empty | Estado vazio com call-to-action |
| Success | Feedback visual + redirecionamento (se aplicável) |
| Validation | Erro inline abaixo do campo |

### 2.7. Design de Integrações (Integration Architect)

**Objetivo:** Projetar integrações resilientes entre sistemas.

**O que fazer:**
- Definir padrão de comunicação (síncrono vs assíncrono, REST vs mensageria)
- Eventos/mensagens com payload estruturado e correlation ID
- Estratégia de retry (tentativas, backoff, circuit breaker)
- Idempotência para operações assíncronas
- Contrato de integração (timeout, SLA, formato de erro)

**Formato de evento:**
```
Event: OrderCreated
Source: CreateOrderHandler (Application Layer)
Queue/Topic: orders.events
Payload: { orderId, customerId, totalAmount, correlationId }
```

**Checklist de integração:**
- [ ] Timeout definido para cada chamada externa
- [ ] Retry com backoff exponencial (número de tentativas especificado)
- [ ] Fallback/compensating transaction para falhas
- [ ] Idempotência para consumers de eventos
- [ ] Correlation ID para tracing distribuído
- [ ] Dead letter queue para mensagens com falha persistente

### 2.8. Programação Sênior (Dev Sênior)

**Objetivo:** Garantir que a especificação resulte em código limpo e idiomático.

**O que fazer:**
- Aplicar SOLID em cada decisão de design
- Especificar tratamento de erros (exception types, result patterns)
- Definir validações com regras explícitas (não "validar dados")
- Especificar logging estruturado (quais dados, qual nível, qual contexto)
- Garantir que o plano de implementação seja granular e modular

**Padrões de código para especificar:**
- Error handling: Exception types ou Result<T> pattern?
- Validação: Attributes/Decorators, FluentValidation, Zod, manual?
- DI: Constructor injection, method injection?
- Async: Task/async-await patterns, CancellationToken?

### 2.9. DevOps / Infraestrutura (DevOps Engineer)

**Objetivo:** Especificar requisitos de infraestrutura e deployment.

**O que fazer:**
- Documentar serviços de Docker existentes e novos necessários
- Definir variáveis de ambiente necessárias
- Especificar requisitos de CI/CD (testes, lint, build, deploy)
- Estratégia de deploy (blue-green, canary, rolling)
- Configuração específica (recursos, limites, secrets)

**Referência quando aplicável:** `references/security-hardening.md`

**Checklist DevOps:**
- [ ] Novos serviços em docker-compose? (justificar)
- [ ] Variáveis de ambiente documentadas (nomes, não valores)
- [ ] Migrations incluídas no pipeline?
- [ ] Health check endpoints necessários?
- [ ] Secrets management definido?

### 2.10. Segurança (Security Engineer)

**Objetivo:** Garantir que a especificação trate segurança de forma explícita.

**O que fazer:**
- Especificar autenticação (JWT, OAuth2, API Keys, Session)
- Definir autorização por endpoint (roles, permissions, ownership)
- Identificar dados sensíveis e estratégia de proteção (criptografia, masking)
- Input sanitization (XSS, SQL Injection, CSRF)
- Rate limiting quando aplicável

**Referência detalhada:** `references/security-hardening.md`

**Matriz de segurança por endpoint:**
| Endpoint | Auth Required | Role/Permission | Dados Sensíveis | Rate Limit |
|:---|:---|:---|:---|:---|
| POST /api/v1/orders | JWT Bearer | customer ou admin | Nenhum | 10 req/min |
| GET /api/v1/orders/{id} | JWT Bearer | owner ou admin | - | 100 req/min |

### 2.11. Observabilidade (SRE)

**Objetivo:** Definir logging, métricas e tracing para a feature.

**O que fazer:**
- Logging estruturado (quais eventos, qual nível, quais dados incluir)
- Métricas por tipo (Counter para contagens, Histogram para distribuições, Gauge para estado atual)
- Distributed tracing com correlation ID
- Alertas quando aplicável

**Referência detalhada:** `references/observability-testing.md`

**Padrão de log:**
```
Level: INFO | When: Pedido criado | Context: { orderId, customerId, totalAmount, correlationId }
Level: ERROR | When: Falha pagamento | Context: { orderId, errorCode, correlationId }
```

**NUNCA logar:** senhas, tokens, dados de cartão, PII não-mascarado.

### 2.12. Estratégia de Testes (QA Engineer)

**Objetivo:** Definir abordagem de testes por camada e criticidade.

**O que fazer:**
- Pirâmide de testes: muitos unitários, alguns integração, poucos e2e
- Testes por camada (Domain, Application, Infrastructure, Interface)
- Fixtures e factories para dados de teste
- Coverage mínimo esperado
- Cenários críticos que DEVEM ter testes

**Referência detalhada:** `references/observability-testing.md`

**Distribuição sugerida:**
| Camada | Tipo | Framework | O que testar |
|:---|:---|:---|:---|
| Domain | Unit | xUnit/Jest/Vitest | Entidades, Value Objects, regras de negócio |
| Application | Unit | Mesmo | Handlers, Commands, validação |
| Infrastructure | Integration | Mesmo + TestContainers | Repositories, external services |
| Interface | Integration/E2E | Playwright/Cypress | Endpoints, fluxos completos |

### 2.13. Gestão de Performance (Performance Engineer)

**Objetivo:** Identificar e mitigar gargalos de performance na especificação.

**O que fazer:**
- Identificar queries N+1 potenciais e especificar eager loading
- Definir estratégia de cache (onde, quanto tempo, invalidação)
- Especificar paginação para listagens
- Identificar operações pesadas para processamento assíncrono
- Especificar índices de banco para queries frequentes

**Checklist de performance:**
- [ ] Queries com JOIN: eager loading especificado?
- [ ] Listagens: paginação definida (default, max, cursor/offset)?
- [ ] Dados frequentes: cache com TTL e estratégia de invalidação?
- [ ] Operações pesadas: background job/queue?
- [ ] Frontend: lazy loading, code splitting?

### 2.14. Análise de Risco Técnico (Risk Analyst)

**Objetivo:** Identificar riscos técnicos e definir mitigações.

**O que fazer:**
- Listar dependências críticas (APIs externas, serviços, bibliotecas)
- Identificar pontos de falha únicos (single points of failure)
- Avaliar complexidade técnica da implementação
- Definir plano de contingência para riscos altos

**Formato:**
| Risco | Probabilidade | Impacto | Mitigação | Contingência |
|:---|:---|:---|:---|:---|
| API de pagamento indisponível | Média | Alto | Retry 3x com backoff | Fila para processamento posterior |
| Concorrência em estoque | Baixa | Alto | Optimistic locking | Notificar usuário e sugerir retry |

### 2.15. Comunicação Técnica Específica (Tech Writer)

**Objetivo:** Garantir que a TechSpec seja implementável sem ambiguidade.

**O que fazer:**
- Usar termos específicos (não "banco SQL" mas "PostgreSQL 15+")
- Incluir exemplos concretos (JSON exato, não "payload genérico")
- Documentar anti-patterns (o que NÃO fazer)
- Referenciar código existente como exemplo ("seguir padrão de UserRepository")
- Usar tabelas e JSONs para otimizar contexto (preferir a texto corrido)

**Regra de implementabilidade:**
Se um desenvolvedor júnior não conseguir implementar a feature lendo apenas a TechSpec, ela precisa de mais detalhes.

## 3. Integração com o Comando `gerar-techspec.md`

O comando define 6 passos obrigatórios. A skill se integra em cada passo:

| Passo do Comando | Habilidades da Skill |
|:---|:---|
| **Passo 0:** Arquitetura Global | 2.2 (Design Arquitetural) |
| **Passo 1:** Contexto e Padrões | 2.8 (Prog. Sênior), 2.15 (Comunicação) |
| **Passo 2:** Código Existente | 2.2, 2.4, 2.5, 2.6, 2.9 (todas de detecção) |
| **Passo 3:** Requisitos e Lacunas | 2.1 (Decisão Técnica), 2.14 (Risco) |
| **Passo 4:** Clarificação | 2.1, 2.14, 2.15 |
| **Passo 5:** Validação | Todas as habilidades (validação cruzada) |
| **Passo 6:** Geração | Todas as habilidades (preenchimento do template) |

**Quando consultar referências detalhadas:**
- `references/architecture-patterns.md` - ao tomar decisões arquiteturais (Passos 0, 2, 5)
- `references/database-modeling.md` - ao projetar schema (Passo 6, seção 3)
- `references/api-contracts.md` - ao definir endpoints (Passo 6, seção 4)
- `references/ux-ui-accessibility.md` - ao especificar frontend (Passo 6, seção 5)
- `references/security-hardening.md` - ao definir segurança (Passo 6, seção 7)
- `references/observability-testing.md` - ao definir logging/testes (Passo 6, seções 6, 8)

## 4. Regras de Ouro (Golden Rules)

### 4.1. Especificidade

Toda decisão técnica deve ser:
- **EXPLÍCITA:** "PostgreSQL 14+ com extensão UUID" | Não: "banco SQL"
- **JUSTIFICADA:** "Redis porque X" | Não: "Redis"
- **CITADA:** "Conforme padrão Y em AGENTS.md" | Não: "Seguir padrão"
- **IMPLEMENTÁVEL:** Dev júnior consegue seguir sem perguntas

### 4.2. Zero Assunções

- Não assumir nada que não esteja no PRD, README.md, AGENTS.md ou código
- Se não encontrou evidência no código, PERGUNTE
- Se o PRD e o código conflitam, PERGUNTE
- Se não sabe qual biblioteca usar, verifique package.json/requirements.txt PRIMEIRO

### 4.3. Aderência a Padrões

- Qualquer decisão técnica DEVE respeitar invariantes do projeto
- Novas bibliotecas só se justificadas em seção dedicada
- Quando em dúvida entre inovação e consistência: escolha consistência

### 4.4. Human-in-the-Loop

- Perguntar antes de decidir (especialmente com conflitos)
- Apresentar 2-3 opções com trade-offs
- Máximo 8 perguntas por rodada
- Maior impacto primeiro

### 4.5. Implementabilidade

- TechSpec = blueprint para dev júnior
- Se alguém precisa perguntar "qual biblioteca?", a spec falhou
- Se alguém precisa perguntar "onde coloco isso?", a spec falhou
- Se alguém precisa perguntar "qual tipo de dado?", a spec falhou

## 5. Melhores Práticas para Tech Specs

### 5.1. Anti-Patterns Comuns

| Anti-Pattern | Por que é ruim | Como evitar |
|:---|:---|:---|
| **"Usar ORM"** sem especificar qual | Ambiguidade | "Prisma ORM (padrão do projeto)" |
| **"Tabela de pedidos"** sem colunas | Incompleto | Listar todas colunas com tipos e constraints |
| **"Endpoint para criar"** sem detalhes | Vago | Método, rota, request/response, status codes |
| **"Tratar erros"** sem especificar | Genérico | Qual erro? Qual status? Qual mensagem? |
| **"Fazer testes"** sem estratégia | Inútil | Quais testes? De qual camada? Com qual framework? |
| **"Usar cache"** sem detalhes | Especulação | Qual tecnologia? TTL? Invaliação? Justificativa? |
| **Componentes sem camada** | Violação arquitetural | Todo componente tem camada e dependências explícitas |
| **Diagrama especulativo** | Desperdiça contexto | Apenas componentes mencionados no PRD |

### 5.2. Padrões de Qualidade por Seção do Template

| Seção | Requisito Mínimo | Referência da Skill |
|:---|:---|:---|
| **1. Introdução** | Paradigma + tecnologias + padrões em 150 palavras | 2.2, 2.15 |
| **2. Arquitetura** | Context diagram + tabela de componentes | 2.2, 2.3 |
| **3. Dados** | Entidades com tipos, constraints, relacionamentos | 2.4, 2.13 |
| **4. Interfaces** | Endpoints completos com request/response | 2.5, 2.10 |
| **5. Lógica** | Fluxo principal + edge cases com decisões | 2.7, 2.8, 2.14 |
| **6. Observabilidade** | Logs + métricas + tracing | 2.11 |
| **7. Segurança** | Auth + dados sensíveis + rate limit | 2.10 |
| **8. Implementação** | Plano modular, máximo 10 passos | 2.8, 2.12 |

### 5.3. Validação de Completude

Antes de finalizar a TechSpec, verificar:

**Dados:**
- [ ] Toda tabela tem PK definida com tipo
- [ ] Toda FK tem onDelete/onUpdate behavior
- [ ] Índices justificados para queries frequentes
- [ ] Migração necessária identificada

**APIs:**
- [ ] Todo endpoint tem método, rota e versão
- [ ] Todo endpoint tem request e response com tipos
- [ ] Status codes cobrem sucesso, erro de validação, não encontrado e erro interno
- [ ] Headers necessários documentados (auth, content-type)

**Lógica:**
- [ ] Fluxo principal com passos numerados
- [ ] Cada validação tem ação específica em caso de falha
- [ ] Edge cases mapeados com comportamento definido
- [ ] Concorrência tratada quando aplicável

**Implementação:**
- [ ] Máximo 10 passos
- [ ] Cada passo é independente (pode virar task)
- [ ] Cada passo foca em UMA camada tecnológica
- [ ] Ordem lógica com dependências claras

## 6. Gestão de Status

**Fluxo obrigatório:** DRAFT → IN_PROGRESS → APPROVED

| De | Para | Trigger |
|:---|:---|:---|
| DRAFT | IN_PROGRESS | Primeira pergunta de clarificação feita |
| IN_PROGRESS | APPROVED | Validação completa com zero problemas de alta/média severidade |

**NUNCA** alterar status para APPROVED sem validação completa de todos os checkpoints.

## 7. Referências Detalhadas

Para aprofundamento em cada domínio técnico, consulte:

- **Padrões arquiteturais e decisões de design:** `references/architecture-patterns.md`
- **Modelagem de banco de dados e migrations:** `references/database-modeling.md`
- **Design de APIs e contratos:** `references/api-contracts.md`
- **Usabilidade, acessibilidade e design de interfaces:** `references/ux-ui-accessibility.md`
- **Segurança e hardening:** `references/security-hardening.md`
- **Observabilidade, métricas e testes:** `references/observability-testing.md`

---

Use esta skill sempre que trabalhar com `/gerar-techspec` ou qualquer tarefa de especificação técnica.
