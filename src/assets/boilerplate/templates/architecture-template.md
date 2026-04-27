# ARCHITECTURE DEFINITION

**Scope:** Esta definição estabelece os invariantes técnicos do projeto.
Todas as features futuras devem respeitar estas decisões arquiteturais.

| Metadata | Details |
|:---|:---|
| **Status** | DRAFT |
| **Data** | {{DATA_ATUAL}} |
| **Nível de Profundidade** | {{HIGH_LEVEL|MEDIUM_DETAIL|COMPREHENSIVE}} |
<!-- Status: DRAFT to IN_PROGRESS to APPROVED -->

---

## 1. Paradigma Arquitetural

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir o estilo arquitetural fundamental do projeto
REGRA CRÍTICA: ZERO menções a regras de negócio ou funcionalidades específicas
-->

**Padrão Arquitetural Principal:**
* [Ex: Clean Architecture, Hexagonal Architecture, Onion Architecture, DDD, Microservices, Monolith]

**Justificativa da Escolha:**
* [Por que este padrão é adequado para o projeto?]

**Camadas Arquiteturais (se aplicável):**

| Camada | Responsabilidade | Regras de Dependência |
|:---|:---|:---|
| **[Nome da Camada 1]** | [O que essa camada faz?] | [Depende de quais camadas?] |
| **[Nome da Camada 2]** | [O que essa camada faz?] | [Depende de quais camadas?] |
| **[Nome da Camada 3]** | [O que essa camada faz?] | [Depende de quais camadas?] |

---

## 2. Stack Tecnológico

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir versões específicas de todas as tecnologias
REGRA: Seja extremamente específico (ex: ".NET 8" não ".NET")
-->

### 2.1. Backend

| Categoria | Tecnologia | Versão Específica | Justificativa |
|:---|:---|:---|:---|
| **Linguagem** | [Ex: C#, TypeScript, Python] | [Ex: C# 12, Python 3.11] | [Por quê?] |
| **Framework** | [Ex: ASP.NET Core, Express, FastAPI] | [Ex: 8.0, 4.18] | [Por quê?] |
| **ORM/Query Builder** | [Ex: Entity Framework, Prisma, Dapper] | [Ex: EF Core 8.0, Prisma 5.0] | [Por quê?] |
| **Validação** | [Ex: FluentValidation, Zod] | [Versão] | [Por quê?] |
| **Logging** | [Ex: Serilog, Winston, Pino] | [Versão] | [Por quê?] |

### 2.2. Frontend

| Categoria | Tecnologia | Versão Específica | Justificativa |
|:---|:---|:---|:---|
| **Framework** | [Ex: Vue.js, React, Angular] | [Ex: 3.4, 18.2, 16] | [Por quê?] |
| **Biblioteca de UI** | [Ex: shadcn-vue, MUI, Chakra] | [Versão] | [Por quê?] |
| **State Management** | [Ex: Pinia, Redux, Zustand] | [Versão] | [Por quê?] |
| **Formulários** | [Ex: VeeValidate, React Hook Form] | [Versão] | [Por quê?] |
| **Build Tool** | [Ex: Vite, Webpack, Turbopack] | [Versão] | [Por quê?] |
| **CSS Framework** | [Ex: TailwindCSS, Bootstrap] | [Versão] | [Por quê?] |

### 2.3. Banco de Dados

| Categoria | Tecnologia | Versão Específica | Justificativa |
|:---|:---|:---|:---|
| **Tipo** | [Ex: PostgreSQL, MySQL, MongoDB] | [Ex: 15.x, 8.0] | [Por quê?] |
| **ORM/Driver** | [Ex: Prisma, EF Core, Mongoose] | [Versão] | [Por quê?] |
| **Migrações** | [Ex: Prisma Migrate, EF Migrations] | [Versão] | [Por quê?] |
| **Pool de Conexões** | [Ex: PgBouncer, nativo] | [Config] | [Por quê?] |

### 2.4. Infraestrutura

| Categoria | Tecnologia | Versão Específica | Justificativa |
|:---|:---|:---|:---|
| **Cloud Provider** | [Ex: AWS, Azure, GCP, On-premise] | [Região] | [Por quê?] |
| **Containerização** | [Ex: Docker, Podman] | [Versão] | [Por quê?] |
| **Orquestração** | [Ex: Kubernetes, Docker Compose] | [Versão] | [Por quê?] |
| **Mensageria** | [Ex: RabbitMQ, Kafka, SQS] | [Versão] | [Por quê?] |
| **Cache** | [Ex: Redis, Memcached] | [Versão] | [Por quê?] |
| **Storage** | [Ex: S3, Azure Blob, MinIO] | [Config] | [Por quê?] |

---

## 3. Padrões de Design e Convenções

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir como o código deve ser escrito
REGRA: Seja específico e forneça exemplos quando possível
-->

### 3.1. Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|:---|:---|:---|
| **Classes/Entities** | [Ex: PascalCase] | `UserRepository`, `OrderService` |
| **Métodos/Funções** | [Ex: PascalCase ou camelCase] | `CreateUser()`, `getUser()` |
| **Variáveis Locais** | [Ex: camelCase] | `userId`, `orderTotal` |
| **Constantes** | [Ex: UPPER_SNAKE_CASE] | `MAX_RETRY_COUNT` |
| **Interfaces** | [Ex: I prefix ou sem sufixo] | `IUserRepository` ou `UserRepository` |
| **Tabelas (BD)** | [Ex: snake_case plural] | `users`, `order_items` |
| **Colunas (BD)** | [Ex: snake_case] | `created_at`, `user_id` |

### 3.2. Padrões Arquiteturais Específicos

**Injeção de Dependência:**
* [Ex: Constructor injection, Method injection, Property injection]
* **Exemplo:**
  ```csharp
  // Constructor injection (recomendado)
  public class UserService {
      private readonly IUserRepository _repository;
      public UserService(IUserRepository repository) {
          _repository = repository;
      }
  }
  ```

**Tratamento de Erros:**
* [Ex: Exceptions, Result types, Either monad]
* **Convenção:**
  * [Ex: "Lançar domain exception para erros de negócio"]
  * [Ex: "Retornar Result<T> para erros recuperáveis"]

**Validação:**
* [Ex: FluentValidation, Zod, manual decorators]
* **Onde validar:**
  * [Ex: "Validação de input em controllers/handlers"]
  * [Ex: "Validação de domínio em entities/value objects"]

**Logging:**
* [Ex: Structured logging com Serilog]
* **Níveis:**
  * [Ex: "DEBUG: detalhes de implementação"]
  * [Ex: "INFO: eventos de negócio importantes"]
  * [Ex: "ERROR: falhas que requerem atenção"]
* **Campos obrigatórios:**
  * [Ex: "CorrelationId, UserId, Action, ErrorCode"]

---

{{IF MEDIUM_DETAIL OR COMPREHENSIVE}}

## 4. Estrutura de Diretórios

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir como o código é organizado no filesystem
REGRA: Use árvore de diretórios ou lista indentada
-->

### 4.1. Estrutura Backend

```
src/
├── Domain/                    [Entidades e Value Objects]
│   ├── Entities/              [Entidades de domínio]
│   ├── ValueObjects/          [Value objects]
│   └── Events/                [Domain events]
├── Application/               [Use Cases e Application Logic]
│   ├── Commands/              [Command CQRS]
│   ├── Queries/               [Query CQRS]
│   ├── Handlers/              [Handlers]
│   └── DTOs/                  [Data Transfer Objects]
├── Infrastructure/            [Implementações concretas]
│   ├── Persistence/           [Repositories, DB context]
│   ├── ExternalServices/      [Integrações externas]
│   └── Messaging/             [Message brokers]
└── Interface/                 [Controllers, APIs, Presenters]
    ├── Controllers/           [HTTP endpoints]
    └── Presenters/            [Response formatting]
tests/
├── Unit/                      [Testes de unidade]
├── Integration/               [Testes de integração]
└── E2E/                       [Testes end-to-end]
```

### 4.2. Estrutura Frontend

```
src/
├── components/                [Componentes reutilizáveis]
│   ├── ui/                    [Componentes base]
│   └── features/              [Componentes específicos]
├── composables/               [Vue Composition API hooks]
├── stores/                    [State management (Pinia)]
├── router/                    [Rotas e navegação]
├── services/                  [API clients, business logic]
├── utils/                     [Helpers, formatters]
├── types/                     [TypeScript types/interfaces]
└── assets/                    [Imagens, fontes, styles globais]
```

**Regras de Organização:**
* [ ] **Regra 1:** [Ex: "Features que compartilham código ficam em /shared"]
* [ ] **Regra 2:** [Ex: "Cada feature tem seu próprio diretório"]

{{END_IF}}

---

{{IF MEDIUM_DETAIL OR COMPREHENSIVE}}

## 5. Contratos e Interfaces Padrão

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir padrões de APIs e comunicação entre componentes
-->

### 5.1. Contratos de API (REST)

**Versionamento:**
* [Ex: "Versionamento por URL: /api/v1/resource"]

**Padrão de Respostas:**

**Success Response (200/201):**
```json
{
  "data": { /* ou [/* array */] },
  "meta": {
    "timestamp": "2024-03-01T10:00:00Z",
    "correlationId": "uuid-v4"
  }
}
```

**Error Response (4xx/5xx):**
```json
{
  "error": {
    "code": "ERROR_CODE_ENUM",
    "message": "Human-readable message",
    "details": { /* contexto adicional */ }
  },
  "meta": {
    "timestamp": "2024-03-01T10:00:00Z",
    "correlationId": "uuid-v4"
  }
}
```

**Status Codes Padrão:**
* `200 OK`: [Quando usar?]
* `201 Created`: [Quando usar?]
* `204 No Content`: [Quando usar?]
* `400 Bad Request`: [Quando usar?]
* `401 Unauthorized`: [Quando usar?]
* `403 Forbidden`: [Quando usar?]
* `404 Not Found`: [Quando usar?]
* `422 Unprocessable Entity`: [Quando usar?]
* `500 Internal Server Error`: [Quando usar?]

### 5.2. Padrões de Mensageria (se aplicável)

**Formato de Mensagens:**
```json
{
  "messageId": "uuid-v4",
  "eventType": "OrderCreated",
  "timestamp": "2024-03-01T10:00:00Z",
  "data": { /* payload do evento */ },
  "metadata": {
    "correlationId": "uuid-v4",
    "causationId": "uuid-v4"
  }
}
```

**Convenções de Nomenclatura:**
* [Ex: "Eventos no passado: OrderCreated, PaymentFailed"]
* [Ex: "Comandos no imperativo: CreateOrder, ProcessPayment"]

**Topics/Queues Padrão:**
* [Ex: "Events: {Aggregate}.{Action}"]
* [Ex: "Commands: {Domain}.command.{Action}"]

{{END_IF}}

---

{{IF COMPREHENSIVE}}

## 6. Pipeline de CI/CD

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir estratégia de integração contínua e deploy
-->

### 6.1. Pipeline de CI

**Ferramenta:**
* [Ex: GitHub Actions, GitLab CI, Azure DevOps]

**Estágios Obrigatórios:**

| Estágio | O que Faz | Ferramentas |
|:---|:---|:---|
| **Lint** | [Validação de código e estilo] | [Ex: ESLint, StyleCop] |
| **Type Check** | [Validação de tipos estáticos] | [Ex: tsc, csc] |
| **Unit Tests** | [Testes de unidade] | [Ex: xUnit, Jest] |
| **Integration Tests** | [Testes de integração] | [Ex: TestContainers] |
| **Build** | [Compilação e empacotamento] | [Ex: Docker build] |
| **Security Scan** | [Varredura de vulnerabilidades] | [Ex: Snyk, OWASP] |

**Critérios de Sucesso:**
* [ ] [Ex: "Coverage mínimo: 80%"]
* [ ] [Ex: "Zero erros de lint"]
* [ ] [Ex: "Zero vulnerabilidades críticas"]

### 6.2. Pipeline de CD

**Estratégia de Deploy:**
* [Ex: "Continuous Delivery: deploy manual em staging, automático em produção"]

**Ambientes:**

| Ambiente | Propósito | Deploy Trigger | URL |
|:---|:---|:---|:---|
| **Development** | [Desenvolvimento local] | [Ex: Docker Compose local] | [localhost] |
| **Staging** | [Testes de aceitação] | [Ex: Auto em merge em main] | [staging.example.com] |
| **Production** | [Produção] | [Ex: Manual pós-staging] | [app.example.com] |

**Estratégia de Rollback:**
* [Ex: "Reverter para versão anterior em caso de erro crítico"]
* [Ex: "Blue-green deployment para zero downtime"]

---

## 7. Estratégia de Observabilidade

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir como monitorar e debugar a aplicação em produção
-->

### 7.1. Logging

**Ferramenta:**
* [Ex: Serilog + Elasticsearch/Kibana, CloudWatch]

**Estrutura de Log:**
```json
{
  "timestamp": "2024-03-01T10:00:00Z",
  "level": "INFO",
  "message": "User created order",
  "context": {
    "userId": "uuid-v4",
    "orderId": "uuid-v4",
    "correlationId": "uuid-v4",
    "action": "CreateOrder"
  }
}
```

**Logs Obrigatórios:**
* [ ] [Ex: "Todo request HTTP com correlationId"]
* [ ] [Ex: "Todo erro com stack trace e contexto"]
* [ ] [Ex: "Eventos de negócio críticos"]

### 7.2. Métricas

**Ferramenta:**
* [Ex: Prometheus + Grafana, DataDog, CloudWatch]

**Métricas Padrão:**

| Categoria | Métricas Exemplo |
|:---|:---|
| **Application** | [Ex: request_count, request_duration, error_count] |
| **Business** | [Ex: orders_created, users_registered, payment_success_rate] |
| **Infrastructure** | [Ex: cpu_usage, memory_usage, disk_io] |

**Alertas Configurados:**
* [ ] [Ex: "Erro rate > 5% em 5min"]
* [ ] [Ex: "Latência P95 > 1s em 5min"]
* [ ] [Ex: "CPU > 80% por 10min"]

### 7.3. Distributed Tracing

**Ferramenta:**
* [Ex: OpenTelemetry, Jaeger, AWS X-Ray]

**O que Traçar:**
* [ ] [Ex: "Requests HTTP com propagação de contexto"]
* [ ] [Ex: "Mensagens assíncronas com correlationId"]
* [ ] [Ex: "Queries de banco de dados lentas"]

{{END_IF}}

---

## 8. Padrões de Testes

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir estratégia de testes
-->

### 8.1. Pirâmide de Testes

| Tipo | Percentual Alvo | Exemplo |
|:---|:---:|:---|
| **Unit Tests** | [Ex: 70%] | [Testar handlers, services em isolamento] |
| **Integration Tests** | [Ex: 20%] | [Testar repositories, APIs externas] |
| **E2E Tests** | [Ex: 10%] | [Testar fluxos críticos de usuário] |

### 8.2. Ferramentas de Teste

| Categoria | Ferramenta | Versão |
|:---|:---|:---|
| **Framework** | [Ex: xUnit, Jest, Pytest] | [Versão] |
| **Mocks** | [Ex: Moq, unittest.mock] | [Versão] |
| **Assertions** | [Ex: FluentAssertions, chai] | [Versão] |
| **Test Containers** | [Ex: TestContainers, Docker] | [Versão] |

### 8.3. Convenções de Testes

**Nomenclatura de Testes:**
* [Ex: "MethodName_Scenario_ExpectedResult"]

**Exemplo:**
```csharp
[Fact]
public void CreateOrder_WithValidInput_ReturnsSuccess()
{
    // Arrange
    // Act
    // Assert
}
```

**Setup/Teardown:**
* [Ex: "Usar fixtures para setup comum"]
* [Ex: "Cada teste deve ser independente"]

---

## 9. Segurança

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir padrões de segurança
-->

### 9.1. Autenticação e Autorização

**Autenticação:**
* [Ex: "JWT com refresh tokens"]
* [Ex: "OAuth 2.0 / OpenID Connect"]

**Autorização:**
* [Ex: "Role-based access control (RBAC)"]
* [Ex: "Claims-based authorization"]

**Escopos de Acesso:**
* [ ] [Ex: "Admin: acesso total"]
* [ ] [Ex: "User: acesso aos próprios recursos"]
* [ ] [Ex: "Guest: acesso somente leitura"]

### 9.2. Proteção de Dados

**Dados Sensíveis:**
* [Ex: "Senhas hasheadas com Argon2id"]
* [Ex: "PII criptografado em repouso (AES-256)"]
* [Ex: "Logs não podem conter dados sensíveis"]

**Comunicação:**
* [Ex: "HTTPS obrigatório em todos os ambientes"]
* [Ex: "TLS 1.3+"]

### 9.3. Validação de Input

**Regras Padrão:**
* [ ] [Ex: "Validar tipo, tamanho e formato de todo input"]
* [ ] [Ex: "Sanitizar HTML para prevenir XSS"]
* [ ] [Ex: "Parametrizar queries para prevenir SQL injection"]

---

## 10. Governança e Convenções de Repositório

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Definir como o time trabalha com o repositório
-->

### 10.1. Estrutura de Branches

| Branch | Propósito | Regras |
|:---|:---|:---|
| **main** | [Produção] | [Ex: Protegido, requer PR + aprovação] |
| **develop** | [Integração] | [Ex: Deploy automático em staging] |
| **feature/*** | [Novas features] | [Ex: Criar a partir de develop] |

### 10.2. Padrões de Commit

**Convenção:**
* [Ex: "Conventional Commits: type(scope): description"]

**Tipos de Commit:**
* `feat`: Nova funcionalidade
* `fix`: Bug fix
* `refactor`: Refatoração
* `test`: Adicionar/atualizar testes
* `docs`: Documentação
* `chore`: Manutenção

**Exemplo:**
```
feat(auth): implement JWT token refresh

- Add refresh token endpoint
- Update token validation logic
- Add integration tests
```

### 10.3. Pull Request Guidelines

**Template de PR:**
```markdown
## Descrição
[Breve descrição da mudança]

## Tipo de Mudança
- [ ] Bug fix
- [ ] Feature
- [ ] Breaking change
- [ ] Refatoração

## Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] Código segue convenções
- [ ] Tests passando
- [ ] Documentação atualizada
- [ ] Sem conflitos de merge
```

**Critérios de Aprovação:**
* [ ] [Ex: "Pelo menos 1 approval de senior dev"]
* [ ] [Ex: "CI passando"]
* [ ] [Ex: "Coverage não diminuiu"]

---

## 11. Não-Goals (O que NÃO faremos)

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Explicitar escolhas arquiteturais que foram deliberadamente excluídas
-->

**Tecnologias/Abordagens Excluídas:**

| Tecnologia/Abordagem | Por que NÃO usar? |
|:---|:---|
| **[Ex: MongoDB]** | [Ex: "Requerimentos de consistência transacional forte"] |
| **[Ex: Microservices]** | [Ex: "Projeto inicial, complexidade não justificada"] |
| **[Ex: GraphQL]** | [Ex: "Time não tem experiência, REST é suficiente"] |

**Anti-Padrões Proibidos:**
* [ ] [Ex: "NUNCA misturar camadas (ex: domain chamando infrastructure)"]
* [ ] [Ex: "NUNCA retornar entidades de domínio direto da API"]
* [ ] [Ex: "NUNCA fazer lógica de negócio em controllers"]

---

## 12. Integrações Externas

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Mapear APIs de terceiros, serviços e dependências externas
REGRA: Documentar tipo, versão, autenticação e uso no sistema
-->

### 12.1. APIs de Terceiros

| Serviço | Tipo | Versão | Autenticação | Rate Limit | Observações |
|:---|:---|:---|:---|:---|:---|
| **[Ex: Stripe]** | [Payment] | [v2023-10-01] | [API Key Secret] | [100 req/min] | [Webhooks em /api/webhooks/stripe] |
| **[Ex: SendGrid]** | [Email] | [v7.7] | [API Key] | [Sem limite] | [Templates transactionais] |
| **[AWS S3]** | [Storage] | [v3.450] | [Access Key + Secret] | [N/A] | [Presigned URLs para uploads] |

### 12.2. Webhooks e Callbacks

| Webhook | Fonte | Endpoint | Eventos | Segurança |
|:---|:---|:---|:---|:---|
| **[Ex: Stripe]** | [Stripe Dashboard] | [/api/webhooks/stripe] | [payment_intent.succeeded, payment_intent.failed] | [Signature verification] |
| **[Ex: GitHub]** | [GitHub App] | [/api/webhooks/github] | [push, pull_request] | [HMAC SHA256] |

### 12.3. Rate Limiting e Retries

| Serviço | Rate Limit | Retry Strategy | Backoff | Circuit Breaker |
|:---|:---|:---|:---|:---|
| **[Ex: Stripe API]** | [100 req/min] | [3 retries] | [Exponential: 1s, 2s, 4s] | [Sim: opossum] |
| **[Ex: Redis]** | [10.000 req/min] | [Não aplicável] | [Não aplicável] | [Não] |

---

## 13. Maturidade de Testes

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Avaliar qualidade e cobertura de testes existentes
-->

### 13.1. Framework de Testes

| Categoria | Framework | Versão | Configuração |
|:---|:---|:---|:---|
| **Framework Principal** | [Ex: Jest] | [v29.7] | [jest.config.js] |
| **Assertion Library** | [Ex: Testing Library] | [v5.1] | [@testing-library/dom] |
| **Mocks/Fixtures** | [Ex: Faker.js] | [v8.4] | [__tests__/fixtures] |
| **Coverage Tool** | [Ex: Istanbul/nyc] | [Built-in] | [coverageThreshold: 70%] |

### 13.2. Tipos de Testes

| Tipo | Percentual Alvo | Localização | Observações |
|:---|:---:|:---|:---|
| **Unit Tests** | [70%] | [/tests/unit/] | [Testam handlers, services em isolamento] |
| **Integration Tests** | [20%] | [/tests/integration/] | [Testam repositories, APIs externas] |
| **E2E Tests** | [10%] | [/tests/e2e/, cypress/] | [Testam fluxos críticos de usuário] |

### 13.3. Métricas de Cobertura

| Métrica | Valor Atual | Meta | Status |
|:---|:---|:---|:---:|
| **Statements** | [62%] | [80%] | [[WARNING] Abaixo da meta] |
| **Branches** | [54%] | [80%] | [[X] Crítico] |
| **Functions** | [65%] | [80%] | [[WARNING] Abaixo da meta] |
| **Lines** | [62%] | [80%] | [[WARNING] Abaixo da meta] |

### 13.4. Nível de Maturidade

**Classificação:**
- [ ] **BÁSICO** - Framework configurado, poucos testes
- [ ] **INTERMEDIÁRIO** - Framework + unit + integration, cobertura parcial
- [ ] **AVANÇADO** - Framework + todos os tipos, cobertura alta (>80%)

**Status Atual:** [INTERMEDIÁRIO]
```
[OK] Framework configurado (Jest v29.7)
[OK] Testes de unidade presentes (/tests/unit)
[OK] Testes de integração presentes (/tests/integration)
[WARNING]  Coverage abaixo de 70% (atual: 62%)
[X] Ausência de testes E2E completos
```

---

## 14. Domínio Inferido (DDD)

<!-- INSTRUÇÕES DE PREENCHIMENTO:
OBJETIVO: Documentar elementos de Domain-Driven Design detectados no código
REGRA: Atribuir níveis de confiança a cada inferência
-->

### 14.1. Bounded Contexts

| Contexto | Confiança | Descrição | Aggregates |
|:---|:---:|:---|:---|
| **[Users]** | [85%] | [Gestão de usuários e autenticação] | [User] |
| **[Orders]** | [72%] | [Ciclo de vida de pedidos] | [Order, OrderItem] |
| **[Payments]** | [40%] | [Processamento de pagamentos] | [Payment - anêmico] |

### 14.2. Aggregates e Entities

| Aggregate | Confiança | Root Entity | Value Objects | Invariants |
|:---|:---:|:---|:---|:---|
| **[User]** | [90%] | [User] | [Email, CPF] | [Email único, CPF válido] |
| **[Order]** | [85%] | [Order] | [Money, Address] | [Total > 0, Status transitions válidas] |
| **[Payment]** | [50%] | [Payment] | [CardNumber] | [Pouca lógica de domínio] |

### 14.3. Value Objects

| Value Object | Confiança | Tipo | Imutável | Observações |
|:---|:---:|:---|:---:|:---|
| **[Email]** | [95%] | [record C#] | [[OK]] | [Validação de formato] |
| **[CPF]** | [88%] | [record C#] | [[OK]] | [Validação de dígito] |
| **[Money]** | [N/A] | [decimal] | [[X]] | [Usa decimal simples] |
| **[Address]** | [70%] | [class] | [[X]] | [Deveria ser imutável] |

### 14.4. Domain Events

| Evento | Confiança | Dispatcher | Handler | Quando Ocorre |
|:---|:---:|:---|:---|:---|
| **[UserCreated]** | [80%] | [MediatR] | [SendWelcomeEmail] | [Após registro bem-sucedido] |
| **[OrderPaid]** | [82%] | [MediatR] | [UpdateOrderStatus] | [Após confirmação do Stripe] |

### 14.5. Repositories

| Repository | Confiança | Implementação | ORM | Observações |
|:---|:---:|:---|:---|:---|
| **[IUserRepository]** | [92%] | [DapperUserRepository] | [Dapper] | [Interface em Domain] |
| **[IOrderRepository]** | [92%] | [DapperOrderRepository] | [Dapper] | [Interface em Domain] |
| **[IPaymentRepository]** | [40%] | [Não implementada] | [N/A] | [Apenas interface] |

### 14.6. Nível de Maturidade DDD

**Classificação:**
- [ ] **INICIANTE** - Poucos elementos DDD, código anêmico
- [ ] **INTERMEDIÁRIO** - Bounded contexts, aggregates, events parciais
- [ ] **AVANÇADO** - DDD completo com todos os elementos

**Status Atual:** [INTERMEDIÁRIO]
```
[OK] Bounded contexts definidos (Users, Orders, Payments)
[OK] Aggregates e entities identificadas
[WARNING]  Value_objects parciais (nem todos imutáveis)
[OK] Domain events implementados via MediatR
[OK] Repositories pattern aplicado
[WARNING]  Alguns serviços de domínio em camada errada
[X] Faltam: Specifications, Domain Services explícitos
```

---

**Notas de Decisão:**
<!--
Documente aqui decisões técnicas importantes e o porquê.
Exemplo: "Escolhemos Prisma sobre TypeORM porque type-safety é prioridade"
-->

---

**Validação de Qualidade (Zero-Business Check):**
- [ ] Zero menções a funcionalidades específicas do produto
- [ ] Zero menções a regras de negócio ou user stories
- [ ] Zero menções a personas ou comportamentos de usuário
- [ ] Todo conteúdo focado em decisões técnicas e implementação
- [ ] Versões específicas definidas para todas as tecnologias

---

**Template Version:** 0.2.0
**Command:** `/gerar-visao` - Fase Técnica | `/gerar-contexto` - Brownfield Analysis
