# Varredura do Repositório (Passo 2)

## Sumário

1. [Análise de Stack Tecnológica](#1-análise-de-stack-tecnológica)
2. [Mapeamento de Integrações Externas](#2-mapeamento-de-integrações-externas)
3. [Análise de Maturidade de Testes](#3-análise-de-maturidade-de-testes)
4. [Estrutura de Diretórios e Padrões de Código](#4-estrutura-de-diretórios-e-padrões-de-código)
5. [Checkpoint e outputs](#5-checkpoint-e-outputs)

## 1. Análise de Stack Tecnológica

**Arquivos a verificar (agnóstico a linguagem):**
- `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `npm-shrinkwrap.json` (Node.js)
- `.csproj`, `.sln`, `packages.config` (.NET)
- `requirements.txt`, `pyproject.toml`, `Pipfile`, `poetry.lock` (Python)
- `go.mod`, `go.sum` (Go)
- `Gemfile`, `Gemfile.lock` (Ruby)
- `pom.xml`, `build.gradle` (Java)
- `composer.json`, `composer.lock` (PHP)
- `Cargo.toml`, `Cargo.lock` (Rust)

**Para cada arquivo detectado:**
1. Ler completamente.
2. Extrair dependências principais e versões.
3. Identificar frameworks e bibliotecas core.
4. Detectar scripts de build/test/deploy.

**Exemplo de saída (mantenha internamente):**

```
Stack Detectada:
- Linguagem: TypeScript 5.3 (package.json: "typescript": "^5.3")
- Framework: Node.js 20 (package.json: "engines": { "node": ">=20" })
- Backend: Express.js 4.18 ("express": "^4.18.2")
- Frontend: Vue.js 3.4 ("vue": "^3.4.21")
- Database: PostgreSQL via Prisma ("@prisma/client": "^5.8.0")
- Testing: Jest 29.7 ("@jest/globals": "^29.7.0")
```

## 2. Mapeamento de Integrações Externas

Objetivo: identificar APIs de terceiros, serviços e dependências externas.

**CHECKLIST DE ANÁLISE:**

```
[ ] APIS DE TERCEIROS
   - Buscar por keywords em código: "stripe", "aws", "google", "firebase", "twilio", "sendgrid", "paypal"
   - Verificar imports:
     * from 'stripe' or from '@stripe/stripe-js'
     * from '@aws-sdk/client-s3' or from 'aws-sdk'
     * from 'firebase-admin' or from '@firebase/app'
   - Identificar em arquivos de config:
     * .env.example (STRIPE_API_KEY, AWS_ACCESS_KEY_ID)
     * appsettings.json (Stripe:SecretKey)
     * config/services.yml

[ ] WEBHOOKS E CALLBACKS
   - Detectar endpoints:
     * /webhooks/*, /hooks/*, /callbacks/*
     * Buscar rotas: router.post('/webhooks/stripe')
     * Controllers: WebhookController, StripeWebhookController
   - Verificar handlers de webhook:
     * Métodos: handleWebhook, processWebhook, verifySignature
     * Middleware de verificação de assinatura
   - Identificar webhooks configurados:
     * Stripe Dashboard (webhooks)
     * Console AWS (SNS subscriptions)
     * Configuração de callbacks (URLs)

[ ] RATE LIMITING E RETRIES
   - Buscar bibliotecas:
     * "express-rate-limit", "rate-limiter-flexible"
     * "@aws-sdk/protocol-tcp", "axios-retry"
   - Verificar configurações:
     * rateLimit: { windowMs: 900000, max: 100 }
     * retry: { retries: 3, backoff: true }
   - Identificar circuit breakers:
     * "opossum", "circuit-breaker-js"
     * @CircuitBreaker decorator (TypeScript)

[ ] AUTHENTICATION EXTERNA
   - OAuth providers:
     * "passport-google-oauth20", "passport-facebook", "next-auth"
     * "react-oauth/google", "@react-oauth/google"
   - JWT libraries:
     * "jsonwebtoken", "jose", "jwt-decode"
   - SSO configurations:
     * SAML: "passport-saml"
     * LDAP: "passport-ldapauth"
   - Detectar em código:
     * OAuth flow: /auth/google, /auth/callback
     * JWT verification: jwt.verify(token, secret)
     * Middleware: authenticateToken, requireAuth
```

**EXEMPLO DE SAÍDA (mantenha internamente):**

```
Integrações Detectadas:

| Serviço | Tipo | Detalhes |
|:---|:---|:---|
| **Stripe** | Payment | v14.2 (@stripe/stripe-js), webhooks em /api/webhooks/stripe |
| **AWS S3** | Storage | @aws-sdk/client-s3 v3.450, presigned URLs para uploads |
| **SendGrid** | Email | @sendgrid/mail v7.7, templates transactionais |
| **Google OAuth** | Auth | passport-google-oauth20 v2.0, callback /auth/google/callback |
| **Redis** | Cache | ioredis v5.3, rate limiting: 100 req/15min por IP |
```

## 3. Análise de Maturidade de Testes

Objetivo: avaliar qualidade e cobertura de testes existentes.

**CHECKLIST DE ANÁLISE:**

```
[ ] FRAMEWORK DE TESTES
   - Detectar framework:
     * JavaScript/TypeScript: jest, vitest, mocha, jasmine, ava
     * .NET: xUnit, NUnit, MSTest
     * Python: pytest, unittest, nose2
     * Ruby: RSpec, minitest
     * Java: JUnit, TestNG
   - Verificar configuração:
     * jest.config.js, vitest.config.ts
     * pytest.ini, pyproject.toml [tool.pytest]
     * .rspec, spec/spec_helper.rb
   - Identificar runner:
     * npm test, npm run test
     * dotnet test, pytest, rspec

[ ] TIPOS DE TESTES
   - Unit tests:
     * Diretório: /tests/unit/, /test/unit/, __tests__
     * Padrão de arquivo: *.test.ts, *.spec.cs, test_*.py
     * Framework-specific: describe(), [Fact], def test_
   - Integration tests:
     * Diretório: /tests/integration/, /test/integration/
     * Padrão: *.integration.ts, *.IntegrationTests.cs
     * TestContainers, database em memória
   - E2E tests:
     * Diretório: /tests/e2e/, /e2e/, cypress/, playwright/
     * Framework: cypress, playwright, selenium
     * Testes de UI completos

[ ] COVERAGE (SE DISPONÍVEL)
   - Verificar coverage reports:
     * coverage/, .coverage/, coverage-output/
     * lcov.info, coverage.json
     * Jest: npm run test:coverage
   - Identificar configuração:
     * jest: --coverage, collectCoverage: true
     * pytest: --cov, pytest-cov
     * .NET: dotnet test --collect:"XPlat Code Coverage"
   - Thresholds:
     * Buscar: coverageThreshold: { statements: 80, branches: 80 }
     * Configuration: minimum coverage 80%

[ ] FIXTURES E MOCKS
   - Detectar factories:
     * FactoryBot, factory_bot_rails (Ruby)
     * jest-fixture, ts-auto-mock (TypeScript)
     * Faker.js, @faker-js/faker
   - Mock libraries:
     * sinon, jest.mock, unittest.mock
     * moq, NSubstitute (.NET)
     * mockito (Java)
   - Test data:
     * fixtures/, __fixtures__/, testData/
     * seeds/, /tests/seeds/
```

**EXEMPLO DE SAÍDA (nível de maturidade):**

```
Matriz de Maturidade de Testes:

| Framework | Jest v29.7 + Testing Library |
|:---|:---|
| **Tipos** | Unit (70%), Integration (20%), E2E (10%) |
| **Coverage** | 62% (cobertura parcial) |
| | - Statements: 58% |
| | - Branches: 54% |
| | - Functions: 65% |
| | - Lines: 62% |
| **Fixtures** | Jest fixtures em /__tests__/fixtures |
| | Faker.js para dados fake |
| **Nível de Maturidade** | INTERMEDIÁRIO |
| | - Framework configurado |
| | - Coverage abaixo de 70% |
| | - Testes de integração presentes |
| | - Ausência de testes E2E completos |
```

## 4. Estrutura de Diretórios e Padrões de Código

**CHECKLIST:**

```
[ ] ESTRUTURA DE PASTAS
   - Organização principal:
     * /src, /app, /lib, /server?
     * Por feature ou por layer?
   - Módulos detectados:
     * /src/users, /src/orders, /src/payments
     * /features/, /domains/, /contexts/

[ ] CONVENÇÕES DE NOMEAÇÃO
   - Classes:
     * PascalCase (User, UserService)
     * camelCase (user, userService)
   - Arquivos:
     * kebab-case (user-service.ts)
     * PascalCase (UserService.cs)
     * snake_case (user_service.rb)
   - Testes:
     * FeatureName.test.ts, User.spec.cs

[ ] PADRÕES ARQUITETURAIS
   - Separation of concerns:
     * Controllers/Handlers/Resolvers?
     * Services/Use Cases?
     * Repositories/DAOs?
   - Design patterns:
     * Dependency Injection (constructor injection?)
     * Factory/Builder?
     * Strategy/Template Method?

[ ] BIBLIOTECAS E UTILITÁRIOS
   - Pastas comuns:
     * /common, /shared, /utils, /helpers
     * /lib, /core, /base
   - Logging:
     * winston, pino, serilog
   - Validation:
     * zod, yup, joi, class-validator, FluentValidation
```

## 5. Checkpoint e outputs

**Checkpoint de Validação:**
- [ ] Stack tecnológica identificada (linguagens, frameworks, versões)
- [ ] Integrações externas mapeadas (APIs, webhooks, rate limiting)
- [ ] Maturidade de testes avaliada (framework, coverage, tipos)
- [ ] Estrutura de diretórios analisada
- [ ] Padrões de código identificados

**Output Esperado:**
- Tabela de Stack Tecnológico
- Catálogo de Integrações Externas
- Matriz de Maturidade de Testes
- Mapa de Estrutura de Diretórios
