# Design de APIs e Contratos

Referência técnica para design de APIs ao gerar Tech Specs.

## Sumário

1. [Princípios de API Design](#1-principios-de-api-design)
2. [RESTful Design](#2-restful-design)
3. [Versionamento](#3-versionamento)
4. [Paginação, Filtros e Ordenação](#4-paginacao-filtros-e-ordenacao)
5. [Error Design](#5-error-design)
6. [Idempotência](#6-idempotencia)
7. [Rate Limiting](#7-rate-limiting)
8. [Contrato Completo](#8-contrato-completo)
9. [Webhooks](#9-webhooks)

---

## 1. Princípios de API Design

### 1.1. Regras Fundamentais

- **Consistência:** Seguir padrão existente no projeto (verificar endpoints atuais)
- **Especificidade:** Cada endpoint faz UMA coisa bem definida
- **Expliciticidade:** Nomes de recursos no plural, ações claras
- **Versionamento:** Sempre versionar (pelo menos `/api/v1/`)

### 1.2. Nomenclatura de Recursos

| Padrão | Exemplo | Quando |
|:---|:---|:---|
| Substantivo plural | `/api/v1/orders` | Recursos |
| Nested resource | `/api/v1/orders/{id}/items` | Recursos filhos |
| Ação (verbo) | `/api/v1/orders/{id}/cancel` | Ações não-CRUD |
| Query param | `/api/v1/orders?status=pending` | Filtros |

---

## 2. RESTful Design

### 2.1. Mapeamento CRUD

| Operação | Método | Rota | Status Code |
|:---|:---|:---|:---|
| Listar | GET | `/api/v1/orders` | 200 |
| Buscar por ID | GET | `/api/v1/orders/{id}` | 200 / 404 |
| Criar | POST | `/api/v1/orders` | 201 |
| Atualizar total | PUT | `/api/v1/orders/{id}` | 200 |
| Atualizar parcial | PATCH | `/api/v1/orders/{id}` | 200 |
| Deletar | DELETE | `/api/v1/orders/{id}` | 204 |
| Ação | POST | `/api/v1/orders/{id}/cancel` | 200 |

### 2.2. Status Codes Essenciais

| Code | Significado | Quando usar |
|:---|:---|:---|
| **200** | OK | GET, PUT, PATCH, DELETE sucesso |
| **201** | Created | POST com sucesso (recurso criado) |
| **204** | No Content | DELETE sucesso (sem body de resposta) |
| **400** | Bad Request | Validação de input falhou |
| **401** | Unauthorized | Token ausente ou inválido |
| **403** | Forbidden | Sem permissão para esta ação |
| **404** | Not Found | Recurso não encontrado |
| **409** | Conflict | Conflito de estado (ex: já processado) |
| **422** | Unprocessable Entity | Regra de negócio violada |
| **429** | Too Many Requests | Rate limit excedido |
| **500** | Internal Server Error | Erro inesperado no servidor |

---

## 3. Versionamento

### 3.1. Estratégias

| Estratégia | Exemplo | Recomendação |
|:---|:---|:---|
| **URI Path** | `/api/v1/orders` | Mais comum, explícito |
| **Header** | `Accept: application/vnd.api.v1+json` | Para APIs avançadas |
| **Query Param** | `/api/orders?version=1` | Evitar (cache issues) |

**Na TechSpec, sempre especificar:** `GET /api/v1/orders` (URI Path é o padrão)

---

## 4. Paginação, Filtros e Ordenação

### 4.1. Paginação

**Offset-based (padrão):**
```
GET /api/v1/orders?page=1&page_size=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 150,
    "total_pages": 8
  }
}
```

**Cursor-based (para datasets grandes):**
```
GET /api/v1/orders?cursor=eyJpZCI6MTAwfQ&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "prev_cursor": "eyJpZCI6ODB9",
    "has_more": true
  }
}
```

### 4.2. Filtros

```
GET /api/v1/orders?status=pending&created_after=2024-01-01&customer_id=uuid

Convenção:
- Igualdade direta: ?status=pending
- Range: ?created_after=2024-01-01&created_before=2024-12-31
- Múltiplos valores: ?status=pending,processing
- Busca: ?search=joão
- Existência: ?has_items=true
```

### 4.3. Ordenação

```
GET /api/v1/orders?sort=created_at&order=desc

Ou multi-sort:
GET /api/v1/orders?sort=status:asc,created_at:desc
```

---

## 5. Error Design

### 5.1. Formato de Erro (RFC 7807)

```json
{
  "type": "https://errors.example.com/insufficient-stock",
  "title": "Insufficient Stock",
  "status": 422,
  "detail": "Product 'Widget X' has only 2 units available, but 5 were requested.",
  "instance": "/api/v1/orders",
  "traceId": "uuid-correlation-id",
  "errors": [
    {
      "field": "items[0].quantity",
      "code": "INSUFFICIENT_STOCK",
      "message": "Requested 5 but only 2 available",
      "productId": "uuid"
    }
  ]
}
```

### 5.2. Códigos de Erro por Domínio

**Padrão de nomenclatura:** `SCREAMING_SNAKE_CASE`

```
Validation Errors:
- VALIDATION_ERROR          (400) - Genérico de validação
- REQUIRED_FIELD_MISSING    (400) - Campo obrigatório ausente
- INVALID_FORMAT            (400) - Formato inválido (email, CPF)
- FIELD_TOO_LONG            (400) - Campo excede tamanho máximo

Business Errors:
- INSUFFICIENT_STOCK        (422) - Estoque insuficiente
- ORDER_ALREADY_CANCELLED   (409) - Pedido já cancelado
- PAYMENT_FAILED            (422) - Pagamento rejeitado
- DUPLICATE_ENTRY           (409) - Entrada duplicada

Auth Errors:
- UNAUTHORIZED              (401) - Token inválido/ausente
- FORBIDDEN                 (403) - Sem permissão
- TOKEN_EXPIRED             (401) - Token expirado

System Errors:
- INTERNAL_ERROR            (500) - Erro inesperado
- SERVICE_UNAVAILABLE       (503) - Serviço terceiro indisponível
- TIMEOUT                   (504) - Timeout de serviço terceiro
```

### 5.3. Erros de Validação em Batch

```json
{
  "type": "https://errors.example.com/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "errors": [
    { "field": "email", "code": "REQUIRED", "message": "Email é obrigatório" },
    { "field": "quantity", "code": "MIN_VALUE", "message": "Quantidade mínima é 1", "min": 1 },
    { "field": "items", "code": "MIN_LENGTH", "message": "Pedido deve ter pelo menos 1 item", "min": 1 }
  ]
}
```

---

## 6. Idempotência

### 6.1. Quando Especificar

**SEMPRE para:**
- Criação de recursos financeiros (pagamentos, transferências)
- Operações que causam efeitos colaterais (envio de email, reserva)
- Operações que podem ser retentadas automaticamente

### 6.2. Implementação

**Header de idempotência:**
```
POST /api/v1/orders
Idempotency-Key: client-generated-uuid

- Se key já existe: retornar resposta cacheada (200/201)
- Se key nova: processar e cache resultado por 24h
- TTL: 24 horas
- Storage: Redis ou tabela no banco
```

**Na TechSpec:**
```
Endpoints idempotentes:
- POST /api/v1/payments: Idempotency-Key header obrigatório
- POST /api/v1/orders: Idempotency-Key header opcional (recomendado)

Storage: Redis com TTL 24h (key: idempotency:{hash})
Conflict: Se key já existe, retornar 200 + resposta cacheada
```

---

## 7. Rate Limiting

### 7.1. Headers de Rate Limit

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709318400

HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709318400
```

### 7.2. Limites por Tipo de Endpoint

| Tipo | Limite | Janela |
|:---|:---|:---|
| **Autenticação** | 5 req | Por minuto por IP |
| **Criação de recursos** | 10 req | Por minuto por usuário |
| **Listagem/Busca** | 100 req | Por minuto por usuário |
| **Operações pesadas** | 2 req | Por minuto por usuário |

---

## 8. Contrato Completo

### Template de Endpoint na TechSpec

```
[METHOD] /api/v1/[resource]
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "field1": "type - description",
  "field2": 0
}

Response [STATUS_CODE] [STATUS_TEXT]:
{
  "field1": "type"
}

Response [ERROR_STATUS] [ERROR_TEXT]:
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": { ... }
}

Headers:
- X-Request-Id: Correlation ID para tracing

Rules:
- [Regra de validação/negócio específica]
- [Regra de autorização específica]

Rate Limit: [N] req/min por [user/ip]
Idempotent: [Yes/No] [como]
```

### Exemplo Completo

```
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer {token}

Request:
{
  "customer_id": "uuid-v4",
  "items": [
    {
      "product_id": "uuid-v4",
      "quantity": 1
    }
  ],
  "shipping_address": {
    "street": "string (max 255)",
    "city": "string (max 100)",
    "state": "string (2 chars)",
    "zip_code": "string (8 chars)",
    "country": "string (2 chars, default: BR)"
  }
}

Response 201 Created:
{
  "order_id": "uuid-v4",
  "status": "PENDING",
  "total_amount": 99.99,
  "items": [
    {
      "product_id": "uuid-v4",
      "name": "Product Name",
      "quantity": 1,
      "unit_price": 99.99
    }
  ],
  "created_at": "2024-03-01T10:00:00Z"
}

Response 400 Bad Request:
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "errors": [
    { "field": "items[0].quantity", "code": "MIN_VALUE", "message": "Quantity must be >= 1" }
  ]
}

Response 422 Unprocessable Entity:
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Product 'Widget' has insufficient stock",
  "details": { "product_id": "uuid", "requested": 5, "available": 2 }
}

Response 404 Not Found:
{
  "code": "PRODUCT_NOT_FOUND",
  "message": "Product with id 'uuid' not found"
}

Response 500 Internal Server Error:
{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "request_id": "correlation-uuid"
}

Authorization: customer (próprio pedido) ou admin (qualquer pedido)
Rate Limit: 10 req/min por user
Idempotent: Sim, via Idempotency-Key header
```

---

## 9. Webhooks

### 9.1. Formato de Webhook

```
POST [webhook_url]
Content-Type: application/json
X-Webhook-Signature: sha256=hmac_signature
X-Webhook-Event: order.created
X-Webhook-Delivery-Id: uuid

Payload:
{
  "event": "order.created",
  "timestamp": "2024-03-01T10:00:00Z",
  "delivery_id": "uuid",
  "data": {
    "order_id": "uuid",
    "status": "PENDING",
    "total_amount": 99.99
  }
}
```

### 9.2. Retry Policy

```
Retry: 5 tentativas com backoff exponencial (1s, 2s, 4s, 8s, 16s)
Timeout: 10s por tentativa
Success: HTTP 2xx
Failure: Após 5 tentativas, mover para dead letter queue
Signature: HMAC-SHA256 com webhook secret
```
