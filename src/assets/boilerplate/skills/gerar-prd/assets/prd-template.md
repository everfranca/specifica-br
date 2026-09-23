# PRODUCT REQUIREMENTS DOCUMENT (PRD)

| Metadata | Details |
| :--- | :--- |
| **Status** | Draft |
| **Data** | {{DATA_ATUAL}} |
| **Feature** | [nome-da-funcionalidade] |
<!-- Status: DRAFT -> IN_PROGRESS -> IN_REVIEW -> APPROVED -->

---

## 1. Contexto e Problema

**O Problema (Estado Atual):**
* [Situação observável e mensurável]

**Causa Raiz (Hipótese):**
* [Por que o problema ocorre]

**O Objetivo (Estado Futuro):**
* [Mudança observável e mensurável após a feature]

### 1.1. Contexto de Research
<!-- O que foi pesquisado antes de gerar o PRD (evita re-perguntar e ancora o documento). -->
* Fontes consultadas: [ex: product_vision.md, specs/features/X]
* Regras de negócio descobertas: [...]
* Restrições encontradas: [...]

---

## 2. Escopo

### 2.1. O que Faremos (In-Scope)
* [ ] Item de escopo 1

### 2.2. O que NÃO Faremos (Out-of-Scope)
* [ ] Funcionalidade futura X
* [ ] Definições de arquitetura técnica (ex: Schema de Banco, Endpoints de API)

**Regra de Escopo**: Qualquer item não listado explicitamente em "O que Faremos" é considerado fora do escopo.

### 2.3. Dependências de Sistema
<!-- Liste apenas dependências que impactem esta feature; se crítica, documente contingência. -->
| ID | Dependência | Tipo (Interna/Externa) | Crítico? | Observações |
|:---|:---|:---|:---|:---|
| DEP-001 | [Ex: API Pagamento] | Externa | Sim | [SLA: 99.9%, Timeout: 5s] |
| DEP-002 | [Ex: Módulo Usuários] | Interna | Não | [Versão >= 2.0] |

---

## 3. Personas e User Stories
<!-- Formato: "Como [persona], quero [ação], para [benefício]". Cada User Story DEVE resultar em >=1 Requisito Funcional. -->

| ID | Persona | Ação (Quero...) | Benefício (Para...) |
|:---|:---|:---|:---|
| US-001 | Contador | Lançar débito automatizado | Reduzir erros manuais em 80% |
| US-002 | Gerente | Aprovar débitos em lote | Agilizar fechamento mensal |

---

## 4. Requisitos Funcionais e Regras de Negócio
<!-- Comportamento observável + Critério testável (passa/falha) + Fonte (US-XXX) + Cenário Gherkin. -->

### 4.1. Regras Principais (Happy Path)
* **[RF-001] Nome do Requisito:**
    * **Comportamento:** [Descrição detalhada do comportamento esperado]
    * **Critério de Sucesso:** [Regra de negócio testável e mensurável]
    * **Fonte:** [US-001, US-002]
    * **Cenário de Teste (Gherkin):**
        - DADO que [precondição]
        - QUANDO [ação do usuário]
        - ENTÃO [resultado observável]

### 4.2. Validações e Restrições
* **[RF-003] Validação de Input:**
    * O sistema deve rejeitar entradas que... [Descreva a regra claramente]
    * **Cenário de Teste:**
        - DADO que [input inválido]
        - QUANDO [usuário submete]
        - ENTÃO [erro específico retornado]

---

## 5. Fluxos de Exceção e Tratamento de Erros (Unhappy Path)
<!-- Severidade: Crítica/Bloqueante | Alta | Média | Baixa. Mensagem = copywriting exato visto pelo usuário. -->

| Cenário de Erro | Severidade | Comportamento do Sistema | Mensagem |
| :--- | :--- | :--- | :--- |
| **[Ex: Input Inválido]** | [Bloqueante] | [Bloquear submissão e destacar campo] | ["O campo X é obrigatório"] |
| **[Ex: API Falha]** | [Alta] | [Repetir 3x com backoff, então falhar gracefully] | ["Serviço temporariamente indisponível. Tente novamente em 5min."] |

---

## 6. Requisitos Não-Funcionais (Qualidade)
<!-- Liste apenas RNFs críticos e testáveis, com métricas específicas (< 2s, > 99.9%, 1000 req/s). -->

* **[RNF-001] Performance:** [Ex: Carregamento não deve exceder 2s para 95% das requisições]
* **[RNF-002] Disponibilidade:** [Ex: Sistema disponível 99.5% do tempo (SLA)]
* **[RNF-003] Segurança:** [Ex: Dados sensíveis criptografados em repouso]

**Regra:** Apenas Requisitos Não-Funcionais explicitamente listados aqui devem ser considerados.

---

## 7. Itens em Aberto e Dúvidas (TBD)
<!-- Decisões ainda não tomadas. A feature não pode ser DONE com TBDs de impacto Alto. -->

| ID | Questão / Dúvida | Quem deve responder? | Impacto | Ação Decisória |
| :--- | :--- | :--- | :--- | :--- |
| **[TBD-001]** | [Ex: Qual o texto final da mensagem de erro?] | [Marketing/Legal] | [Baixo - Copywriting] | [Definir até Q2] |
| **[TBD-002]** | [Ex: Qual gateway de pagamento usar?] | [Arquitetura/Finanças] | [Alto - Bloqueia desenvolvimento] | [Decisão antes do início] |

---

## 8. Critérios de Aceite (Definition of Done)
<!-- Cada critério deve ser binário (passa/falha). Seja conservador. -->

Para considerar esta feature concluída, o sistema deve:
1. [ ] Cumprir todos os Requisitos Funcionais listados (seção 4).
2. [ ] Tratar graciosamente todos os Fluxos de Exceção listados (seção 5).
3. [ ] Não haver Itens em Aberto (TBD) com impacto "Alto" ou "Bloqueante" (seção 7).
4. [ ] Todos os Requisitos Não-Funcionais (seção 6) foram atendidos e validados.
5. [ ] Testes automatizados cobrem >= 80% dos cenários Happy Path e Unhappy Path.
6. [ ] Documentação de usuário (se aplicável) está atualizada.

**Regra de Ouro:** A feature só pode ser DONE se todos os RF-XXX e RNF-XXX associados estiverem atendidos e validados.

---

**Template Version:** 0.1.0
