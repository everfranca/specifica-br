# Inferência de Domínio e Sistema de Confiança

## Sumário

1. [Sistema de Níveis de Confiança (Passo 3)](#1-sistema-de-níveis-de-confiança-passo-3)
2. [Padrões Arquiteturais e Domínio (Passo 4)](#2-padrões-arquiteturais-e-domínio-passo-4)
3. [Clarificação de itens com baixa confiança (Passo 6)](#3-clarificação-de-itens-com-baixa-confiança-passo-6)
4. [Mapeamento Técnico -> Negócio (Passo 7)](#4-mapeamento-técnico--negócio-passo-7)

## 1. Sistema de Níveis de Confiança (Passo 3)

Para cada tecnologia detectada, atribuir nível de confiança baseado em evidências:

**ALTA CONFIANÇA (90-100%)** — evidência explícita no código:
- Imports diretos: `import express from 'express'`
- Arquivos de config: `.csproj` com `<TargetFramework>net8.0</TargetFramework>`
- Connection strings explícitas: `Host=localhost;Port=5432;Database=mydb`
- Migration files com schema claro
- package.json com versões exatas

**MÉDIA CONFIANÇA (60-89%)** — evidência indireta ou parcial:
- Padrões de nomenclatura sugerem uso (mas não confirmado)
- Arquivos de exemplo ou boilerplate
- Comentários mencionando tecnologia
- Estrutura de pastas típica (mas sem confirmação direta)
- Versão não especificada (ex: "PostgreSQL" sem versão)

**BAIXA CONFIANÇA (< 60%)** — inferência baseada em convenções:
- Apenas estrutura de pastas (pode ser coincidência)
- Dependências transitivas (não diretamente usadas)
- Ausência de evidências contraditórias
- Convenções de nomenclatura típicas para stack
- Arquivos de config sem valores concretos

### 1.1. Análise por camada

**BACKEND — o que detectar:**

| O quê | Onde |
|:---|:---|
| Linguagem e versão | `.csproj` (`<TargetFramework>`), `package.json` (`engines`), `go.mod` (module), `pyproject.toml` (`requires-python`) |
| Framework | ASP.NET Core (`Microsoft.AspNetCore.App`), Express, FastAPI (`fastapi`, `uvicorn`), Rails |
| ORM/Database | Entity Framework, Prisma (`@prisma/client`), SQLAlchemy, ActiveRecord |

Exemplo de saída com confiança:

| Tecnologia | Confiança | Justificativa |
|:---|:---:|:---|
| **.NET 8** | 100% | .csproj com `<TargetFramework>net8.0</TargetFramework>` |
| **PostgreSQL 15** | 75% | Connection string "Server=localhost;Port=5432" mas versão não especificada |
| **Entity Framework 8** | 95% | Microsoft.EntityFrameworkCore.SqlServer v8.0.0 no .csproj |
| **Redis Cache** | 35% | docker-compose tem redis mas código não usa ioredis/redis-client |

**FRONTEND — o que detectar:**

| O quê | Onde |
|:---|:---|
| Framework | React (`react`, `react-dom`), Vue (`vue`), Angular (`@angular/core`), Svelte (`svelte`) |
| Build Tool | Vite, Webpack, Turbopack |
| UI Library | shadcn-vue, shadcn-ui, @mui/material, @chakra-ui/react, primevue, vuetify |

Exemplo de saída:

| Tecnologia | Confiança | Justificativa |
|:---|:---:|:---|
| **Vue.js 3.4** | 98% | package.json: "vue": "^3.4.21" |
| **TypeScript** | 100% | tsconfig.json com "compilerOptions" |
| **TailwindCSS** | 92% | tailwind.config.js existe, classes @ usadas em .vue |
| **Pinia (State)** | 88% | stores/ folder com useXStore |

**INFRAESTRUTURA — o que detectar:**

| O quê | Onde |
|:---|:---|
| Docker | docker-compose.yml com serviços, Dockerfile na raiz |
| Cloud | AWS (`@aws-sdk/*`), Azure (`@azure/*`), GCP (`@google-cloud/*`) |
| CI/CD | GitHub Actions (`.github/workflows/*.yml`), GitLab CI (`.gitlab-ci.yml`) |

Exemplo de saída:

| Tecnologia | Confiança | Justificativa |
|:---|:---:|:---|
| **Docker** | 100% | docker-compose.yml existe |
| **PostgreSQL** | 95% | db: image: postgres:15-alpine |
| **GitHub Actions** | 100% | .github/workflows/ci.yml existe |

### 1.2. Marcação para validação

- Todos os itens com confiança < 70% DEVEM ser marcados com tag **[REVISAR]**.
- Estes itens serão priorizados no Passo 6 (Clarificação).

**Output Esperado:** tabela completa de Stack Tecnológico com confiança + lista de itens marcados [REVISAR] (confiança < 70%).

## 2. Padrões Arquiteturais e Domínio (Passo 4)

### 2.1. Detecção de Paradigma Arquitetural

**CHECKLIST DE ANÁLISE:**

```
[ ] CLEAN ARCHITECTURE / ONION ARCHITECTURE
   Indicadores:
   - Pastas: /src/Domain, /src/Application, /src/Infrastructure, /src/Interface
   - Dependências: Domain não depende de ninguém
   - Entities em /src/Domain/Entities ou /src/Domain/Models
   - Use Cases em /src/Application/Commands ou /src/Application/UseCases
   - Repositories como interfaces em /src/Domain/Interfaces
   - Implementações de infra em /src/Infrastructure/Persistence

[ ] HEXAGONAL ARCHITECTURE / PORTS AND ADAPTERS
   Indicadores:
   - Pastas: /ports, /adapters
   - Interfaces como ports: IPort, IGateway
   - Adapters: RepositoryAdapter, ExternalServiceAdapter
   - Domain core isolado

[ ] DOMAIN-DRIVEN DESIGN (DDD)
   Indicadores:
   - Bounded contexts: /src/Users, /src/Orders, /src/Shipping
   - Aggregates: User (root), Order (root com OrderItems)
   - Value Objects: Email, Money, Address
   - Domain Events: UserCreated, OrderPaid
   - Repositories: IUserRepository, IOrderRepository

[ ] MVC TRADITIONAL / LAYERED ARCHITECTURE
   Indicadores:
   - Controllers/Handlers em /controllers ou /api
   - Services em /services
   - Models/Entities em /models
   - Database access em services ou repositories

[ ] MICROSERVICES
   Indicadores:
   - Múltiplos entry points (server.ts, main.py separados)
   - API Gateway ou BFF
   - Comunicação via eventos/mensageria
   - Bancos separados por serviço
```

**EXEMPLO DE SAÍDA (mantenha internamente):**

```
PARADIGMA ARQUITETURAL DETECTADO
-----------------------------------------------------------

Paradigma Principal: Clean Architecture [Confiança: 65%]

Indicadores Favoráveis:
  - [OK] /src/Domain com Entities e ValueObjects
  - [OK] /src/Application com Commands e Queries
  - [OK] /src/Infrastructure com Repositories

Violacoes Detectadas (baixa confianca):
  - [WARNING] UsersController tem metodo CalculateDiscount()
     (logica de negocio em controller, viola Clean Arch)
  - [WARNING] OrdersController acessa DbContext diretamente
     (infraestrutura em UI layer)

Conclusão:
  Estrutura segue Clean Architecture mas há violacoes
  locais. Possivelmente codigo em evolucao ou time
  ainda adaptando ao padrao.
-----------------------------------------------------------
```

### 2.2. Inferência de Domínio (DDD Patterns)

**CHECKLIST DE ANÁLISE:**

```
[ ] BOUNDED CONTEXTS
   Indicadores:
   - Módulos funcionalmente isolados?
   - Pastas: /src/Users/, /src/Orders/, /src/Payments/
   - Verificar se há comunicação apenas via APIs/events
   - Cada context tem seu próprio modelo de domínio?

   Exemplo:
   [OK] /src/Users/{Domain,Application,Infrastructure} - bounded context
   [OK] /src/Orders/{Domain,Application,Infrastructure} - bounded context
   [WARNING]  /src/Payments/ - apenas controllers, sem domínio rico

[ ] AGGREGATES E ENTITIES
   Indicadores:
   - Aggregates raiz (User root, Order root)
   - Buscar invariants (métodos privados de validação)
   - Verificar consistência transacional
   - Collections dentro de aggregates (Order com OrderItems)

   Exemplo:
   [OK] User (Confiança: 90%) - Entidade com invariants (Email must be valid)
   [OK] Order (Confiança: 85%) - Root com OrderItems, invariants (total > 0)
   [WARNING]  Payment (Confiança: 50%) - Pouca lógica de domínio, anêmico

[ ] VALUE OBJECTS
   Indicadores:
   - Classes imutáveis sem ID próprio
   - record (C#), dataclass (Python), frozen dataclasses
   - Tipos: Email, Money, Address, DateRange, PhoneNumber

   Exemplo:
   [OK] Email (Confiança: 95%) - record C# imutável com validação
   [X] Money - NÃO ENCONTRADO (usa decimal simples)
   [WARNING]  Address (Confiança: 70%) - classe sem ID mas mutável (deveria ser imutável)

[ ] DOMAIN EVENTS
   Indicadores:
   - Eventos passados: UserCreated, OrderPaid
   - Verificar se há event handlers/dispatchers
   - Identificar event sourcing (se aplicável)

   Exemplo:
   [OK] UserCreated, OrderPaid (Confiança: 80%)
   [OK] Event dispatcher: MediatR (INotificationHandlers)

[ ] REPOSITORIES
   Indicadores:
   - Interfaces de persistência abstraindo detalhes de DB
   - Padrão: IUserRepository, IOrderRepository
   - Implementações em Infrastructure layer
   - Methods: Add, Update, Delete, GetById, Find

   Exemplo:
   [OK] IUserRepository, IOrderRepository (Confiança: 92%)
   [OK] Implementações com Dapper (Confiança: 95%)
   [WARNING]  IPaymentRepository (Confiança: 40%) - Interface existe mas não implementada

[ ] SERVICES (DOMAIN/APP)
   Indicadores:
   - Serviços de domínio (lógica complexa sem estado)
   - Application services (use cases/orchestrators)
   - Diferenciar de infrastructure services

   Exemplo:
   [OK] PaymentService (Confiança: 75%) - Orquestra fluxo de pagamento
   [OK] EmailService (Confiança: 60%) - Infra service, envia emails
```

**EXEMPLO DE SAÍDA COMPLETA (mantenha internamente):**

```
DOMÍNIO INFERIDO (DOMAIN-DRIVEN DESIGN)
-----------------------------------------------------------

Bounded Contexts:
  - [OK] Users (Confiança: 85%)
     - Estrutura: /src/Users/{Domain,Application,Infra}
     - Aggregates: User
     - Events: UserCreated, UserUpdated
  - [OK] Orders (Confiança: 72%)
     - Estrutura: /src/Orders mas com services com lógica
     - Aggregates: Order (root com OrderItems)
     - Events: OrderCreated, OrderPaid, OrderCancelled
  - [WARNING] Payments (Confiança: 40%) [REVISAR]
     - Apenas controllers, sem domínio rico
     - Possível bounded context externo (API wrapper)

Aggregates:
  - [OK] User (Confiança: 90%) - Entidade com invariants: Email unico, CPF valido
  - [OK] Order (Confiança: 85%) - Root com OrderItems (collection), invariants: Total > 0
  - [WARNING] Payment (Confiança: 50%) [REVISAR] - Pouca logica de dominio, anemico

Value Objects:
  - [OK] Email (Confiança: 95%) - record C# imutavel com validacao
  - [OK] CPF (Confianca: 88%) - record C# com validacao de digito
  - [X] Money - NAO ENCONTRADO (usa decimal simples)
  - [WARNING] Address (Confiança: 70%) [REVISAR] - classe sem ID mas mutavel

Domain Events:
  - [OK] UserCreated, UserUpdated (Confiança: 80%)
  - [OK] OrderCreated, OrderPaid, OrderCancelled (Confiança: 82%)
  - [X] Payment-related events - NAO ENCONTRADOS
  - [OK] Event dispatcher: MediatR (INotificationHandlers)

Repositories:
  - [OK] IUserRepository, IOrderRepository (Confiança: 92%) - Interfaces em /src/Domain/Interfaces
  - [OK] Implementacoes com Dapper (Confiança: 95%) - /src/Infrastructure/Persistence/DapperUserRepository
  - [WARNING] IPaymentRepository (Confiança: 40%) [REVISAR] - Interface existe mas nao implementada

Domain Services:
  - [OK] PaymentService (Confiança: 75%) - Orquestra fluxo: Valida -> Processa -> Atualiza
  - [WARNING] DiscountService (Confiança: 65%) [REVISAR] - Logica complexa em controller

Nivel de Maturidade DDD: INTERMEDIARIO
  - [OK] Bounded contexts definidos
  - [OK] Aggregates e entities identificadas
  - [WARNING] Value_objects parciais (nem todos imutaveis)
  - [OK] Domain events implementados via MediatR
  - [OK] Repositories pattern aplicado
  - [WARNING] Alguns servicos de dominio em camada errada
  - [X] Faltam: Specifications, Domain Services explicitos
```

**Output Esperado:** paradigma arquitetural com confiança · mapa completo de domínio (DDD) · lista de itens [REVISAR] (confiança < 70%).

## 3. Clarificação de itens com baixa confiança (Passo 6)

**CRÍTICO:** este passo só é executado se houver itens [REVISAR] marcados no Passo 5. Se todos os itens tiverem confiança >= 70%, PULE para o Passo 7.

### 3.1. Filtrar e priorizar

1. **Filtrar itens** com confiança < 70% do Passo 5.
2. **Agrupar por categoria:** DOMÍNIO (bounded contexts, aggregates, value objects) · ARQUITETURA (paradigma, padrões, separação de camadas) · STACK (tecnologias, versões, bibliotecas).
3. **Priorizar por impacto:**
   - ALTO IMPACTO: bloqueia inferência de negócio (ex: bounded context ausente)
   - MÉDIO IMPACTO: impacta arquitetura mas não bloqueia negócio (ex: Redis não usado)
   - BAIXO IMPACTO: detalhe técnico (ex: versão exata do PostgreSQL)

### 3.2. Preparar perguntas (máximo 2 por categoria)

**Regras:**
- **MÁXIMO 2 perguntas por categoria** (total max 6 perguntas)
- **Focar em itens com ALTO ou MÉDIO impacto**
- **Itens BAIXO impacto devem ser documentados como "Nota de Decisão"**
- **Cada pergunta deve fornecer contexto específico do código analisado**

**Modelo de Pergunta Efetiva:**

```
[LACUNA: CATEGORIA - NÍVEL DE IMPACTO]

Item: [Nome do item inferido]
Confiança: [X%] - [Justificativa da baixa confiança]

CONTEXTO (do código analisado):
[Descrever o que foi encontrado no código]
[Evidências parciais ou contraditórias]

ANÁLISE:
[Por que a confiança é baixa]
[O que está faltando para aumentar confiança]

PERGUNTA [NÚMERO]/[TOTAL]:
[Pergunta clara e específica com 3-4 opções]

OPÇÕES:
A) [Opção 1 - baseada em evidências]
B) [Opção 2 - alternativa plausível]
C) [Opção 3 - confirmar análise atual]
D) [Outro: descrever]
```

**Exemplo 1: Paradigma Arquitetural (ALTO IMPACTO)**

```
[LACUNA: ARQUITETURA - ALTO IMPACTO]

Item: Paradigma Clean Architecture
Confiança: 55% (detectado Domain/Application mas há violações)

CONTEXTO:
Análise detectou estrutura de pastas típica de Clean Architecture:
- /src/Domain (Entities, ValueObjects)
- /src/Application (Commands, Queries)
- /src/Infrastructure (Repositories)

Porém, também detectei violações:
- UsersController tem método CalculateDiscount() (lógica de negócio em UI)
- OrdersController acessa DbContext diretamente (infra em UI layer)
- PaymentService está em /src/Services (não em /src/Application)

ANÁLISE:
Estrutura segue Clean Architecture mas implementação tem inconsistências.
Possíveis causas: código em evolução, time ainda adaptando, ou paradigma diferente.

PERGUNTA 1/2 (ARQUITETURA):
Este projeto segue Clean Architecture ou há outro paradigma em uso?

A) Clean Architecture (vou documentar violações como debt técnico)
B) MVC tradicional com pastas organizadas por feature (não é Clean Arch)
C) Layered Architecture sem separação estrita entre camadas
D) Outro paradigma: [descreva]

IMPACTO:
Esta decisão afeta:
- Como documentar separação de responsabilidades
- Quais padrões esperar para novas features
- Como classificar a arquitetura no architecture.md
```

**Exemplo 2: Bounded Context (ALTO IMPACTO)**

```
[LACUNA: DOMÍNIO - ALTO IMPACTO]

Item: Bounded Context "Payments"
Confiança: 40% (apenas controllers, sem domínio rico)

CONTEXTO:
Detectei /src/Payments/ com:
- PaymentsController (endpoints de pagamento)
- PaymentService (regras de validação e processamento)

Porém, NÃO encontrei:
- Payment aggregate/entity (classe de domínio)
- Domain events para pagamentos (PaymentProcessed, PaymentFailed)
- Value objects típicos (Money, CardNumber)

ANÁLISE:
Possível que Payments seja:
A) Bounded context anêmico (CRUD simples, sem domínio rico)
B) Contexto externo (API wrapper para serviço terceiro)
C) Domínio ainda em evolução (não implementado ainda)

PERGUNTA 2/2 (DOMÍNIO):
Payments é um bounded context com domínio rico ou apenas um wrapper/CRUD?

A) Domínio rico (vou inferir entidades/VOs baseado em endpoints)
B) CRUD simples (vou documentar como "anêmico" no architecture.md)
C) Contexto externo/API wrapper (vou documentar integração)
D) Outro: [descreva]

IMPACTO:
Esta decisão afeta:
- Como inferir casos de uso de negócio para Payments
- Quais entidades documentar em product_vision.md
- Como classificar maturidade DDD do projeto
```

**Exemplo 3: Stack Tecnológica (MÉDIO IMPACTO)**

```
[LACUNA: STACK - MÉDIO IMPACTO]

Item: Redis Cache
Confiança: 35% (docker-compose tem redis mas código não usa)

CONTEXTO:
Detectei Redis em docker-compose.yml (trecho abaixo, indentado):

    redis:
      image: redis:7-alpine
      ports: ["6379:6379"]

Porém, NÃO encontrei no código:
- Imports de redis-client, ioredis, @redis/client
- Uso de cache em queries ou services
- Configuração de Redis em .env ou appsettings

ANÁLISE:
Redis pode estar:
A) Configurado para uso futuro (não implementado ainda)
B) Usado por serviço externo (não no código analisado)
C) Esquecimento do docker-compose (serviço não necessário)

PERGUNTA 1/2 (STACK):
Redis deve ser documentado como parte da stack atual?

A) SIM, faz parte (planejado para futuro ou uso externo)
B) NÃO, remover (não é usado no código atual)
C) Manter como "opcional/futuro" com nota

IMPACTO:
Baixo - não afeta inferência de negócio, apenas documentação técnica.
```

### 3.3. Apresentar as perguntas

Formato: agrupar por categoria com separadores, instruir o usuário a responder com A, B, C ou D (para D, fornecer detalhes) e informar que o architecture.md será regenerado após as respostas. **Aguardar as respostas do usuário.**

### 3.4. Processar respostas e regenerar

1. **SE resposta for A, B ou C:** atualizar a inferência com base na opção escolhida; aumentar a confiança para 90-100% (usuário confirmou); remover a tag [REVISAR].
2. **SE resposta for D (Outro):** solicitar detalhes adicionais se necessário; re-analisar o código com a nova informação; atualizar a inferência e aumentar a confiança.
3. **Após todas as respostas:** gerar novamente o `./specs/core/architecture.md` com as correções; atualizar o status para `APPROVED`; prosseguir para o Passo 7.

**Output Esperado:** architecture.md atualizado (sem tags [REVISAR]), todas as inferências com confiança >= 90%, arquivo pronto para usar como base para product_vision.md.

## 4. Mapeamento Técnico -> Negócio (Passo 7)

Usar o `architecture.md` aprovado como fonte de verdade para inferir o negócio.

### 4.1. Tabela de mapeamento

| DETECAO TECNICA | INFERENCIA DE NEGOCIO |
|:---|:---|
| **Bounded Contexts** (/Users, /Orders, /Payments) | Subdominios de negocio: "Gestao de Usuarios", "Pedidos", "Pagamentos" |
| **Aggregates** (User, Order, Payment) | Entidades principais: "Usuario", "Pedido", "Pagamento" |
| **Webhooks (Stripe)** | Eventos de negocio criticos: "Pagamentos assincronos" |
| **Integration Tests** (Order flow) | Fluxos complexos: "Ciclo de vida do pedido" |
| **Rate Limiting** (Redis, 100/15min) | Alto volume/requisicoes: "Sistema em escala" |
| **JWT + OAuth** | Multi-tenant/SSO: "Autenticacao corporativa" |
| **SendGrid Templates** | Comunicacao transacional: "Notificacoes ao usuario" |
| **Controllers/Actions** (CreateOrder, ProcessPayment) | Casos de uso: "Criar pedido", "Processar pagamento" |

### 4.2. Inferir elementos de negócio

**1. PERSONAS (baseado em aggregates e controllers):**
- DE: User aggregate, UsersController, AdminController
- PARA: "Cliente Final" (usuário do sistema: cria pedidos, faz pagamentos, gerencia perfil) e "Administrador" (gestor: gerencia usuários, visualiza relatórios, configura sistema)

**2. PROBLEMA CENTRAL (baseado em webhooks, events, integrations):**
- DE: Stripe webhooks, PaymentFailed events, Retry logic
- PARA: "Gerenciar ciclo de vida de pedidos com pagamentos assíncronos, garantindo consistência mesmo quando pagamentos falham ou são processados em background."

**3. CASOS DE USO PRINCIPAIS (baseado em controllers/endpoints):**
- DE: UsersController.Create, OrdersController.PlaceOrder
- PARA: "Cadastrar novo usuário no sistema", "Criar pedido com múltiplos itens", "Processar pagamento de forma assíncrona", "Notificar usuário sobre status do pedido"

**4. MÉTRICAS DE SUCESSO (baseado em monitoring/logging):**
- DE: Prometheus metrics, error tracking, coverage reports
- PARA: "Taxa de sucesso de pagamentos" (monitorado via PaymentFailed events), "Tempo de processamento de pedidos" (trackeado em logs), "Disponibilidade do sistema" (uptime monitoring)

**5. ESCOPO (IN/OUT) (baseado em bounded contexts):**
- DE: Bounded Contexts: Users, Orders, Payments
- PARA IN-SCOPE: gestão de usuários e autenticação; ciclo completo de pedidos; processamento de pagamentos
- PARA OUT-OF-SCOPE: gestão de estoque (não detectado como bounded context); notificações push (apenas email via SendGrid); analytics e dashboards (não detectado)

**6. PROPOSTA DE VALOR (baseado em integrações):**
- DE: Stripe (pagamentos), AWS S3 (storage), SendGrid (email), Rate limiting (escala), Webhooks (assíncrono)
- PARA: "Plataforma de e-commerce em escala com processamento assíncrono de pagamentos, notificações transacionais e infraestrutura elástica para alto volume."

### 4.3. Preencher o template de visão

1. Ler o `architecture.md` aprovado como referência.
2. Para cada seção do template, fazer as inferências: Declaração do Problema (webhooks/events/errors) · Personas (aggregates/controllers) · Proposta de Valor (integrações/infra) · Métricas (monitoring/logging) · Escopo (bounded contexts) · Jornada do Usuário (integration tests) · Riscos (baixa cobertura, debt técnico).
3. Preencher a seção 10 "Inferências do Código Legado" com a tabela inferência -> fonte técnica -> confiança (+ entidades, casos de uso e limitações das inferências, conforme seções 10.1-10.4 do template).
4. Status: DRAFT (ou IN_PROGRESS se houver ajustes). Salvar em `./specs/core/product_vision.md`.
