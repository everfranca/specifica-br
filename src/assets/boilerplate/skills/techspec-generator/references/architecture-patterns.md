# Padrões Arquiteturais e Decisões de Design

Referência técnica para decisões arquiteturais ao gerar Tech Specs.

## Sumário

1. [Paradigmas Arquiteturais](#1-paradigmas-arquiteturais)
2. [Padrões de Design](#2-padroes-de-design)
3. [Princípios SOLID no Contexto de Specs](#3-principios-solid-no-contexto-de-specs)
4. [Separação de Camadas](#4-separacao-de-camadas)
5. [Decisões de Orquestração](#5-decisoes-de-orquestracao)

---

## 1. Paradigmas Arquiteturais

### 1.1. Clean Architecture

**Quando usar:** Projetos que valorizam testabilidade e independência de frameworks.

**Estrutura típica:**
```
src/
├── Domain/          # Entidades, Value Objects, Interfaces de Repository
├── Application/     # Use Cases, Commands, Queries, Handlers, DTOs
├── Infrastructure/  # Repository implementations, External Services, Adapters
└── Interface/       # Controllers, Presenters, Gateways (API/Web)
```

**Regras de dependência:**
- Domain → não depende de ninguém
- Application → depende apenas de Domain
- Infrastructure → implementa interfaces de Domain/Application
- Interface → orquestra chamadas para Application

**O que especificar na TechSpec:**
- A qual camada pertence cada novo componente
- Quais interfaces cada camada define
- Qual a direção de dependência (sempre para dentro)

**Violações comuns a detectar:**
- Controller com lógica de negócio (deveria estar em Application)
- Entity importando ORM (deveria ser agnóstico)
- Handler acessando banco diretamente (deveria usar Repository)
- Domain dependendo de biblioteca externa

### 1.2. Domain-Driven Design (DDD)

**Quando usar:** Domínios complexos com regras de negócio ricas.

**Conceitos-chave para especificar:**

| Conceito | O que documentar na TechSpec |
|:---|:---|
| **Bounded Context** | Qual contexto esta feature pertence |
| **Aggregate Root** | Qual entidade é a raiz do aggregate |
| **Value Object** | Quais conceitos são imutáveis sem identidade |
| **Domain Event** | Quais eventos de domínio a feature emite/consome |
| **Repository** | Interface de persistência (não implementação) |
| **Domain Service** | Lógica que não pertence a nenhuma entidade |

**Exemplo de especificação DDD:**
```
Aggregate Root: Order
- Entities: Order, OrderItem
- Value Objects: Money, OrderStatus
- Invariants: Total > 0, Status transitions válidas, Items não vazio
- Events: OrderCreated, OrderPaid, OrderCancelled
- Repository: IOrderRepository (interface em Domain)
```

### 1.3. Hexagonal Architecture (Ports & Adapters)

**Quando usar:** Quando a feature precisa de múltiplos adaptadores (API, CLI, Queue).

**Estrutura:**
```
src/
├── core/            # Lógica de negócio pura
│   ├── domain/      # Entidades, Value Objects
│   └── ports/       # Interfaces (inbound e outbound)
├── adapters/
│   ├── inbound/     # Controllers, Consumers, CLI handlers
│   └── outbound/    # Repository impl, External Service impl
└── config/          # Wiring/DI configuration
```

**Ports:** Interfaces que definem contratos
- Inbound (driving): O que o mundo externo pode fazer com o domínio
- Outbound (driven): O que o domínio precisa do mundo externo

### 1.4. CQRS (Command Query Responsibility Segregation)

**Quando usar:** Quando operações de leitura e escrita têm padrões muito diferentes.

**O que especificar:**
```
Command Side:
- CreateOrderCommand → CreateOrderHandler → IOrderRepository
- Separado da leitura

Query Side:
- GetOrderByIdQuery → GetOrderByIdHandler → IOrderReadRepository
- Pode usar modelo de leitura diferente (projection)
```

**Trade-offs:**
- (+) Leitura e escrita otimizadas independentemente
- (+) Melhor escalabilidade
- (-) Consistência eventual (se separar modelos de dados)
- (-) Complexidade adicional

### 1.5. Event Sourcing

**Quando usar:** Quando o histórico de mudanças é importante para o negócio.

**O que especificar:**
```
Eventos armazenados:
- OrderCreated { orderId, items, total }
- OrderItemAdded { orderId, itemId, product, quantity }
- OrderPaid { orderId, paymentId, paidAt }

Snapshot: A cada N eventos, gerar snapshot do estado atual
Projection: Para queries, criar modelo de leitura a partir dos eventos
```

**Trade-offs:**
- (+) Audit trail completo
- (+) Time travel (reconstruir estado em qualquer ponto)
- (-) Complexidade elevada
- (-) Storage cresce continuamente

---

## 2. Padrões de Design

### 2.1. Repository Pattern

**Especificação na TechSpec:**
```
Interface: IOrderRepository (em Domain/Interfaces)
Métodos:
  - AddAsync(order: Order): Promise<void>
  - GetByIdAsync(id: UUID): Promise<Order | null>
  - UpdateAsync(order: Order): Promise<void>
  - GetByCustomerIdAsync(customerId: UUID, page: number, size: number): Promise<PaginatedResult<Order>>

Implementação: OrderRepository (em Infrastructure/Persistence)
ORM: Prisma/Dapper/EF Core (conforme padrão do projeto)
```

### 2.2. Strategy Pattern

**Quando usar:** Múltiplas variantes de um algoritmo (ex: cálculo de frete, métodos de pagamento).

```
Interface: IShippingCalculator
Estratégias: CorreiosCalculator, FedexCalculator, LocalPickupCalculator
Seleção: ShippingCalculatorFactory baseado em ShippingMethod
```

### 2.3. Factory Pattern

**Quando usar:** Criação de objetos complexos com validações.

```
Método estático: Order.Create(customerId, items) → Order
Validações: Items não vazio, produtos existem, estoque disponível
Resultado: Order válido ou lança DomainException
```

### 2.4. Observer Pattern / Event-Driven

**Quando usar:** Desacoplar produtores de consumidores de eventos.

```
Evento: OrderCreated
Produtores: CreateOrderHandler (Application)
Consumidores: PaymentProcessor, NotificationService, InventoryUpdater
Barramento: IMediatR (in-process) ou RabbitMQ (out-of-process)
```

### 2.5. Specification Pattern

**Quando usar:** Regras de negócio complexas e combináveis.

```
Specification: CanCancelOrderSpecification
  - OrderStatus must be PENDING or PROCESSING
  - Time since creation < 24 hours
  - No payment processed yet
Combinação: CanCancelOrder.And(NoPaymentProcessed)
```

---

## 3. Princípios SOLID no Contexto de Specs

### Single Responsibility (SRP)

Cada componente deve ter uma razão para mudar:
- Handler: Processa UM comando
- Repository: Persiste UMA entidade
- Validator: Valida UM input
- Controller: Expõe UM conjunto de endpoints relacionados

### Open/Closed (OCP)

Estender sem modificar:
- Novo método de pagamento → nova classe que implementa IPaymentStrategy
- Novo tipo de notificação → novo classe que implementa INotificationService
- Sem modificar código existente

### Liskov Substitution (LSP)

Subtipos devem ser substituíveis:
- Se IOrderRepository tem GetByIdAsync, qualquer implementação deve retornar Order ou null
- Não criar implementação que lança NotImplementedException

### Interface Segregation (ISP)

Interfaces específicas e pequenas:
- Ruim: IOrderService com 20 métodos
- Bom: IOrderReader (queries) + IOrderWriter (commands)

### Dependency Inversion (DIP)

Depender de abstrações, não implementações:
- Handler depende de IOrderRepository (interface), não OrderRepository (implementação)
- Controller depende de IMediator (ou IHandler), não Handler diretamente

---

## 4. Separação de Camadas

### Matriz de Responsabilidades

| Camada | Responsável por | NÃO responsável por |
|:---|:---|:---|
| **Domain** | Entidades, Value Objects, regras de negócio, interfaces de repository | Persistência, HTTP, DI, logging |
| **Application** | Use cases, handlers, commands, queries, DTOs, validação de input | Acesso a DB, HTTP, frameworks |
| **Infrastructure** | Repositories, external services, email, storage, DB context | Regras de negócio, DTOs |
| **Interface** | Controllers, rotas, auth middleware, response formatting | Lógica de negócio, acesso a DB |

### Direção de Dependências

```
Interface → Application → Domain ← Infrastructure
```

- Interface depende de Application (chama handlers)
- Application depende de Domain (usa entidades e interfaces)
- Infrastructure depende de Domain (implementa interfaces)
- Domain não depende de ninguém

---

## 5. Decisões de Orquestração

### 5.1. Síncrono vs Assíncrono

**Critérios de decisão:**

| Fator | Síncrono | Assíncrono |
|:---|:---|:---|
| Latência aceitável | < 500ms | > 500ms OK |
| Necessidade de resposta imediata | Sim | Não |
| Volume de operações | Baixo/Médio | Alto |
| Dependência externa | Confiável | Pode falhar |
| Consistência | Imediata | Eventual OK |

**O que especificar na TechSpec:**
```
Decisão: Processamento assíncrono para pagamento
Justificativa: Payment gateway responde em média 2s (timeout em 5s).
PRD RF-005 requer "processamento assíncrono".
Padrão existente: RabbitMQ já configurado (docker-compose).
Fluxo: API publica OrderCreated → PaymentWorker consome → atualiza status
```

### 5.2. Saga Pattern

**Quando usar:** Transações que envolvem múltiplos serviços/bounded contexts.

**Choreography (event-driven):**
```
OrderService → OrderCreated event
PaymentService → consome OrderCreated, processa → PaymentProcessed event
InventoryService → consome PaymentProcessed, reserva → InventoryReserved event
```

**Orchestration (centralizado):**
```
OrderOrchestrator → chama PaymentService → chama InventoryService → completa
Se falha: OrderOrchestrator executa compensating transactions
```

**Trade-offs:**
- Choreography: Mais simples, mas difícil rastrear fluxo
- Orchestration: Mais controlado, mas ponto central de falha

### 5.3. Outbox Pattern

**Quando usar:** Garantir que eventos sejam publicados mesmo com falha.

```
1. Salvar dados + evento na mesma transação (Outbox table)
2. Background worker lê Outbox e publica eventos
3. Marca evento como publicado
```

**Especificação na TechSpec:**
- Tabela de outbox: outbox_events (id, aggregate_type, aggregate_id, event_type, payload, published_at, created_at)
- Worker: polling a cada N segundos
- Cleanup: remover eventos publicados após M dias
