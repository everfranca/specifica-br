# Observabilidade e Testes

Referência técnica para logging, métricas, tracing e estratégia de testes ao gerar Tech Specs.

## Sumário

1. [Logging Estruturado](#1-logging-estruturado)
2. [Métricas](#2-metricas)
3. [Distributed Tracing](#3-distributed-tracing)
4. [Estratégia de Testes](#4-estrategia-de-testes)
5. [Testes por Camada](#5-testes-por-camada)
6. [Dados de Teste](#6-dados-de-teste)
7. [Checklist de Observabilidade](#7-checklist-de-observabilidade)
8. [Checklist de Testes](#8-checklist-de-testes)

---

## 1. Logging Estruturado

### 1.1. Níveis de Log

| Nível | Quando usar | Exemplo |
|:---|:---|:---|
| **ERROR** | Falha que afeta o usuário ou dados | Pagamento rejeitado, DB indisponível |
| **WARN** | Situação inesperada, recuperável | Retry com sucesso, estoque baixo |
| **INFO** | Evento de negócio significativo | Pedido criado, usuário registrado |
| **DEBUG** | Informação de depuração (desligar em prod) | Query executada, payload recebido |

### 1.2. Contexto Obrigatório

Todo log deve incluir:
```
{
  "timestamp": "2024-03-01T10:00:00.000Z",
  "level": "INFO",
  "message": "Order created successfully",
  "context": {
    "orderId": "uuid",
    "customerId": "uuid",
    "totalAmount": 99.99,
    "correlationId": "uuid"
  },
  "service": "order-service",
  "environment": "production",
  "version": "1.2.0"
}
```

### 1.3. Padrões de Log por Evento

**Criação de recurso (sucesso):**
```
Level: INFO
Message: "Order created successfully"
Context: { orderId, customerId, totalAmount, itemCount, correlationId }
```

**Falha de processamento:**
```
Level: ERROR
Message: "Payment processing failed"
Context: { orderId, paymentId, errorCode, errorMessage, correlationId }
NUNCA: { creditCardNumber, cvv, password }
```

**Retry:**
```
Level: WARN
Message: "Retrying payment processing (attempt 2/3)"
Context: { orderId, attempt, backoffMs, correlationId }
```

**Performance:**
```
Level: INFO
Message: "Slow query detected"
Context: { query, durationMs, threshold, correlationId }
```

### 1.4. Dados Sensíveis - NUNCA Logar

| Dado | Log como | Exemplo |
|:---|:---|:---|
| Password | NÃO logar | - |
| Token JWT | NÃO logar | - |
| CPF | Mascaraar | "***.***.***-**" |
| Email | Mascarar | "j***@example.com" |
| Cartão | NÃO logar | - |
| API Key | NÃO logar | - |

---

## 2. Métricas

### 2.1. Frameworks RED e USE

**RED (para services/requests):**
| Métrica | Tipo | Descrição |
|:---|:---|:---|
| **Rate** | Counter | Requests por segundo |
| **Errors** | Counter | Taxa de erros |
| **Duration** | Histogram | Distribuição de latência |

**USE (para recursos):**
| Métrica | Tipo | Descrição |
|:---|:---|:---|
| **Utilization** | Gauge | % de uso do recurso |
| **Saturation** | Gauge | Fila/espera do recurso |
| **Errors** | Counter | Erros do recurso |

### 2.2. Métricas por Feature

**Para APIs/Endpoints:**
```
- orders_created_total (Counter): Total de pedidos criados
- orders_failed_total (Counter): Total de pedidos que falharam (by reason)
- order_creation_duration_seconds (Histogram): Tempo de criação do pedido
- order_amount_histogram (Histogram): Distribuição de valores de pedidos
```

**Para Processamento Assíncrono:**
```
- payment_processing_duration_seconds (Histogram): Tempo de processamento
- payment_queue_depth (Gauge): Mensagens na fila de pagamento
- payment_retry_total (Counter): Total de retries de pagamento
- payment_dead_letter_total (Counter): Mensagens na dead letter queue
```

**Para Banco de Dados:**
```
- db_query_duration_seconds (Histogram): Tempo de queries (by operation)
- db_connection_pool_active (Gauge): Conexões ativas
- db_connection_pool_idle (Gauge): Conexões idle
- db_query_errors_total (Counter): Erros de query (by type)
```

### 2.3. Nomenclatura

**Formato:** `{namespace}_{subsystem}_{metric_name}_{unit}`

```
orders_creation_duration_seconds
payments_processing_errors_total
inventory_stock_level_current
```

**Labels úteis:**
```
orders_created_total{ status="success" | "failed" }
payment_duration_seconds{ gateway="stripe" | "pagarme" }
api_request_duration_seconds{ method="GET", path="/api/v1/orders", status="200" }
```

### 2.4. Alertas

Na TechSpec, definir alertas críticos:

```
Alertas:
- Error rate > 5% por 5 minutos → PagerDuty (critical)
- Latência p99 > 2s por 5 minutos → Slack (warning)
- Queue depth > 1000 por 10 minutos → Slack (warning)
- DB connection pool > 80% → Slack (warning)
- Payment success rate < 95% → PagerDuty (critical)
```

---

## 3. Distributed Tracing

### 3.1. Correlation ID

**Obrigatório para:**
- Todas as APIs (inbound request → response)
- Todas as mensagens/events (publish → consume)
- Todas as chamadas a serviços externos
- Todos os logs

**Implementação:**
```
1. Gerar correlationId no entry point (API gateway / controller)
2. Propagar via header: X-Request-Id ou X-Correlation-Id
3. Incluir em todos os logs
4. Incluir em respostas de erro (para suporte)
5. Propagar para mensagens/events
6. Propagar para chamadas externas
```

### 3.2. Na TechSpec

```
Tracing:
- Correlation ID: UUID v4 gerado no controller/middleware
- Header: X-Request-Id (inbound), X-Correlation-Id (outbound)
- Propagação: Todos os logs, eventos, chamadas externas
- Error response: Incluir requestId no body (para suporte)
- Framework: OpenTelemetry (se configurado) ou manual

Span Tree (exemplo para criação de pedido):
[API] POST /orders (correlationId: uuid)
  → [Application] CreateOrderHandler
    → [Infrastructure] OrderRepository.AddAsync
    → [Infrastructure] ProductRepository.ValidateStock
    → [Infrastructure] EventBus.Publish(OrderCreated)
  → [API] Response 201
```

---

## 4. Estratégia de Testes

### 4.1. Pirâmide de Testes

```
        /  E2E  \          Poucos, lentos, caros
       /Integration \      Alguns, médios
      /   Unit Tests  \    Muitos, rápidos, baratos
```

| Tipo | Quantidade | Velocidade | Custo | O que testa |
|:---|:---|:---|:---|:---|
| **Unit** | 70% | < 100ms | Baixo | Lógica isolada (entities, handlers, validators) |
| **Integration** | 20% | < 5s | Médio | Repositories, serviços com DB real |
| **E2E** | 10% | < 30s | Alto | Fluxos completos (API → DB → Response) |

### 4.2. Cobertura por Criticidade

| Criticidade | Coverage Mínimo | O que é obrigatório |
|:---|:---|:---|
| **Crítica** (pagamento, auth) | 90% | Unit + Integration + E2E |
| **Alta** (CRUD principal) | 80% | Unit + Integration |
| **Média** (listagens, filtros) | 70% | Unit + alguns Integration |
| **Baixa** (utils, helpers) | 60% | Unit |

---

## 5. Testes por Camada

### 5.1. Domain (Unit)

**O que testar:**
- Entidades: criação com dados válidos, rejeição de dados inválidos, invariantes
- Value Objects: igualdade, imutabilidade, validação
- Domain Services: lógica complexa de negócio

**Exemplo de especificação:**
```
Testes de Domínio:
- Order.Create() com items válidos → sucesso
- Order.Create() sem items → DomainException
- Order.Total com múltiplos items → soma correta
- Order.Cancel() quando PENDING → sucesso
- Order.Cancel() quando PAID → DomainException
- Money.Add() com valores negativos → DomainException
```

### 5.2. Application (Unit)

**O que testar:**
- Handlers: fluxo principal, casos de erro, validações
- Validators: regras de validação de input
- DTOs: mapeamento correto

**Exemplo:**
```
Testes de Application:
- CreateOrderHandler com request válido → Order criado + evento publicado
- CreateOrderHandler com produto inexistente → ProductNotFoundException
- CreateOrderHandler com estoque insuficiente → InsufficientStockException
- CreateOrderValidator sem items → ValidationError em items
- CreateOrderValidator com quantity <= 0 → ValidationError em quantity
- CreateOrderValidator com total > 10000 → status REVIEW_PENDING
```

**Padrão AAA (Arrange-Act-Assert):**
```
Test: CreateOrder_Should_CreateOrder_When_ValidRequest
Arrange:
  - Mock IOrderRepository.Setup(AddAsync) → returns void
  - Mock IProductRepository.Setup(GetByIdAsync) → returns Product
  - Mock IEventBus.Setup(PublishAsync) → returns void
  - Command = valid CreateOrderCommand
Act:
  - Result = handler.Handle(command)
Assert:
  - Result.IsSuccess == true
  - Result.Value.OrderId != empty
  - IOrderRepository.Verify(AddAsync, Called.Once)
  - IEventBus.Verify(PublishAsync, Called.Once)
```

### 5.3. Infrastructure (Integration)

**O que testar:**
- Repositories: CRUD com banco real (ou container)
- External services: integração com APIs (usando mocks de HTTP)
- Migrations: schema válido

**Setup necessário:**
```
Integration Tests:
- Database: PostgreSQL container (TestContainers)
- Seed: dados mínimos para testes
- Transaction: cada teste em transaction com rollback
- Cleanup: truncar tabelas após cada teste (ou transaction rollback)
```

**Exemplo:**
```
Testes de Infrastructure:
- OrderRepository.AddAsync → persiste no banco
- OrderRepository.GetByIdAsync → retorna Order com Items
- OrderRepository.GetByCustomerIdAsync → retorna lista paginada
- OrderRepository.UpdateAsync → atualiza status
- OrderRepository com optimistic locking → lança ConcurrencyException
```

### 5.4. Interface (E2E / Integration)

**O que testar:**
- Endpoints: status codes, headers, response body
- Auth: token ausente/inválido/expirado
- Fluxos: criar → buscar → atualizar → deletar

**Exemplo:**
```
Testes E2E (API):
- POST /api/v1/orders com token válido → 201 + order body
- POST /api/v1/orders sem token → 401
- POST /api/v1/orders com token de outro user → 403
- POST /api/v1/orders com body inválido → 400 + validation errors
- GET /api/v1/orders/{id} → 200 + order
- GET /api/v1/orders/{id} com id inexistente → 404
- DELETE /api/v1/orders/{id} com status PENDING → 204
- DELETE /api/v1/orders/{id} com status PAID → 409
```

---

## 6. Dados de Teste

### 6.1. Factories

```
Test Data Factory: OrderFactory
Métodos:
  - create(partial?): Order  → cria Order com dados válidos padrão
  - withItems(count): Order  → cria Order com N items
  - pending(): Order         → status PENDING
  - paid(): Order            → status PAID
  - cancelled(): Order       → status CANCELLED

Exemplo:
  const order = OrderFactory.create({ customerId: 'specific-uuid' });
  const pendingOrder = OrderFactory.pending().withItems(3);
```

### 6.2. Fixtures

```
Seed de teste:
- 1 User ADMIN (admin@test.com)
- 1 User CUSTOMER (customer@test.com)
- 5 Products (disponíveis)
- 3 Orders (PENDING, PAID, CANCELLED)

Load: antes de cada suite de integration tests
Cleanup: após cada suite
```

### 6.3. Fakes vs Mocks

| Tipo | Quando usar | Exemplo |
|:---|:---|:---|
| **Fake** | Implementação simplificada que funciona | InMemoryOrderRepository para unit tests |
| **Mock** | Verificar comportamento (chamadas) | Mock<IOrderRepository> com Setup/Verify |
| **Stub** | Retornar dados fixos | Stub<IProductService>.GetPrice → 99.99 |

---

## 7. Checklist de Observabilidade

Antes de finalizar a seção de observabilidade na TechSpec, verificar:

### Logging
- [ ] Eventos de negócio logados (INFO)
- [ ] Erros com contexto suficiente (ERROR)
- [ ] Retries e warnings documentados (WARN)
- [ ] NENHUM dado sensível nos logs
- [ ] Correlation ID em todos os logs
- [ ] Formato estruturado (JSON)
- [ ] Framework de logging especificado (Winston, Serilog, Pino)

### Métricas
- [ ] Contadores para eventos de negócio (created, failed)
- [ ] Histogramas para latência (duration_seconds)
- [ ] Gauges para estado atual (queue depth, connections)
- [ ] Labels para segmentação (status, method, path)
- [ ] Alertas críticos definidos

### Tracing
- [ ] Correlation ID gerado no entry point
- [ ] Propagação em logs, eventos e chamadas externas
- [ ] Incluído em respostas de erro
- [ ] Framework especificado (OpenTelemetry, manual)

---

## 8. Checklist de Testes

Antes de finalizar a seção de testes na TechSpec, verificar:

### Estratégia
- [ ] Pirâmide de testes definida (70/20/10)
- [ ] Framework de testes especificado
- [ ] Coverage mínimo definido por criticidade
- [ ] CI pipeline inclui testes

### Por Camada
- [ ] Domain: entidades, value objects, invariantes
- [ ] Application: handlers, validação, casos de erro
- [ ] Infrastructure: repositories com DB real (TestContainers)
- [ ] Interface: endpoints, auth, fluxos

### Dados
- [ ] Factories para criação de dados de teste
- [ ] Fixtures para dados recorrentes
- [ ] Seed para integration tests
- [ ] Cleanup strategy definida

### Cenários Críticos
- [ ] Happy path testado
- [ ] Cada edge case da TechSpec tem teste
- [ ] Concorrência testada (se aplicável)
- [ ] Erros de integração externa testados (timeout, retry)
- [ ] Auth/authorization testado (unauthorized, forbidden)
