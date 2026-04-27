# Segurança e Hardening

Referência técnica para segurança ao gerar Tech Specs.

## Sumário

1. [OWASP Top 10 no Contexto de Specs](#1-owasp-top-10-no-contexto-de-specs)
2. [Autenticação e Autorização](#2-autenticacao-e-autorizacao)
3. [Proteção de Dados](#3-protecao-de-dados)
4. [Validação de Input](#4-validacao-de-input)
5. [Configuração de Segurança](#5-configuracao-de-seguranca)
6. [Matriz de Segurança por Endpoint](#6-matriz-de-seguranca-por-endpoint)

---

## 1. OWASP Top 10 no Contexto de Specs

### O que especificar na TechSpec para cada risco:

| # | Risco OWASP | O que documentar na TechSpec |
|:---|:---|:---|
| **A01** | Broken Access Control | Auth por endpoint, ownership checks, role-based access |
| **A02** | Cryptographic Failures | Dados sensíveis criptografados, TLS, hashing de senhas |
| **A03** | Injection | Query parametrizada, input sanitization, ORM usage |
| **A04** | Insecure Design | Threat modeling, validação em todas as camadas |
| **A05** | Security Misconfiguration | Headers de segurança, CORS, error messages sem stack trace |
| **A06** | Vulnerable Components | Verificar versões de dependências, lock files |
| **A07** | Auth Failures | Rate limiting em auth, session management, MFA |
| **A08** | Software/Data Integrity | CI/CD pipeline seguro, validação de webhooks |
| **A09** | Logging Failures | Audit logging, dados sensíveis NOS logs |
| **A10** | SSRF | Validar URLs de webhook, whitelist de serviços |

---

## 2. Autenticação e Autorização

### 2.1. Padrões de Autenticação

| Padrão | Quando usar | O que especificar |
|:---|:---|:---|
| **JWT Bearer** | APIs stateless | Algoritmo (RS256), expiry, refresh token strategy |
| **OAuth2** | Login social, third-party | Provider, scopes, flow (Authorization Code) |
| **API Key** | Service-to-service | Header (X-API-Key), rotation, scope |
| **Session** | Apps web tradicionais | Cookie httpOnly, secure, sameSite |

### 2.2. JWT - O que Especificar

```
Authentication: JWT Bearer Token
Header: Authorization: Bearer {token}
Algoritmo: RS256 (asymmetric, recomendado) ou HS256
Expiry: 15 minutos (access token) + 7 dias (refresh token)
Issuer: auth.example.com
Audience: api.example.com
Claims: { sub: userId, role: user_role, exp: timestamp }
Refresh: POST /api/v1/auth/refresh com refresh_token no body
Blacklist: Redis para tokens revogados (TTL = expiry)
```

### 2.3. Autorização

**Role-Based Access Control (RBAC):**
```
Roles: ADMIN, MANAGER, CUSTOMER

Permissions por endpoint:
| Role | POST /orders | GET /orders | DELETE /orders/{id} |
|:---|:---|:---|:---|
| ADMIN | Qualquer | Todos | Qualquer |
| MANAGER | Qualquer | Todos | Qualquer |
| CUSTOMER | Próprio | Próprios | Próprio (se PENDING) |
```

**Ownership Check (Resource-Level):**
```
GET /api/v1/orders/{id}:
1. Verificar se order existe (404 se não)
2. Verificar se user.role == ADMIN OU order.userId == user.id (403 se não)
```

---

## 3. Proteção de Dados

### 3.1. Dados Sensíveis

| Categoria | Exemplos | Tratamento |
|:---|:---|:---|
| **Credenciais** | Senhas, tokens, API keys | Hash (Argon2id/bcrypt), NUNCA logar, NUNCA retornar em API |
| **PII** | CPF, RG, endereço | Criptografia em repouso (AES-256), masking em logs |
| **Financeiro** | Cartão, conta bancária | Tokenização, PCI compliance, NUNCA armazenar completo |
| **Saúde** | Dados médicos | Criptografia forte, LGPD/HIPAA compliance |
| **Children** | Dados de menores | Consentimento parental, proteção reforçada |

### 3.2. Criptografia

| Contexto | Algoritmo | Uso |
|:---|:---|:---|
| **Senhas (hashing)** | Argon2id (preferido) ou bcrypt (cost ≥ 12) | Armazenamento de senhas |
| **Dados em repouso** | AES-256-GCM | Campos sensíveis no banco |
| **Dados em trânsito** | TLS 1.3 (mínimo TLS 1.2) | HTTPS para todas as APIs |
| **Assinatura** | RS256 / ES256 | JWT, webhooks |
| **Chaves simétricas** | HKDF para derivação | Derivar chaves de master key |

### 3.3. Especificação na TechSpec

```
Dados Sensíveis:
- password: Hash com Argon2id (conforme padrão em AuthService)
- cpf: AES-256-GCM em repouso, masking em logs (***.***.***-**)
- credit_card: NÃO armazenar, usar tokenização do gateway (Stripe)
- email: Armazenado em claro, mas NÃO logar

Logs:
- NUNCA logar: password, token, credit_card, cpf completo
- SEMPRE mascarar em logs: cpf → "***.***.***-**", email → "j***@example.com"
```

---

## 4. Validação de Input

### 4.1. Estratégia por Camada

| Camada | Validação | Objetivo |
|:---|:---|:---|
| **Interface** | Schema validation (Zod, Joi, FluentValidation) | Rejeitar requests inválidos cedo |
| **Application** | Business rules validation | Garantir regras de negócio |
| **Domain** | Entity invariants | Garantir consistência do domínio |
| **Database** | Constraints (CHECK, NOT NULL, FK) | Última barreira de integridade |

### 4.2. Sanitização

| Tipo | Risco | Prevenção |
|:---|:---|:---|
| **SQL Injection** | Acesso não autorizado ao banco | Query parametrizada (ORM prepared statements) |
| **XSS** | Execução de script no browser | Escape HTML, Content-Security-Policy, sanitize input |
| **CSV Injection** | Execução de fórmulas em Excel | Sanitizar prefixos (=, +, -, @) |
| **Path Traversal** | Acesso a arquivos do sistema | Validar paths, whitelist de diretórios |
| **Command Injection** | Execução de comandos do SO | NUNCA concatenar input em commands |

### 4.3. Na TechSpec

```
Validação de Input:
- Schema: Zod (conforme padrão do projeto)
- Campos de texto: trim + escape HTML
- Email: regex + verificação de formato
- UUID: validação de formato v4
- Números: min/max bounds
- Arrays: max length + item validation
- SQL: Prisma ORM com prepared statements (sem raw queries)
- Upload: whitelist de extensões, max size 5MB, magic bytes validation
```

---

## 5. Configuração de Segurança

### 5.1. HTTP Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0 (desativar, usar CSP)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 5.2. CORS

```
Origins permitidos: https://app.example.com, https://admin.example.com
Methods: GET, POST, PUT, PATCH, DELETE
Headers: Content-Type, Authorization, X-Request-Id
Credentials: true (para cookies)
Max Age: 86400 (24h)

NUNCA: Access-Control-Allow-Origin: * em produção
```

### 5.3. Rate Limiting

```
Rate Limiting:
- Storage: Redis (conforme padrão do projeto)
- Key: user_id para autenticado, IP para anônimo
- Strategy: Sliding window
- Response: 429 com Retry-After header

Endpoints:
| Endpoint | Limite | Janela |
|:---|:---|:---|
| POST /auth/login | 5 req | 1 minuto por IP |
| POST /auth/refresh | 20 req | 1 minuto por user |
| POST /orders | 10 req | 1 minuto por user |
| GET /orders | 100 req | 1 minuto por user |
```

### 5.4. Secrets Management

```
NUNCA:
- Hardcoded secrets no código
- Secrets em arquivos versionados (.env em .gitignore)
- Secrets em logs ou error messages

SEMPRE:
- Environment variables para configuração
- Secret Manager para produção (AWS Secrets Manager, Vault)
- Rotação de secrets planejada

Na TechSpec:
- Listar variáveis de ambiente necessárias (NOMES apenas, sem valores)
- Documentar rotación policy
- Documentar onde secrets são armazenados em cada ambiente
```

---

## 6. Matriz de Segurança por Endpoint

Template para documentar segurança na TechSpec:

```
| Endpoint | Auth | Role/Permission | Dados Sensíveis | Rate Limit | Notas |
|:---|:---|:---|:---|:---|:---|
| POST /api/v1/auth/login | Nenhum | Público | Password (transit only) | 5/min/IP | Retorna JWT |
| POST /api/v1/auth/refresh | JWT | Qualquer | Refresh token | 20/min/user | Renova access token |
| GET /api/v1/users | JWT | ADMIN | Email (masked) | 100/min/user | Listar todos |
| GET /api/v1/users/{id} | JWT | ADMIN ou owner | Email, CPF (masked) | 100/min/user | Ownership check |
| POST /api/v1/orders | JWT | CUSTOMER+ | Nenhum | 10/min/user | Idempotent key |
| GET /api/v1/orders | JWT | ADMIN=all, CUSTOMER=own | Nenhum | 100/min/user | Filtered by role |
| DELETE /api/v1/orders/{id} | JWT | ADMIN ou owner (PENDING) | Nenhum | 5/min/user | Soft delete |
| POST /api/v1/payments | JWT + Idempotency | CUSTOMER+ | Card token (Stripe) | 5/min/user | Non-retryable errors |
```
