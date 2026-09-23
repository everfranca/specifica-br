<!-- Os comentarios <!-- ... --> deste template sao apenas para autoria e NAO devem aparecer no task-N.md final. Remova-os ao gerar. -->
# Task: {{TASK_ID}} - {{TASK_TITLE}}

| Metadata | Details |
| :--- | :--- |
| **Status** | [TODO | IN_PROGRESS | DONE] |
| **Data** | {{DATA_ATUAL}} |
| **Task** | {{TASK_TITLE}} |
| **Feature** | [nome-da-funcionalidade] |
| **Referência PRD** | [Link PRD](./specs/features/[nome-da-funcionalidade]/prd.md) |
| **Referência Tech Spec** | [Link Tech Spec](./specs/features/[nome-da-funcionalidade]/techspec.md) |

## 1. Contexto e Objetivo
{{CONTEXT_CONTENT}}
<!-- Só orientação de execução; não reinterprete nem adicione objetivos fora do PRD. -->

---

## 2. Requisitos da Tarefa
### 2.1 Funcionais (Comportamento)
<!-- Cada requisito mapeia 1:1 com o PRD. -->
- [ ] (RF-XXX) ...
- [ ] (RF-XXX) ...

### 2.2 Técnicos (Implementação)
- [ ] Seguir APENAS os padrões da seção {{ITEM_REF}} do techspec.md
- [ ] Utilizar exclusivamente as bibliotecas abaixo (proibido adicionar dependências):
{{LIBS_LIST}}
- [ ] Tratamento de erros conforme padrão do projeto.

### 2.3 Contratos (Boundaries)
<!-- Checklist dos contratos (seção 4 do techspec.md) que esta task toca. Schema completo vive na §4; aqui só ID, direção, seção e validações. Origem: DESCOBERTO | SOLICITADO | PROPOSTO. -->

#### Contratos de Entrada
- [ ] ({{CONTRACT_ID}}) {{CONTRACT_NAME}} - Seção {{TECHSPEC_SECTION}} do techspec.md - origem: {{ORIGEM}} - validações: {{VALIDATIONS_REF}} (schema completo em §4)

#### Contratos de Saída
- [ ] ({{CONTRACT_ID}}) {{CONTRACT_NAME}} - Seção {{TECHSPEC_SECTION}} do techspec.md - status/erros: {{ERROR_CODES_REF}} (schema completo em §4)

#### Contratos de Configuração (Variáveis de ambiente)
- [ ] ({{ENV_ID}}) {{ENV_VAR_NAME}} - obrigatória: {{REQUIRED}}, default: {{DEFAULT_VALUE}}

---

## 3. Plano de Execução (Sub-tarefas)
<!-- Passos em ordem; um passo só conclui se os arquivos-alvo mudarem; não avance com erro. -->

- [ ] **Passo 1: Estruturas de Dados e Contratos**
    - *Ação:* Criar interfaces, DTOs, Enums ou Tabelas.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_1}}`
    - *Critério de Saída:* Tipos/estruturas compilam e ficam acessíveis aos passos seguintes.

- [ ] **Passo 2: Implementação da Lógica de Negócio**
    - *Ação:* Implementar o algoritmo, regra de negócio ou fluxo principal.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_2}}`
    - *Critério de Saída:* Lógica compila sem erros e cobre o comportamento da §2.1.

- [ ] **Passo 3: Integração e Exposição**
    - *Ação:* Conectar a lógica a APIs, UI, CLI ou Banco de Dados.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_3}}`
    - *Critério de Saída:* Integração compila e o contrato fica exposto conforme §4.

- [ ] **Passo 4: Testes e Validação**
    - *Ação:* Criar testes unitários ou de integração.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_4}}`
    - *Critério de Saída:* Testes criados e passando (suíte completa verde).

---

## 4. Detalhes de Implementacao & Contratos
<!-- Fonte única dos schemas: extraídos da techspec.md §4; a implementação DEVE respeitá-los. Inclua 1 exemplo canônico curto ancorado em código real do repositório. Desvios -> justificar na §8. -->

* **Contrato(s) Implementado(s):** {{CONTRACT_IDS}} (ref: techspec.md seção {{TECHSPEC_SECTIONS}})
* **Nomenclatura Esperada:** `{{NAMING_CONVENTION}}`
* **Schema de Entrada (obrigatorio):**
    ```json
    {{INPUT_EXAMPLE}}
    ```
* **Schema de Saida (obrigatorio):**
    ```json
    {{OUTPUT_EXAMPLE}}
    ```
* **Schema de Erro (obrigatorio):**
    ```json
    {{ERROR_EXAMPLE}}
    ```
* **Headers/Metadata:**
    ```json
    {{HEADERS_EXAMPLE}}
    ```
* **Variaveis de Ambiente Necessarias:**
    - `{{ENV_VAR_A}}` - {{descricao}}
    - `{{ENV_VAR_B}}` - {{descricao}}
* **Restricoes:** não alterar assinaturas públicas; não introduzir parâmetros opcionais não documentados; schemas DEVEM conferir com a techspec.md §4.

---

## 5. Contexto de Arquivos (File Context)
<!-- Fonte AUTORITATIVA de escopo de arquivos. Leitura permitida SOMENTE aos arquivos de 5.1; escrita SOMENTE aos de 5.2. Exceção: arquivos das skills declaradas na §9 são autorizados para leitura. -->
### 5.1 Arquivos de Leitura (Referência/Exemplos)
- `./specs/features/[nome-da-funcionalidade]/prd.md`
- `./specs/features/[nome-da-funcionalidade]/techspec.md`
- `{{EXAMPLE_FILE_PATH}}` (código existente similar, base do exemplo canônico da §4)

### 5.2 Arquivos Permitidos para Escrita (Alvos)
- `{{TARGET_FILE_A}}`
- `{{TARGET_FILE_B}}`
- `{{TARGET_FILE_C}}`

---

## 6. Criterios de Aceite (Definition of Done)
- [ ] O código compila/executa sem erros de sintaxe.
- [ ] Todos os requisitos funcionais da §2.1 foram atendidos.
- [ ] Todos os contratos da §2.3 foram implementados conforme techspec.md §4.
- [ ] Schemas de entrada/saída conferem exatamente com a techspec.
- [ ] Códigos de erro e responses documentados foram implementados.
- [ ] Variáveis de ambiente obrigatórias documentadas e validadas no startup.
- [ ] Os testes (Passo 4) foram criados e estão passando.
- [ ] Não há código comentado ou "TODOs" residuais.
- [ ] A implementação respeita a arquitetura da `./specs/features/[nome-da-funcionalidade]/techspec.md`.
- [ ] Todos os passos da §3 estão concluídos.
- [ ] Evidência de Skills e MCPs registrada na §8 para todos os itens da §9.
- [ ] Evidência de Contexto de Execução registrada na §8.
- [ ] Esta task foi marcada como DONE em `./specs/features/[nome-da-funcionalidade]/tasks.md`.

### 6.1 Efeitos Colaterais Obrigatórios
- [ ] Status da task atualizado para DONE.
- [ ] `./specs/features/[nome-da-funcionalidade]/tasks.md` atualizado corretamente.

---

## 7. Arquivos Relevantes (Obrigatório)
<!-- Referência apenas. Escopo de leitura/escrita é o da §5; NÃO relistar alvos aqui. -->
Outros arquivos de referência (docs, ADRs) úteis à task que NÃO liberam escrita. Para escopo de leitura/escrita, ver §5.

## 8. Notas de Execução (Scratchpad)
[Decisões técnicas relevantes. Não repetir o já documentado.]

### Evidencia de Skills e MCPs
<!-- Ao final da execução, uma linha por item da §9. `Situacao`: CARREGADO E UTILIZADO | CARREGADO E NAO UTILIZADO (exige Justificativa) | INDISPONIVEL. `Passos`: passos da §3 onde aplicado, ou N/A. Registro completo é critério de aceite bloqueante (sem ele não há DONE). Sem §9, registre a ausência aqui. Nunca registrar credenciais/tokens/chaves. -->

| Item | Tipo | Origem | Situacao | Passos | Justificativa |
|:---|:---|:---|:---|:---|:---|

### Evidencia de Contexto de Execucao
<!-- Ao final: se contexto-execucao.md foi usado (SIM ou AUSENTE), fontes abertas mesmo assim e por que, e divergencias entre contexto e fonte. Registro obrigatorio antes de DONE. -->
| Contexto usado | Fontes abertas mesmo assim | Motivo | Divergencias |
|:---|:---|:---|:---|

---

## 9. Skills e MCPs
<!-- Declare nominalmente só as skills/MCPs pertinentes a ESTA task. Seção OBRIGATÓRIA: nunca omitir, deixar em branco ou com placeholder. Cinco campos por item: nome, Tipo (SKILL|MCP), Origem (PROJETO|GLOBAL), Motivo (cita passo/CT-XXX/RF-XXX desta task), Passos de Aplicação (passos da §3). Sem item pertinente -> use a variante de ausência. Nunca replicar o inventário integral nem registrar credenciais. -->
<!-- MODELO (com itens):
- [ ] **techspec-generator**
    - *Tipo:* SKILL
    - *Origem:* PROJETO
    - *Motivo:* Passo 2 exige modelagem de contratos conforme CT-003 da techspec
    - *Passos de Aplicacao:* Passo 2, Passo 3
MODELO (ausência):
Nenhuma skill ou MCP aplicavel a esta task.
Justificativa: [motivo]
-->

{{SKILLS_MCPS_CONTENT}}

---

**Template Version:** 0.3.0
