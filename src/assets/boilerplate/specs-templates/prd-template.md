# PRODUCT REQUIREMENTS DOCUMENT (PRD)

| Metadata | Details |
| :--- | :--- |
| **Status** | Draft |
| **Data** | {{DATA_ATUAL}} |
| **Feature** | [nome-da-funcionalidade] |
<!-- Status: DRAFT → IN_PROGRESS → APPROVED -->

---

## 1. Contexto e Problema
**O Problema (Estado Atual):**
    * [Situação observável e mensurável]

**Causa Raiz (Hipótese):**
    * [Por que o problema ocorre]

**O Objetivo (Estado Futuro):**
    * [Mudança observável após a feature]

---

## 2. Escopo

### 2.1. O que Faremos (In-Scope)
* [ ] Item de escopo 1

### 2.2. O que NÃO Faremos (Out-of-Scope)
* [ ] Funcionalidade futura X
* [ ] Definições de arquitetura técnica (ex: Schema de Banco, Endpoints de API)

** Regra de Escopo**: Qualquer item não listado explicitamente em "O que Faremos" deve ser considerado fora do escopo.

---

## 3. Personas e User Stories

| [UserStoryID] | **[Persona]** | [Ação] | [Benefício] |
| :--- | :--- | :--- | :--- |
|US-001 | Contador  | Lançamento de Débito| Seja cadastrado com sucesso |

**Cada User Story deve resultar em pelo menos um Requisito Funcional.**

---

## 4. Requisitos Funcionais e Regras de Negócio
### 4.1. Regras Principais (Happy Path)
* **[RF-001] Nome do Requisito:**
    * **Comportamento:** [Descrição detalhada do comportamento esperado]
    * **Critério:** [Regra de negócio explícita]
    * **Fonte:** [US-001, US-002]

### 4.2. Validações e Restrições
* **[RF-003] Validação de Input:**
    * O sistema deve rejeitar entradas que... [Descreva a regra]

---

## 5. Fluxos de Exceção e Tratamento de Erros (Unhappy Path)
| Cenário de Erro | Severidade | Comportamento do Sistema | Mensagem |
| :--- | :--- | :--- |
| **[Ex: Input Inválido]** | [Bloquear envio] | ["O campo X é obrigatório"] |

---

## 6. Requisitos Não-Funcionais (Qualidade)
* **[RNF-001] Performance:** [Ex: O carregamento não deve exceder 2 segundos]
**Apenas Requisitos Não-Funcionais explicitamente listados aqui devem ser considerados.**

---

## 7. Itens em Aberto e Dúvidas (TBD)
| ID | Questão / Dúvida | Quem deve responder? | Impacto |
| :--- | :--- | :--- | :--- |
| **[TBD-001]** | [Ex: Qual o texto final da mensagem de erro?] | [Marketing/Legal] | [Baixo - Apenas Copywriting] |

---

## 8. Critérios de Aceite (Definition of Done)
Para considerar esta feature concluída, o sistema deve:
1. [ ] Cumprir todos os Requisitos Funcionais listados.
2. [ ] Tratar graciosamente todos os Fluxos de Exceção listados.
3. [ ] Não haver Itens em Aberto (TBD) com impacto "Alto" ou "Bloqueante".
** A feature só pode ser considerada concluída se todos os RF-XXX e RNF-XXX associados estiverem marcados como atendidos. **