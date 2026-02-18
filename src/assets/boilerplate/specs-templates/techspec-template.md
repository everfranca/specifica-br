# Technical Specification: {{FEATURE_NAME}}
**Scope:** Esta especificação cobre APENAS a feature {{FEATURE_NAME}} conforme descrita no PRD.
Qualquer comportamento fora deste escopo deve ser explicitamente rejeitado.

| Metadata | Details |
| :--- | :--- |
| **Status** | Draft |
| **Data** | {{DATA_ATUAL}} |
| **Referência PRD** | [Link PRD](@specs/features/[nome-da-funcionalidade]/prd.md) |
<!-- Status: DRAFT → IN_PROGRESS → APPROVED -->

---

## 1. Introdução e contexto
**Exemplo de Estilo:**
"Esta feature implementará o fluxo de checkout utilizando o padrão Saga para orquestração. Utilizaremos uma fila (RabbitMQ) para processamento assíncrono de pagamentos para garantir resiliência, e o estado do pedido será persistido no PostgreSQL."

{{INTRODUCTION_CONTENT}}

- **Objetivo de Negócio:** ...
- **Impacto no Usuário:** ...
- **Non Goals:** ...
- **Pressupostos:** ...

---

## 2. High-Level Architecture [Obrigatório]
### 2.1 Context Diagram
 **Exemplo:**
:::mermaid
 graph LR
     User -->|HTTP Request| API
     API -->|Publish Event| MessageBroker
     Worker -->|Consume| MessageBroker
     Worker -->|Write| Database
:::
<!-- 
Regras:
- O diagrama deve refletir APENAS os componentes mencionados no PRD.
- Serviços especulativos não são permitidos.
- Prefira menos nós à completude.
-->

{{CONTEXT_DIAGRAM_CONTENT}}

### 2.3 Design de Componentes (Alinhado com a Arquitetura da Aplicação) [Obrigatório]

**Regras:**
- Todo componente **DEVE** estar em conformidade com a arquitetura declarada.
- Todo componente **DEVE** pertencer a **exatamente uma** camada arquitetural.
- Nenhum componente **PODE** violar a direção das dependências.

**Formato Obrigatório:**
- **Nome:**
- **Camada:** Domain | Application | Infrastructure | Interface
- **Tipo:** Controller | UseCase | DomainService | Repository | Adapter | Worker
- **Responsabilidade:**
- **Dependências (Apenas Permitidas):**

{{COMPONENT_DESIGN_CONTENT}}

---

## 3. Design e Persistência de Dados [Se aplicável]
### 3.1 Modelos de dados / Schema [Se aplicável]
 **Exemplo (Formato Esperado):**
 **Entity: Order**
 - `id` (UUID, PK): Identificador único.
 - `customer_id` (String, Indexed): Referência ao usuário.
 - `total_amount` (Decimal, Not Null): Valor final.
 - `status` (Enum): [PENDING, PAID, FAILED].

{{DATA_MODELS_CONTENT}}

### 3.2 Estratégia de armazenamento [Se aplicável]
{{STORAGE_STRATEGY_CONTENT}}

---

## 4. Especificações da interface (Contracts) [Se aplicável]
### 4.1 Public Interfaces
 **Exemplo (API REST):**
 **POST /api/v1/orders**
 - **Input:** `{ "items": [{"id": "xyz", "qty": 1}] }`
 - **Output (201):** `{ "orderId": "abc-123", "status": "PENDING" }`
 - **Error (422):** `{ "code": "INVALID_STOCK", "message": "Item xyz out of stock" }`

{{PUBLIC_INTERFACES_CONTENT}}

### 4.2 Interações internas (Events/Messages) [Se aplicável]
 **Exemplo (Evento):**
 **Event: OrderCreated**
 - **Source:** OrderService
 - **Payload:** `{ "orderId": "...", "timestamp": "..." }`

{{INTERNAL_INTERACTIONS_CONTENT}}

---

## 5. Lógica de negócios e algoritmos principais [Obrigatório]
### 5.1 Fluxo principal [Obrigatório]
 **Exemplo:**
 1. Receber requisição de cadastro.
 2. **Validação:** Verificar se e-mail já existe no Repositório (Unique Constraint).
    - *Se existir:* Retornar Erro `UserAlreadyExists`.
 3. Hash da senha usando algoritmo definido (ex: Argon2).
 4. Salvar usuário no banco com status `ACTIVE`.
 5. Publicar evento `UserRegistered` no barramento.

{{MAIN_FLOW_CONTENT}}

### 5.2 Casos extremos [Obrigatório]
**Exemplo:**
- **Regra:** Se o valor for > 10.000, exigir aprovação manual (status `REVIEW`).
- **Retry:** Se o serviço de terceiro falhar (5xx), tentar 3 vezes com backoff exponencial.

{{EDGE_CASES_CONTENT}}

---

## 6. Observability & Operational Readiness [Se aplicável]
### 6.1 Logging & Tracing
**Exemplo:**
- **Level:** ERROR
- **When:** Falha na validação de cartão.
- **Context:** Logar `orderId`, `userId` e `errorCode` do gateway. (NUNCA logar o número do cartão).
<!-- 
Regra: 
- Todas as métricas/registros definidos aqui DEVEM ser implementados durante a execução da tarefa.
-->.

{{LOGGING_CONTENT}}

### 6.2 Métricas (KPIs) [Se aplicável]
**Exemplo:**
- `payment_gateway_latency_seconds` (Histogram): Tempo de resposta do parceiro.
- `orders_created_total` (Counter): Volume de vendas.

{{METRICS_CONTENT}}

---

## 7. Segurança & Compliance [Se aplicável]
**Exemplo:**
- **Auth:** Endpoint requer token Bearer com role `admin`.
- **Data Privacy:** O campo `cpf` deve ser criptografado em repouso (At Rest).
- **Sanitization:** Todos os inputs de texto devem ser sanitizados para evitar XSS/Injection.
- **Criticidade:** ...
- **Recomendação:** ...
- **Fora do escopo:** ...

{{SECURITY_CONTENT}}

---

## 8. Plano de Implementação [Obrigatório]
**Exemplo:**
1. Criar migration da tabela `orders`.
2. Implementar `OrderRepository` e testes de integração.
3. Implementar Caso de Uso `CreateOrder` (Lógica).
4. Criar Endpoint na API e DTOs.
5. Configurar instrumentação de métricas.
<!-- 
Regra:
 - Não mais que 10 passos
-->

{{IMPLEMENTATION_PLAN_CONTENT}}
