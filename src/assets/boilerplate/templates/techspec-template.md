<!-- Os comentários <!-- ... --> deste template são apenas para autoria e NÃO devem aparecer no techspec.md final. Remova-os ao gerar o artefato. O "como preencher" vive no comando gerar-techspec.md. -->

# Technical Specification: {{FEATURE_NAME}}

**Scope:** Esta especificação cobre APENAS a feature {{FEATURE_NAME}} conforme descrita no PRD. Qualquer comportamento fora deste escopo deve ser explicitamente rejeitado.

| Metadata | Details |
| :--- | :--- |
| **Status** | Draft |
| **Data** | {{DATA_ATUAL}} |
| **Referência PRD** | [Link PRD](./prd.md) |
<!-- Status: DRAFT → IN_PROGRESS → APPROVED -->

---

## 1. Introdução e contexto

<!-- 1-2 parágrafos (máx 150 palavras): padrão arquitetural, tecnologias principais e padrões de design aplicados. Citar AGENTS.md/features similares quando aplicável. -->

{{INTRODUCTION_CONTENT}}

**Objetivo de Negócio:** ...
**Impacto no Usuário:** ...
**Non Goals:** ...
**Pressupostos:** ...

---

## 2. High-Level Architecture [Obrigatório]

### 2.1 Context Diagram

<!-- Diagrama Mermaid (graph LR/TD) apenas com componentes do PRD. Sem serviços especulativos. Rótulos nas arestas indicando a comunicação. -->

```mermaid
{{CONTEXT_DIAGRAM_CONTENT}}
```

### 2.2 Design de Componentes (Alinhado com a Arquitetura da Aplicação) [Obrigatório]

<!-- Cada componente pertence a exatamente UMA camada e não viola a direção de dependências. Camadas comuns: Domain, Application, Infrastructure, Interface. -->

| Nome | Camada | Tipo | Responsabilidade | Dependências (Apenas Permitidas) |
|:---|:---|:---|:---|:---|
{{COMPONENT_DESIGN_CONTENT}}

---

## 3. Design e Persistência de Dados [Se aplicável]

### 3.1 Modelos de dados / Schema [Se aplicável]

<!-- Tipos SQL específicos: VARCHAR(255), UUID, DECIMAL(10,2) — nunca "string"/"number". Constraints explícitas (PK, FK, Unique, Not Null), índices e relacionamentos documentados. -->

{{DATA_MODELS_CONTENT}}

### 3.2 Estratégia de armazenamento [Se aplicável]

<!-- Tipo de banco, particionamento, retenção, backup/restore. -->

{{STORAGE_STRATEGY_CONTENT}}

### 3.3 Banco de Dados e Infraestrutura [Se aplicável]

<!-- Stack exata EM USO: banco+versão, ORM, migrations, nomenclatura de tabelas/colunas/PK/FK; serviços de infra (Docker, mensageria, cache+TTL, storage/CDN, CI/CD). -->

{{DATABASE_INFRASTRUCTURE_CONTENT}}

---

## 4. Contratos de Integracao (Boundaries) [Obrigatorio]

<!-- Toda fronteira que a feature toca DEVE ter contrato aqui (interno ou terceiro). Cada contrato: ID único (CT-XXX), fronteira, protocolo, origem (DESCOBERTO/SOLICITADO/PROPOSTO), schema de entrada/saída/erro completos e headers/metadata quando aplicável. -->

### Tabela Resumo de Contratos

| ID | Fronteira | Contrato | Protocolo | Origem | Secao Detalhe |
|:---|:---|:---|:---|:---|:---|
| CT-001 | Client-Backend | {{CONTRATO_001_NOME}} | {{PROTOCOL}} | {{DESCOBERTO/SOLICITADO/PROPOSTO}} | 4.1 |
| CT-002 | Backend-Database | {{CONTRATO_002_NOME}} | {{PROTOCOL}} | {{DESCOBERTO/SOLICITADO/PROPOSTO}} | 4.2 |

---

### 4.1 Contrato Client-Backend [Se aplicavel]

<!-- Por endpoint/operação: método+rota completos, request com tipos, response para TODOS os status codes, error responses, headers obrigatórios (auth, content-type, correlation-id). Protocolos: HTTP REST, gRPC, WebSocket, GraphQL, SSE. -->

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

{{CLIENT_BACKEND_CONTRACTS}}

#### 4.1.1 Politicas de Comunicacao Cross-Origin (CORS) [Se aplicavel]

<!-- Aplicar sempre que Client-Backend for HTTP com possibilidade de cross-origin (dominios/subdominios/ports/protocolos diferentes, inclusive dev). Nunca usar Allowed Origins: * em produção. Alinhar Allowed Headers com os headers dos contratos. -->

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

<!-- Por operação: tipo (query/command/procedure), input (parâmetros/entidades/filtros), output (result sets/affected rows/generated keys), constraints e erros esperados (violation, timeout, deadlock), transações quando aplicável. -->

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

{{BACKEND_DATABASE_CONTRACTS}}

---

### 4.3 Contrato Backend-Message Broker [Se aplicavel]

<!-- Por evento/mensagem: nome no passado (OrderCreated), source e target, topic/queue, payload com tipos, correlationId sempre, error handling (retry, dead letter), ordenação (FIFO/partições). -->

#### [CT-XXX] NOME_DO_EVENTO (Publish/Subscribe)

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

{{BACKEND_MESSAGE_BROKER_CONTRACTS}}

---

### 4.4 Contrato Backend-Cache [Se aplicavel]

<!-- Por operação: key pattern, TTL (sempre), schema do valor cacheado, estratégia de invalidação (trigger + pattern). -->

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

{{BACKEND_CACHE_CONTRACTS}}

---

### 4.5 Contrato Backend-External Services [Se aplicavel]

<!-- Serviço de terceiros DEVE ter contrato mesmo sem doc interna. Distinguir OUTBOUND (backend chama terceiro) de INBOUND (webhook). Auth, rate limits, retry/circuit breaker/fallback. NUNCA documentar valores reais de API keys/secrets. Validar com Context7 quando disponível. -->

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

{{BACKEND_EXTERNAL_CONTRACTS}}

---

### 4.6 Contrato Backend-Storage [Se aplicavel]

<!-- Por operação: tipo (upload/download/delete), formatos aceitos, tamanho máximo, path pattern, controle de acesso (público/privado/presigned URL). -->

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

{{BACKEND_STORAGE_CONTRACTS}}

---

### 4.7 Contrato Backend-Search Engine [Se aplicavel]

<!-- Schema do documento indexado, query parameters aceitos, schema da resposta (paginação, scoring). -->

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

{{BACKEND_SEARCH_CONTRACTS}}

---

### 4.8 Contrato Application-Environment [Obrigatorio]

<!-- Listar TODAS as variáveis que a feature precisa, classificando obrigatória vs opcional e documentando formato. NUNCA documentar valores reais de secrets — só referência. Distinguir Backend, Frontend e Secrets. -->

#### Backend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
{{BACKEND_ENV_VARS}}

#### Frontend

| ID | Nome | Tipo | Obrigatoria | Default | Descricao | Exemplo |
|:---|:---|:---|:---|:---|:---|:---|
{{FRONTEND_ENV_VARS}}

#### Secrets (referencia SOMENTE, nunca valores)

| ID | Nome | Formato | Obrigatoria | Descricao |
|:---|:---|:---|:---|:---|
{{SECRETS_REF}}

---

## 5. Lógica de negócio e algoritmos principais [Obrigatório]

### 5.1 Fluxo principal [Obrigatório]

<!-- Lista numerada de passos observáveis e testáveis, com decisões binárias claras (se X então Y) e validações explícitas, em ordem lógica. -->

{{MAIN_FLOW_CONTENT}}

### 5.2 Casos extremos [Obrigatório]

<!-- Regras de negócio específicas, tratamento de falhas com números (retry: 3x backoff 1s/2s/4s), timeouts, concorrência (optimistic locking), compensating transactions. -->

{{EDGE_CASES_CONTENT}}

---

## 6. Observability & Operational Readiness [Se aplicável]

### 6.1 Logging & Tracing

<!-- Por evento de log: nível (ERROR/WARN/INFO/DEBUG), quando, contexto (dados a incluir). Sempre correlationId; NUNCA logar dados sensíveis (senha, token, cartão). -->

{{LOGGING_CONTENT}}

### 6.2 Métricas (KPIs) [Se aplicável]

<!-- Por métrica: nome descritivo, tipo (Counter/Gauge/Histogram) e unidade. Ex.: payment_processing_duration_seconds (Histogram). -->

{{METRICS_CONTENT}}

---

## 7. Segurança & Compliance [Se aplicável]

<!-- Autenticação/autorização (roles específicos), dados sensíveis identificados, criptografia onde necessária (AES-256), input sanitization (XSS, SQL Injection), criticidade e recomendações (rate limiting). -->

{{SECURITY_CONTENT}}

---

## 8. Plano de Implementação [Obrigatório]

<!-- Máx 10 passos, cada um INDEPENDENTE (vira uma task) e MODULAR (uma camada por passo: Database / Application / Infrastructure / Interface / Tests). Citar arquivos e caminhos; ordem e dependências explícitas. -->

{{IMPLEMENTATION_PLAN_CONTENT}}

---

## 9. Skills e MCPs Utilizados [Obrigatorio]

<!-- OBRIGATÓRIA: nunca omitir, deixar em branco ou manter placeholder. Uma linha por item carregado ou indisponível. Tipo: SKILL|MCP. Origem: PROJETO|GLOBAL. Situacao: UTILIZADO|INDISPONIVEL (se INDISPONIVEL, seções embasadas = Nenhuma). Citar seções/decisões específicas para permitir auditoria. NUNCA transcrever credenciais. Sem itens pertinentes ou inventário vazio → usar a variante de ausência abaixo (NÃO a tabela). -->

<!-- Variante com itens:
| Nome | Tipo | Origem | Situacao | Secoes/Decisoes Embasadas |
|:---|:---|:---|:---|:---|
| techspec-generator | SKILL | PROJETO | UTILIZADO | Secao 4: estrutura de contratos com ID, origem e schemas |
| context7 | MCP | GLOBAL | INDISPONIVEL | Nenhuma |
-->
<!-- Variante de ausência:
Nenhuma skill ou MCP aplicavel a esta especificacao tecnica.
Justificativa: [motivo]
-->

{{SKILLS_MCPS_CONTENT}}

---

**Template Version:** 0.5.0
</content>
