# Roteiros de Entrevista (Produto e Arquitetura por Nível)

## Sumário

1. [Fase de Produto: entrevista inicial](#1-fase-de-produto-entrevista-inicial)
2. [Fase Técnica: entrevista de arquitetura](#2-fase-técnica-entrevista-de-arquitetura)

## 1. Fase de Produto: entrevista inicial

### 1.1. Coleta de input inicial

Pergunta inicial:

```
Descreva sua ideia de projeto ou software em uma frase:
[Exemplo: "Quero criar um sistema de agendamento para clínicas médicas"]

Forneça também:
- Qual o principal problema que este software resolve?
- Quem são os principais usuários que se beneficiarão?
```

**Aguarde resposta do usuário antes de prosseguir.**

### 1.2. Clarificação progressiva

Após o input inicial, faça perguntas de clarificação **somente sobre o que falta**.

**Regras de ouro:**
- **MÁXIMO 8 perguntas por rodada**
- **Foco em negócio:** NUNCA pergunte sobre tecnologia
- **Ordem por impacto:** perguntas de alto impacto primeiro

**Áreas de investigação (Produto):**

**A. Escopo e Fronteiras:**
- "O que este software NÃO deve fazer?" (Out-of-Scope explícito)
- "Qual é o escopo mínimo viável para validar a ideia?"

**B. Métricas de Sucesso:**
- "Como você saberá se o software foi bem-sucedido?" (KPIs, resultados observáveis)
- "Qual comportamento ou resultado você espera medir?"

**C. Personas e Usuários:**
- "Quem são os principais tipos de usuários?" (não cargos, mas perfis comportamentais)
- "Quais são as principais dores que cada persona enfrenta hoje?"

**D. Diferenciação:**
- "O que torna esta solução única comparada a alternativas existentes?"
- "Por que usuários escolheriam este software vs solução atual?"

**E. Validação:**
- "Você já validou este problema com usuários reais?"
- "Existe algum sinal de que este é um problema real?"

### 1.3. Critério de parada

Pare de perguntar quando:
- [ ] Problema central está claro
- [ ] Personas principais definidas
- [ ] Métricas de sucesso estabelecidas
- [ ] Escopo (IN/OUT) delimitado
- [ ] Proposta de valor identificada

**Output esperado:** input de usuário qualificado e detalhado o suficiente para gerar product_vision.md. Se as respostas trouxerem menções técnicas, explique que serão tratadas na fase técnica.

## 2. Fase Técnica: entrevista de arquitetura

### 2.1. Perguntas baseadas em profundidade

**Para TODOS os níveis (HIGH/MEDIUM/COMPREHENSIVE):**

**A. Paradigma Arquitetural:**
- "Qual paradigma arquitetural você prefere? (Ex: Clean Architecture, DDD, Microservices, Monolith tradicional)"
- "Existe alguma restrição técnica que eu deva saber? (Ex: Time conhece apenas .NET, Orçamento limitado requer PostgreSQL gratuito)"

**B. Stack Tecnológico — Backend:**
- "Qual linguagem de programação e versão? (Ex: C# 12, Python 3.11, Node 20)"
- "Qual framework? (Ex: ASP.NET Core, Express, FastAPI)"
- "Qual banco de dados? (Ex: PostgreSQL 15, SQL Server, MongoDB)"

**C. Stack Tecnológico — Frontend (se aplicável):**
- "Haverá interface web/mobile?"
- "Se sim, qual framework e versão? (Ex: Vue.js 3.4, React 18, Angular 16)"

**D. Cloud/Infraestrutura:**
- "Onde será hospedado? (Ex: AWS, Azure, On-premise, VPS barato)"
- "Há preferência por containerização? (Docker, Kubernetes)"

**E. Convenções:**
- "Existem padrões de código que o time já segue? (Ex: Nomenclatura PascalCase, Interfaces com I prefix)"

**Para MEDIUM DETAIL (adicional):**
- "Como você prefere organizar a estrutura de pastas? (Ex: por feature, por layer)"
- "Qual abordagem de API você prefere? (REST, GraphQL, gRPC)"
- "Como será a estratégia de testes? (Unit, Integration, E2E)"

**Para COMPREHENSIVE (adicional):**
- "Qual ferramenta de CI/CD você prefere? (GitHub Actions, GitLab CI, Azure DevOps)"
- "Como você quer monitorar a aplicação em produção? (Prometheus+Grafana, DataDog, CloudWatch)"
- "Qual estratégia de deploy? (Blue-green, Rolling, Canary)"
- "Como você fará autenticação e autorização? (JWT, OAuth, Sessions)"

### 2.2. Clarificação técnica

**Regras de ouro:**
- **MÁXIMO 10 perguntas por rodada**
- **Foco em implementação:** NUNCA pergunte sobre regras de negócio
- **Justificar novidades:** se sugerir nova tecnologia, explicar por que

**[OK] BOA PERGUNTA TÉCNICA:** "Você mencionou PostgreSQL. Exige alguma extensão específica? (Ex: PostGIS para dados geográficos, pgcrypto para criptografia)"

### 2.3. Critério de parada

Pare de perguntar quando:
- [ ] Paradigma arquitetural definido
- [ ] Stack completa (Backend, Frontend, DB) com versões
- [ ] Infraestrutura básica definida (cloud/onde rodar)
- [ ] Convenções de código estabelecidas
- [ ] [MEDIUM] Estrutura de diretórios clara
- [ ] [COMPREHENSIVE] CI/CD, monitoring e estratégia de deploy definidos

**Output esperado:** input técnico qualificado com versões específicas (não apenas ".NET" mas ".NET 8"), detalhado o suficiente para gerar architecture.md. Se as respostas trouxerem menções de negócio, redirecione para product_vision.md.
