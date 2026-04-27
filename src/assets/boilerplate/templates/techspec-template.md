# Technical Specification: {{FEATURE_NAME}}

**Scope:** Esta especificação cobre APENAS a feature {{FEATURE_NAME}} conforme descrita no PRD.
Qualquer comportamento fora deste escopo deve ser explicitamente rejeitado.

| Metadata | Details |
| :--- | :--- |
| **Status** | Draft |
| **Data** | {{DATA_ATUAL}} |
| **Referência PRD** | [Link PRD](./prd.md) |
<!-- Status: DRAFT → IN_PROGRESS → APPROVED -->

---

## 1. Introdução e contexto

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Dar visão geral técnica da feature em 1-2 parágrafos
FORMATO: Texto conciso (máx 150 palavras)
CONTEÚDO OBRIGATÓRIO:
- Padrão arquitetural usado (ex: "Clean Architecture com CQRS")
- Tecnologias principais (ex: "PostgreSQL, RabbitMQ, Redis")
- Padrões de design aplicados (ex: "Saga pattern", "Repository pattern")

EXEMPLO BOM:
"Esta feature implementará o fluxo de checkout utilizando o padrão Saga para orquestração.
Usaremos RabbitMQ para processamento assíncrono de pagamentos (conforme padrão em PaymentService).
O estado do pedido será persistido no PostgreSQL seguindo estrutura estabelecida em OrderEntity."

ANTI-PATTERN:
"Esta feature é para checkout e vai usar banco de dados." (Muito vago, sem tecnologias específicas)

REGRA: Citar AGENTS.md ou Features similares quando aplicável
-->

{{INTRODUCTION_CONTENT}}

**Objetivo de Negócio:** ...
**Impacto no Usuário:** ...
**Non Goals:** ...
**Pressupostos:** ...

---

## 2. High-Level Architecture [Obrigatório]

### 2.1 Context Diagram

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Mostrar componentes envolvidos nesta feature APENAS
FORMATO: Diagrama Mermaid (graph LR ou TD)
REGRAS:
- Refletir APENAS componentes mencionados no PRD
- Serviços especulativos são PROIBIDOS
- Prefira menos nós à completude
- Use rótulos nas arestas para indicar comunicação

EXEMPLO BOM:
graph LR
    User -->|HTTP POST /orders| API
    API -->|Publish OrderCreated| MessageBroker
    PaymentWorker -->|Consume OrderCreated| MessageBroker
    PaymentWorker -->|Update status| Database

EXEMPLO RUIM:
graph LR
    User --> API --> Cache --> MessageBroker --> Worker --> Database --> Analytics
(Cache e Analytics não estão no PRD - isso é especulação)

TIPOS DE NÓS COMUNS:
- User, Client, Frontend
- API, Gateway, Controller
- Service, Worker, Processor
- Database, Cache, Queue
- ExternalService, ThirdPartyAPI
-->

:::mermaid
{{CONTEXT_DIAGRAM_CONTENT}}
:::

<!-- NOTA: Substituir o placeholder acima pelo diagrama real -->

### 2.2 Design de Componentes (Alinhado com a Arquitetura da Aplicação) [Obrigatório]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Listar componentes que serão criados/modificados
FORMATO: Tabela com colunas obrigatórias
REGRAS:
- Todo componente DEVE estar em conformidade com a arquitetura declarada
- Todo componente DEVE pertencer a exatamente UMA camada arquitetural
- Nenhum componente PODE violar direção de dependências

CAMADAS ARQUITETURAIS COMUNS:
- Domain: Entidades, Value Objects, Domain Services
- Application: Use Cases, Commands, Queries, Handlers, DTOs
- Infrastructure: Repositories, External Services, Adapters
- Interface: Controllers, Presenters, Gateways

TIPOS DE COMPONENTES:
- Controller, Handler, Service, Repository, Entity, Adapter, Worker

EXEMPLO BOM:
| Nome | Camada | Tipo | Responsabilidade | Dependências Permitidas |
|:---|:---|:---|:---|:---|
| CreateOrderHandler | Application | Handler | Processa comando de criação de pedido | IOrderRepository, IEventBus |
| OrderRepository | Infrastructure | Repository | Persiste e busca ordens no DB | DbContext (Dapper) |
| Order | Domain | Entity | Entidade de domínio Order | Nenhuma (entidade) |

EXEMPLO RUIM:
| Nome | Camada | Tipo | Descrição |
|:---|:---|:---|:---|
| OrderService | Application | Service | Gerencia pedidos |
(Faltou: responsabilidade específica, dependências)

ANTI-PATTERN:
- Componentes que dependem de camadas "superiores" (Domain dependendo de Application)
- Misturar responsabilidades (Handler que acessa DB diretamente)
-->

| Nome | Camada | Tipo | Responsabilidade | Dependências (Apenas Permitidas) |
|:---|:---|:---|:---|:---|
{{COMPONENT_DESIGN_CONTENT}}
<!-- ADICIONAR LINHAS CONFORME NECESSÁRIO -->

---

## 3. Design e Persistência de Dados [Se aplicável]

### 3.1 Modelos de dados / Schema [Se aplicável]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir estrutura de dados EXATA
FORMATO: Lista de Entities ou Tables com campos especificados
REGRAS:
- Tipos de dados ESPECÍFICOS (VARCHAR(255), não "string")
- Constraints explícitas (PK, FK, Unique, Not Null)
- Índices quando aplicável
- Relacionamentos documentados

EXEMPLO BOM:
Entity: Order
- id (UUID, PK): Identificador único
- customer_id (UUID, FK -> User.id, Not Null, Indexed): Cliente
- total_amount (DECIMAL(10,2), Not Null): Valor total
- status (VARCHAR(50), Not Null): [PENDING, PAID, FAILED, CANCELLED]
- created_at (TIMESTAMP, Default: NOW): Data criação

Constraints:
- CHECK (total_amount >= 0)
- INDEX idx_customer_id ON customer_id
- INDEX idx_status ON status

EXEMPLO RUIM:
Entity: Order
- id: int
- customer: reference to user
- amount: decimal
- status: enum
(Tipos genéricos, sem tamanhos, sem constraints)

ANTI-PATTERNS:
- "string" em vez de "VARCHAR(255)"
- "number" em vez de "DECIMAL(10,2)"
- Não especificar nullable/not null
- Não documentar índices
-->

{{DATA_MODELS_CONTENT}}
<!-- ADICIONAR ENTITIES/TABLES CONFORME NECESSÁRIO -->

### 3.2 Estratégia de armazenamento [Se aplicável]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Explicar COMO os dados serão armazenados
FORMATO: Texto curto ou bullet points
CONTEÚDO:
- Tipo de banco (relacional, document, key-value)
- Estratégias de particionamento (se aplicável)
- Políticas de retenção
- Backup/restore considerations

EXEMPLO BOM:
"Orders serão armazenados em PostgreSQL (conforme padrão do projeto).
Dados de auditoria (OrderEvents) serão particionados por mês (partitioning table).
Retenção: 5 anos em produção, conforme compliance."

-->

{{STORAGE_STRATEGY_CONTENT}}

### 3.3 Banco de Dados e Infraestrutura [Se aplicável]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Documentar stack de banco e infraestrutura EXATA
FORMATO: Tabela ou lista estruturada
CONTEÚDO OBRIGATÓRIO:
- Tipo de banco de dados (com versão)
- ORM/Query Builder usado
- Ferramenta de migrations
- Serviços de infraestrutura (Docker, mensageria, cache, storage)
- Padrões de nomenclatura de tabelas/colunas

EXEMPLO BOM:
**Database Stack:**
- Type: PostgreSQL 15+
- ORM: Prisma (conforme padrão do projeto)
- Migrations: Prisma Migrate (/prisma/migrations)
- Naming: snake_case for tables/columns
- FK Pattern: {table}_id (user_id, order_id)
- PK Pattern: UUID with gen_random_uuid()

**Infrastructure Stack:**
- Containerization: Docker Compose (docker-compose.yml)
- Services: postgres, redis, rabbitmq
- Messaging: RabbitMQ with amqplib
- Cache: Redis with ioredis (TTL: 5min default)
- Storage: S3 with CloudFront CDN
- CI/CD: GitHub Actions (test, lint, deploy)

EXEMPLO RUIM:
- Banco SQL
- ORM padrão
- Docker com alguns serviços
(Faltam: versões, nomes específicos, tecnologias exatas)

ANTI-PATTERNS:
- "banco de dados relacional" (qual? PostgreSQL? MySQL?)
- "ORM moderno" (Prisma? TypeORM? Sequelize?)
- Não especificar versões
- Não documentar serviços de docker-compose
-->

{{DATABASE_INFRASTRUCTURE_CONTENT}}

---

## 4. Contratos de Integracao (Boundaries) [Obrigatorio]

<!-- INSTRUÇÕES DE PREENCHIMENTO GERAL:
OBJETIVO: Documentar TODOS os contratos entre fronteiras do sistema
REGRA PRINCIPAL: Toda fronteira que a feature toca DEVE ter seu contrato definido aqui.
Não importa se o outro lado está no mesmo repositório ou é um serviço de terceiros.

CLASSIFICAÇÃO DE ORIGEM (como o contrato foi obtido):
- DESCOBERTO: LLM encontrou definição existente no código/docs (OpenAPI, proto, migrations, etc.)
- SOLICITADO: LLM não encontrou, usuário forneceu a definição
- PROPOSTO: LLM propôs com base no PRD e padrões do projeto

CADA contrato DEVE conter:
- Metadata com ID único (CT-XXX), fronteira, protocolo e origem
- Schema de entrada completo com tipos
- Schema de saida completo com tipos
- Schema de erro com codigos
- Headers/Metadata quando aplicável

ANTI-PATTERNS GERAIS:
- "Enviar dados para o backend" (qual schema? qual protocolo?)
- "Salvar no banco" (qual tabela? quais campos? quais tipos?)
- "Publicar evento" (qual tópico? qual payload? quais headers?)
- Contrato sem ID de rastreamento (impossível vincular a tasks)
- Omitir contratos de terceiros (Stripe, SendGrid, etc.)
-->

### Tabela Resumo de Contratos

<!-- INSTRUÇÕES:
Listar TODOS os contratos da feature com resumo. Preencher conforme cada subseção abaixo.
-->

| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |
|:---|:---|:---|:---|:---|:---|
| CT-001 | Client-Backend | {{CONTRATO_001_NOME}} | {{PROTOCOL}} | {{DESCOBERTO/SOLICITADO/PROPOSTO}} | 4.1 |
| CT-002 | Backend-Database | {{CONTRATO_002_NOME}} | {{PROTOCOL}} | {{DESCOBERTO/SOLICITADO/PROPOSTO}} | 4.2 |
<!-- ADICIONAR LINHAS CONFORME NECESSÁRIO -->

---

### 4.1 Contrato Client-Backend [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos entre clientes (frontend, app, terceiros) e o backend
APLICABILIDADE: HTTP REST, gRPC, WebSocket, GraphQL, SSE, ou qualquer protocolo de comunicação cliente-servidor
REGRAS:
- Metodo/operacao e rota completos
- Request payload com tipos
- Response para TODOS os status codes possiveis
- Error responses formatados
- Headers obrigatorios (auth, content-type, correlation-id)
- Politicas de comunicacao cross-origin (CORS) quando aplicavel

FORMATO POR ENDPOINT/OPERACAO:

#### [CT-XXX] NOME_DO_ENDPOINT

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Client -> Backend |
| **Protocolo** | [HTTP REST / gRPC / WebSocket / GraphQL / SSE] |
| **Operacao** | [POST /api/v1/orders] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |
| **Auth** | [Bearer JWT / API Key / None] |

Request:
```json
{{REQUEST_SCHEMA}}
```

Response [STATUS_CODE]:
```json
{{SUCCESS_RESPONSE_SCHEMA}}
```

Error [STATUS_CODE]:
```json
{{ERROR_RESPONSE_SCHEMA}}
```

EXEMPLO BOM:
#### CT-001 Create Order

| Metadata | Details |
|:---|:---|
| **ID** | CT-001 |
| **Fronteira** | Client -> Backend |
| **Protocolo** | HTTP REST |
| **Operacao** | POST /api/v1/orders |
| **Como Obtido** | PROPOSTO |
| **Auth** | Bearer JWT (role: customer, admin) |

Headers:
- Content-Type: application/json
- Authorization: Bearer {token}
- X-Correlation-Id: {uuid}

Request:
```json
{
  "items": [
    {
      "productId": "uuid-v4",
      "quantity": 1
    }
  ]
}
```

Response 201 Created:
```json
{
  "orderId": "uuid-v4",
  "status": "PENDING",
  "totalAmount": 99.99,
  "createdAt": "2024-03-01T10:00:00Z"
}
```

Response 400 Bad Request:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request payload",
  "details": [
    { "field": "items[0].quantity", "error": "Must be greater than 0" }
  ]
}
```

Response 422 Unprocessable Entity:
```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Item xyz out of stock",
  "details": {
    "itemId": "xyz",
    "requested": 5,
    "available": 2
  }
}
```

Response 500 Internal Server Error:
```json
{
  "code": "INTERNAL_ERROR",
  "message": "Unexpected error occurred",
  "requestId": "correlation-id-here"
}
```

EXEMPLO RUIM:
POST /orders
Request: { order data }
Response: { order }
(Faltam: ID do contrato, versao da API, tipos, status codes, error cases, headers)

ANTI-PATTERNS:
- Nao documentar error cases
- Nao especificar content-type
- Status codes genericos (sem 422, 400, 404)
- Request sem tipos de dados
- Omitir headers obrigatorios
- Nao classificar origem (DESCOBERTO/SOLICITADO/PROPOSTO)
-->

{{CLIENT_BACKEND_CONTRACTS}}
<!-- ADICIONAR ENDPOINTS/OPERACOES CONFORME NECESSARIO -->

#### 4.1.1 Politicas de Comunicacao Cross-Origin (CORS) [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir politicas de CORS quando frontend e backend estao em dominios/ports diferentes
APLICABILIDADE: Aplicar sempre que a comunicacao Client-Backend for HTTP e houver
possibilidade de cross-origin (diferentes dominios, subdominios, ports ou protocolos)
REGRA: Mesmo em monorepo com SSR, pode haver chamadas cross-origin em ambiente de desenvolvimento.

FORMATO:

| Politica | Valor | Justificativa |
|:---|:---|:---|
| **Allowed Origins** | [lista de origens ou *] | [quais dominios podem acessar] |
| **Allowed Methods** | [GET, POST, PUT, DELETE, PATCH, OPTIONS] | [quais metodos sao permitidos] |
| **Allowed Headers** | [Content-Type, Authorization, X-Correlation-Id] | [quais headers o cliente pode enviar] |
| **Exposed Headers** | [X-Request-Id, X-Total-Count] | [quais headers o cliente pode ler] |
| **Allow Credentials** | [true / false] | [cookies, authorization headers] |
| **Max Age** | [segundos] | [cache do preflight] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] | |

EXEMPLO BOM:

| Politica | Valor | Justificativa |
|:---|:---|:---|
| **Allowed Origins** | https://app.example.com, http://localhost:3000 (dev) | Frontend em dominio diferente do backend |
| **Allowed Methods** | GET, POST, PUT, DELETE, OPTIONS | CRUD completo + preflight |
| **Allowed Headers** | Content-Type, Authorization, X-Correlation-Id | Headers obrigatorios dos contratos |
| **Exposed Headers** | X-Request-Id, X-Total-Count | Cliente precisa ler para UI |
| **Allow Credentials** | true | Autenticacao via cookie/JWT |
| **Max Age** | 3600 | Preflight cache de 1h |
| **Como Obtido** | DESCOBERTO (cors.ts com configuracao existente) |

EXEMPLO RUIM:
"CORS configurado"
(Faltam: origins especificos, metodos, headers, credentials)

ANTI-PATTERNS:
- Allowed Origins: * em producao (risco de seguranca)
- Nao documentar CORS quando frontend e backend estao separados
- Omitir Allow Credentials quando usa cookies/auth
- Nao alinhar Allowed Headers com os headers dos contratos
-->

| Politica | Valor | Justificativa |
|:---|:---|:---|
| **Allowed Origins** | {{CORS_ORIGINS}} | {{CORS_ORIGINS_JUSTIFICATION}} |
| **Allowed Methods** | {{CORS_METHODS}} | {{CORS_METHODS_JUSTIFICATION}} |
| **Allowed Headers** | {{CORS_HEADERS}} | {{CORS_HEADERS_JUSTIFICATION}} |
| **Exposed Headers** | {{CORS_EXPOSED_HEADERS}} | {{CORS_EXPOSED_JUSTIFICATION}} |
| **Allow Credentials** | {{CORS_CREDENTIALS}} | {{CORS_CREDENTIALS_JUSTIFICATION}} |
| **Max Age** | {{CORS_MAX_AGE}} | {{CORS_MAX_AGE_JUSTIFICATION}} |
| **Como Obtido** | {{DESCOBERTO/SOLICITADO/PROPOSTO}} | |

---

### 4.2 Contrato Backend-Database [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos entre o backend e o banco de dados
APLICABILIDADE: Qualquer mecanismo de persistencia (SQL, NoSQL, ORM, query builder, stored procedures)
REGRAS:
- Operacao claramente definida (query, command, procedure)
- Input: parametros, entidades, filtros
- Output: result sets, affected rows, generated keys
- Constraints e erros esperados (violation, timeout, deadlock)
- Transacoes quando aplicavel

FORMATO POR OPERACAO:

#### [CT-XXX] NOME_DA_OPERACAO

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> Database |
| **Protocolo** | [SQL / NoSQL Query / ORM / Stored Procedure] |
| **Operacao** | [INSERT / SELECT / UPDATE / DELETE / PROC] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |
| **Tabela/Collection** | [nome] |

Input:
```json
{{INPUT_SCHEMA}}
```

Output:
```json
{{OUTPUT_SCHEMA}}
```

Erros Esperados:
- CONSTRAINT_VIOLATION: {{descricao}}
- TIMEOUT: {{descricao}}

EXEMPLO BOM:
#### CT-005 Insert Order

| Metadata | Details |
|:---|:---|
| **ID** | CT-005 |
| **Fronteira** | Backend -> Database |
| **Protocolo** | SQL (via ORM/Query Builder) |
| **Operacao** | INSERT |
| **Como Obtido** | DESCOBERTO (migration 20240301_create_orders.sql) |
| **Tabela** | orders |

Input:
```json
{
  "id": "uuid-v4",
  "customer_id": "uuid-v4",
  "status": "PENDING",
  "total_amount": 99.99,
  "created_at": "2024-03-01T10:00:00Z"
}
```

Output:
```json
{
  "affected_rows": 1,
  "generated_keys": ["uuid-v4"]
}
```

Erros Esperados:
- FK_VIOLATION: customer_id nao existe na tabela users
- CHECK_VIOLATION: total_amount negativo

EXEMPLO RUIM:
"Salvar pedido no banco"
(Faltam: ID, tabela, campos, tipos, constraints, erros)

ANTI-PATTERNS:
- "Salvar no banco" (qual tabela? quais campos?)
- Nao documentar constraints e erros esperados
- Omitir tipo de operacao (INSERT vs UPDATE)
-->

{{BACKEND_DATABASE_CONTRACTS}}
<!-- ADICIONAR OPERACOES CONFORME NECESSARIO -->

---

### 4.3 Contrato Backend-Message Broker [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos de mensageria (publicacao e consumo)
APLICABILIDADE: Kafka, RabbitMQ, SQS, gRPC streaming, ou qualquer mecanismo de mensageria
REGRAS:
- Nome do evento (Passado: OrderCreated, PaymentFailed)
- Source (quem publica) e Target (quem consome)
- Topic/Queue/Channel
- Payload com tipos
- Correlation ID (sempre)
- Estrategia de error (dead letter, retry)
- Ordenacao (FIFO, particoes)

FORMATO POR EVENTO/MENSAGEM:

#### [CT-XXX] NOME_DO_EVENTO (Publish)

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> Message Broker |
| **Direcao** | [Publish / Subscribe] |
| **Topic/Queue** | [nome] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |
| **Source** | [Componente que publica] |
| **Target** | [Componente que consome] |

Payload:
```json
{{EVENT_PAYLOAD}}
```

Headers/Metadata:
```json
{{EVENT_HEADERS}}
```

Error Handling:
- Retry: {{policy}}
- Dead Letter: {{topic}}

EXEMPLO BOM:
#### CT-010 OrderCreated (Publish)

| Metadata | Details |
|:---|:---|
| **ID** | CT-010 |
| **Fronteira** | Backend -> Message Broker |
| **Direcao** | Publish |
| **Topic/Queue** | orders.events |
| **Como Obtido** | PROPOSTO |
| **Source** | CreateOrderHandler (Application Layer) |
| **Target** | PaymentWorker, InventoryWorker |

Payload:
```json
{
  "eventId": "uuid-v4",
  "eventType": "OrderCreated",
  "timestamp": "2024-03-01T10:00:00Z",
  "data": {
    "orderId": "uuid-v4",
    "customerId": "uuid-v4",
    "totalAmount": 99.99,
    "items": [
      {
        "productId": "uuid-v4",
        "quantity": 1,
        "unitPrice": 99.99
      }
    ]
  },
  "metadata": {
    "correlationId": "uuid-v4",
    "causationId": "uuid-v4"
  }
}
```

Error Handling:
- Retry: 3 tentativas com backoff exponencial (1s, 2s, 4s)
- Dead Letter: orders.events.dlq

EXEMPLO RUIM:
Event: OrderCreated
Payload: { order data }
(Faltam: ID, source, tipos especificos, correlationId, error handling)

ANTI-PATTERNS:
- Eventos sem correlation ID (impossivel tracing)
- Payloads nao estruturados
- Nao definir estrategia de retry/dead letter
- Omitir consumer esperado
-->

{{BACKEND_MESSAGE_BROKER_CONTRACTS}}
<!-- ADICIONAR EVENTOS/MESSAGES CONFORME NECESSARIO -->

---

### 4.4 Contrato Backend-Cache [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos de cache (leitura, escrita, invalidacao)
APLICABILIDADE: Redis, Memcached, cache em memoria, CDN cache, ou qualquer camada de cache
REGRAS:
- Key pattern (como a chave e formada)
- TTL (tempo de vida)
- Schema do valor cacheado
- Estrategia de invalidacao

FORMATO POR OPERACAO DE CACHE:

#### [CT-XXX] NOME_DO_CACHE

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> Cache |
| **Operacao** | [Get / Set / Invalidate] |
| **Key Pattern** | [padrao] |
| **TTL** | [tempo] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |

Value Schema:
```json
{{CACHED_VALUE_SCHEMA}}
```

Invalidacao:
- Trigger: {{quando invalidar}}
- Pattern: {{quais chaves}}

EXEMPLO BOM:
#### CT-015 Product Catalog Cache

| Metadata | Details |
|:---|:---|
| **ID** | CT-015 |
| **Fronteira** | Backend -> Cache |
| **Operacao** | Get/Set/Invalidate |
| **Key Pattern** | product:catalog:{categoryId} |
| **TTL** | 5 minutos |
| **Como Obtido** | DESCOBERTO (Redis config em cache.ts) |

Value Schema:
```json
{
  "products": [
    {
      "id": "uuid-v4",
      "name": "string",
      "price": 99.99,
      "stock": 10
    }
  ],
  "cachedAt": "2024-03-01T10:00:00Z"
}
```

Invalidacao:
- Trigger: ProductUpdated, ProductDeleted events
- Pattern: product:catalog:*

EXEMPLO RUIM:
"Usar cache para produtos"
(Faltam: key pattern, TTL, schema, invalidacao)

ANTI-PATTERNS:
- Cache sem TTL (dados obsoletos indefinidamente)
- Cache sem estrategia de invalidacao
- Keys sem padrao documentado
-->

{{BACKEND_CACHE_CONTRACTS}}
<!-- ADICIONAR ENTRADAS DE CACHE CONFORME NECESSARIO -->

---

### 4.5 Contrato Backend-External Services [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos com servicos externos (terceiros, outras equipes, APIs publicas)
APLICABILIDADE: HTTP REST, SOAP, gRPC, SDKs, webhooks, ou qualquer integracao externa
REGRAS:
- Servico de terceiros DEVE ter contrato definido (mesmo que não haja doc interna)
- Distinguir OUTBOUND (backend chama terceiro) de INBOUND (terceiro chama backend/webhook)
- Autenticacao com terceiro
- Rate limits, retries, circuit breaker
- NUNCA documentar valores reais de API keys ou secrets

FORMATO POR INTEGRACAO:

#### [CT-XXX] NOME_DO_SERVICO - Outbound (Backend -> Terceiro)

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> [Nome do Servico] |
| **Direcao** | Outbound |
| **Protocolo** | [HTTP REST / gRPC / SDK] |
| **Operacao** | [POST /v1/payment-intents] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |
| **Auth** | [API Key / OAuth / Bearer] |
| **Rate Limit** | [X req/min] |
| **Timeout** | [Xs] |

Request:
```json
{{OUTBOUND_REQUEST}}
```

Response Success:
```json
{{OUTBOUND_SUCCESS_RESPONSE}}
```

Response Error:
```json
{{OUTBOUND_ERROR_RESPONSE}}
```

Error Handling:
- Retry: {{policy}}
- Circuit Breaker: {{config}}
- Fallback: {{acao alternativa}}

#### [CT-XXX] NOME_DO_SERVICO - Inbound (Webhook)

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | [Nome do Servico] -> Backend |
| **Direcao** | Inbound (Webhook) |
| **Endpoint** | [POST /api/webhooks/servico] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |
| **Verificacao** | [HMAC SHA256 / Signature Header] |

Payload:
```json
{{WEBHOOK_PAYLOAD}}
```

Expected Response:
```json
{{WEBHOOK_ACK}}
```

EXEMPLO BOM:
#### CT-020 Stripe Payment Intent - Outbound

| Metadata | Details |
|:---|:---|
| **ID** | CT-020 |
| **Fronteira** | Backend -> Stripe API |
| **Direcao** | Outbound |
| **Protocolo** | HTTP REST (via SDK) |
| **Operacao** | POST /v1/payment_intents |
| **Como Obtido** | SOLICITADO (usuario confirmou) |
| **Auth** | Stripe Secret Key |
| **Rate Limit** | 100 req/min |
| **Timeout** | 10s |

Request:
```json
{
  "amount": 9999,
  "currency": "usd",
  "metadata": {
    "orderId": "uuid-v4"
  }
}
```

Response 200 OK:
```json
{
  "id": "pi_xxx",
  "status": "requires_payment_method",
  "amount": 9999,
  "currency": "usd"
}
```

Error 401:
```json
{
  "error": {
    "type": "authentication_error",
    "message": "Invalid API Key"
  }
}
```

Error Handling:
- Retry: 3 tentativas com backoff exponencial
- Circuit Breaker: abrir apos 5 falhas consecutivas
- Fallback: marcar pedido como PAYMENT_PENDING e processar manualmente

#### CT-021 Stripe Webhook - Inbound

| Metadata | Details |
|:---|:---|
| **ID** | CT-021 |
| **Fronteira** | Stripe -> Backend |
| **Direcao** | Inbound (Webhook) |
| **Endpoint** | POST /api/webhooks/stripe |
| **Como Obtido** | SOLICITADO (usuario confirmou) |
| **Verificacao** | Stripe-Signature header (HMAC SHA256) |

Payload (payment_intent.succeeded):
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "status": "succeeded",
      "amount": 9999,
      "metadata": {
        "orderId": "uuid-v4"
      }
    }
  }
}
```

Expected Response: 200 OK (empty body)

EXEMPLO RUIM:
"Integrar com Stripe para pagamento"
(Faltam: endpoint, payload, erros, auth, rate limit, timeout, webhooks)

ANTI-PATTERNS:
- Omitir contrato de servico de terceiro
- Nao documentar webhooks recebidos
- Nao definir retry/circuit breaker
- Documentar valores reais de API keys
-->

{{BACKEND_EXTERNAL_CONTRACTS}}
<!-- ADICIONAR INTEGRACOES CONFORME NECESSARIO -->

---

### 4.6 Contrato Backend-Storage [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos de armazenamento de arquivos
APLICABILIDADE: S3, Blob Storage, filesystem local, CDN, ou qualquer mecanismo de storage
REGRAS:
- Tipo de operacao (upload, download, delete)
- Formatos aceitos, tamanho maximo
- Path pattern (como o caminho e formado)
- Controle de acesso (publico, privado, presigned URL)

FORMATO POR OPERACAO:

#### [CT-XXX] NOME_DA_OPERACAO

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> Storage |
| **Operacao** | [Upload / Download / Delete] |
| **Path Pattern** | [padrao] |
| **Formatos Aceitos** | [mime types] |
| **Tamanho Maximo** | [valor] |
| **Acesso** | [Publico / Privado / Presigned URL] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |

Input/Output Schema:
```json
{{STORAGE_SCHEMA}}
```

EXEMPLO BOM:
#### CT-025 Upload Profile Image

| Metadata | Details |
|:---|:---|
| **ID** | CT-025 |
| **Fronteira** | Backend -> S3 Storage |
| **Operacao** | Upload |
| **Path Pattern** | /profiles/{userId}/avatar.{ext} |
| **Formatos Aceitos** | image/jpeg, image/png, image/webp |
| **Tamanho Maximo** | 2MB |
| **Acesso** | Presigned URL (expira em 1h) |
| **Como Obtido** | DESCOBERTO (storage.ts com S3 config) |

EXEMPLO RUIM:
"Fazer upload de imagem"
(Faltam: path, formatos, tamanho, acesso)
-->

{{BACKEND_STORAGE_CONTRACTS}}
<!-- ADICIONAR OPERACOES DE STORAGE CONFORME NECESSARIO -->

---

### 4.7 Contrato Backend-Search Engine [Se aplicavel]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir contratos com mecanismos de busca
APLICABILIDADE: Elasticsearch, Meilisearch, Algolia, ou qualquer search engine
REGRAS:
- Schema do documento indexado
- Query parameters aceitos
- Schema da resposta (paginacao, scoring)

FORMATO POR OPERACAO:

#### [CT-XXX] NOME_DO_INDICE

| Metadata | Details |
|:---|:---|
| **ID** | CT-XXX |
| **Fronteira** | Backend -> Search Engine |
| **Operacao** | [Index / Search / Delete] |
| **Indice/Collection** | [nome] |
| **Como Obtido** | [DESCOBERTO / SOLICITADO / PROPOSTO] |

Document/Query Schema:
```json
{{SEARCH_SCHEMA}}
```

Response Schema:
```json
{{SEARCH_RESPONSE}}
```
-->

{{BACKEND_SEARCH_CONTRACTS}}
<!-- ADICIONAR OPERACOES DE SEARCH CONFORME NECESSARIO -->

---

### 4.8 Contrato Application-Environment [Obrigatorio]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Documentar variaveis de ambiente necessarias para a feature
APLICABILIDADE: Toda feature que requer nova configuracao de ambiente
REGRAS:
- Listar TODAS as variaveis de ambiente que a feature precisa
- Classificar: obrigatoria vs opcional
- Documentar formato esperado
- NUNCA documentar valores reais de secrets
- Distinguir Backend, Frontend e Secrets

FORMATO:

#### Backend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
| ENV-001 | {{VAR_NAME}} | [string/int/bool/url] | [Sim/Nao] | [valor ou N/A] | {{descricao}} | {{exemplo}} |

#### Frontend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
| ENV-010 | {{VAR_NAME}} | [string/url] | [Sim/Nao] | [valor ou N/A] | {{descricao}} | {{exemplo}} |

#### Secrets (referencia SOMENTE, nunca valores)

| ID | Nome | Formato | Obrigatoria | Descricao |
|:---|:---|:---|:---|:---|
| SEC-001 | {{SECRET_NAME}} | [min 32 chars / path / etc] | [Sim/Nao] | {{para que serve}} |

EXEMPLO BOM:
#### Backend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
| ENV-001 | ORDERS_MAX_VALUE | int | Nao | 10000 | Valor maximo sem aprovacao manual | 10000 |
| ENV-002 | ORDERS_CACHE_TTL | int | Nao | 300 | TTL do cache de pedidos (segundos) | 300 |

#### Frontend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
| ENV-010 | NEXT_PUBLIC_API_URL | url | Sim | N/A | URL base da API | https://api.example.com |

#### Secrets

| ID | Nome | Formato | Obrigatoria | Descricao |
|:---|:---|:---|:---|:---|
| SEC-001 | STRIPE_SECRET_KEY | sk_live_* (min 32 chars) | Sim | Chave secreta do Stripe |
| SEC-002 | JWT_SECRET | min 32 chars | Sim | Secret para assinatura de JWT |

EXEMPLO RUIM:
"Configurar variaveis de ambiente necessarias"
(Faltam: nomes, tipos, defaults, exemplos, secrets)

ANTI-PATTERNS:
- Documentar valor real de secrets/API keys
- Variavel sem descricao
- Nao distinguir backend de frontend
- Nao documentar formato esperado de secrets
-->

#### Backend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
{{BACKEND_ENV_VARS}}
<!-- ADICIONAR LINHAS CONFORME NECESSARIO -->

#### Frontend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
{{FRONTEND_ENV_VARS}}
<!-- ADICIONAR LINHAS CONFORME NECESSARIO -->

#### Secrets (referencia SOMENTE, nunca valores)

| ID | Nome | Formato | Obrigatoria | Descricao |
|:---|:---|:---|:---|:---|
{{SECRETS_REF}}
<!-- ADICIONAR LINHAS CONFORME NECESSARIO -->

---

## 5. Lógica de negócio e algoritmos principais [Obrigatório]

### 5.1 Fluxo principal [Obrigatório]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Descrever passo a passo do "caminho feliz"
FORMATO: Lista numerada de passos
REGRAS:
- Passos observáveis e testáveis
- Decisões binárias claras (se X então Y)
- Validações explicitadas
- Ordem lógica preservada

EXEMPLO BOM:
1. Receber requisição de criação de pedido.
2. **Validação:** Verificar se todos os produtos existem no catálogo (via ProductService).
   - *Se algum produto não existir:* Retornar Erro `ProductNotFound`.
3. **Validação:** Verificar disponibilidade de estoque para cada item (via InventoryService).
   - *Se estoque insuficiente:* Retornar Erro `InsufficientStock`.
4. Calcular valor total do pedido (soma de quantity * unitPrice).
5. **Validação:** Se total > 10.000, exigir aprovação manual.
   - *Se sem aprovação:* Status = `REVIEW_PENDING`.
   - *Se aprovado ou total < 10.000:* Status = `PENDING_PAYMENT`.
6. Salvar pedido no banco (via OrderRepository).
7. Publicar evento `OrderCreated` no message broker.
8. Retornar 201 Created com orderId e status.

EXEMPLO RUIM:
1. Criar pedido
2. Validar
3. Salvar no banco
4. Publicar evento
(Passos genéricos, sem decisões, sem validações específicas)

ANTI-PATTERNS:
- "Processar pedido" (muito vago)
- "Fazer validações" (quais validações?)
- Não documentar tratamentos de erro
-->

{{MAIN_FLOW_CONTENT}}

### 5.2 Casos extremos [Obrigatório]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Documentar edge cases e exceções
FORMATO: Lista de regras com condições e ações
REGRAS:
- Regras de negócio específicas
- Tratamento de falhas
- Retry policies
- Timeout strategies

EXEMPLO BOM:
- **Regra de Negócio:** Se valor total > 10.000, status = `REVIEW_PENDING` e requer aprovação manual.
- **Concorrência:** Se múltiplas requisições para mesmo produto simultaneamente, usar optimistic locking (version field).
- **Retry:** Se PaymentService falhar (5xx), tentar 3 vezes com backoff exponencial (1s, 2s, 4s).
- **Timeout:** Se InventoryService não responder em 3s, falhar com `InventoryTimeout` error.
- **Data Consistency:** Se pagamento falhar após pedido criado, publicar `OrderFailed` e reverter estoque (compensating transaction).

EXEMPLO RUIM:
- Tratar erros
- Tentar novamente se falhar
- Validar inputs
(Genérico, sem números, sem ações específicas)

ANTI-PATTERNS:
- "Tratar gracefulmente" (o que isso significa?)
- "Fazer retry" (quantas vezes? com que backoff?)
- Não documentar compensating transactions
-->

{{EDGE_CASES_CONTENT}}
<!-- ADICIONAR CASOS EXTREMOS CONFORME NECESSÁRIO -->

---

## 6. Observability & Operational Readiness [Se aplicável]

### 6.1 Logging & Tracing

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir o que deve ser logado
FORMATO: Lista de eventos de log com nível e contexto
REGRAS:
- Níveis apropriados (ERROR, WARN, INFO, DEBUG)
- Contexto relevante (quais dados incluir)
- NUNCA logar dados sensíveis (senha, token, cartão)
- Sempre incluir correlationId

EXEMPLO BOM:
- **Level:** INFO | **When:** Pedido criado com sucesso | **Context:** orderId, customerId, totalAmount, correlationId
- **Level:** ERROR | **When:** Falha no pagamento | **Context:** orderId, errorCode, errorMessage, correlationId (NUNCA logar detalhes do cartão)
- **Level:** WARN | **When:** Estoque baixo (< 10 unidades) | **Context:** productId, currentStock, correlationId
- **Level:** DEBUG | **When:** Início do processamento | **Context:** orderId, step, correlationId

EXEMPLO RUIM:
- Logar erros
- Logar quando pedido for criado
(Faltam: nível, contexto, o que especificamente logar)

ANTI-PATTERNS:
- Logar dados sensíveis (password, token, credit card)
- Logar sem contexto (qual orderId?)
- Usar nivel errado (ERROR para algo esperado)
-->

{{LOGGING_CONTENT}}

### 6.2 Métricas (KPIs) [Se aplicável]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir métricas a serem emitidas
FORMATO: Lista de métricas com tipo e descrição
REGRAS:
- Tipos: Counter (incrementos), Gauge (valor atual), Histogram (distribuição)
- Nomes descritivos
- Units quando aplicável

EXEMPLO BOM:
- `orders_created_total` (Counter): Total de pedidos criados
- `order_amount_histogram` (Histogram): Distribuição de valores de pedidos (em USD)
- `payment_processing_duration_seconds` (Histogram): Tempo de processamento de pagamento
- `inventory_check_failures_total` (Counter): Total de falhas em checagem de estoque

EXEMPLO RUIM:
- Métricas de pedidos
- Tempo de processamento
(Faltam: tipo, nome específico, unidade)

ANTI-PATTERNS:
- Métricas sem tipo
- Nomes genéricos ("metrics", "data")
- Não especificar unidade (seconds vs milliseconds)
-->

{{METRICS_CONTENT}}

---

## 7. Segurança & Compliance [Se aplicável]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Documentar requisitos de segurança
FORMATO: Lista de requisitos ou tabela
REGRAS:
- Autenticação/autorização necessária
- Dados sensíveis identificados
- Criptografia aplicada onde necessário
- Input sanitization

EXEMPLO BOM:
- **Authentication:** Endpoints requerem JWT Bearer token com role `customer` ou `admin`.
- **Authorization:** DELETE /orders/{id} requer role `admin` ou ser o dono do pedido (customerId == userId).
- **Data Privacy:** Campos `cpf` e `creditCardNumber` devem ser criptografados em repouso (AES-256).
- **Input Sanitization:** Todos os campos de texto devem ser sanitizados contra XSS e SQL Injection.
- **Criticidade:** Alta (envolve dados financeiros).
- **Recomendação:** Rate limiting de 10 req/min por IP para criação de pedidos.

EXEMPLO RUIM:
- Requer autenticação
- Criptografar dados sensíveis
- Sanitizar inputs
(Faltam: qual tipo de auth? quais dados? como sanitizar?)

ANTI-PATTERNS:
- "Segurança necessária" (o quê?)
- "Criptografar tudo" (o que é criptografável?)
- Não especificar roles ou permissions
-->

{{SECURITY_CONTENT}}

---

## 8. Plano de Implementação [Obrigatório]

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Lista de passos técnicos implementáveis
FORMATO: Lista numerada de passos específicos
REGRAS:
- Máximo 10 passos
- Cada passo deve ser INDEPENDENTE (pode virar uma task)
- Passos devem ser MODULARES (não misturar camadas)
- Ordem lógica de execução
- Dependências entre passos explícitas

EXEMPLO BOM:
1. Create migration `20240301_create_orders_table.sql` with schema defined (section 3.1).
2. Create entity `Order.cs` in `/src/Domain/Orders/` following pattern from `User` entity.
3. Create interface `IOrderRepository.cs` in `/src/Infrastructure/Orders/`.
4. Implement `OrderRepository.cs` with Dapper (following pattern from `UserRepository`).
5. Create `CreateOrderCommand.cs` and `CreateOrderHandler.cs` using MediatR pattern (like `CreateUserHandler`).
6. Add FluentValidation validator `CreateOrderCommandValidator.cs`.
7. Create `OrdersController.cs` with POST /api/v1/orders endpoint.
8. Configure Serilog logging for Order flow (INFO on success, ERROR on failure).
9. Write integration tests for `OrderRepository` (following pattern from `UserRepositoryTests`).
10. Write unit tests for `CreateOrderHandler`.

EXEMPLO RUIM:
1. Criar models e repository
2. Criar endpoint
3. Adicionar validação
4. Escrever testes
(Passos genéricos, não modulares, misturam coisas)

ANTI-PATTERNS:
- "Implementar feature X" (muito vago)
- Misturar Database + Backend no mesmo passo (viola atomicidade)
- Não mencionar arquivos ou caminhos
- Passos dependentes não ordenados
- Mais de 10 passos (quebrar em sub-passos)

REGRAS DE ATOMICIDADE:
- Cada passo = UMA camada tecnológica
- Database (migrations, entities)
- Application (commands, handlers, validators)
- Infrastructure (repositories, external services)
- Interface (controllers, endpoints)
- Tests (unit, integration)
-->

{{IMPLEMENTATION_PLAN_CONTENT}}

---

**Template Version:** 0.3.0
