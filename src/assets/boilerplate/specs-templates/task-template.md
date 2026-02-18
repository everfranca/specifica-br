# Task: {{TASK_ID}} - {{TASK_TITLE}}

| Metadata | Details |
| :--- | :--- |
| **Status** | [TODO | IN_PROGRESS | DONE] |
| **Data** | {{DATA_ATUAL}} |
| **Task** | {{TASK_TITLE}} |
| **Feature** | [nome-da-funcionalidade] |
| **Referência PRD** | [Link PRD](@specs/features/[nome-da-funcionalidade]/prd.md) |]
| **Referência Tech Spec** | [Link PRD](@specs/features/[nome-da-funcionalidade]/techspec.md) |
<!-- Status: TODO → IN_PROGRESS → DONE -->


## 1. Contexto e Objetivo
{{CONTEXT_CONTENT}}
<!-- 
Regras:
    - Não reinterpretar requisitos
    - Não adicionar objetivos não explicitados no PRD
    - Usar este contexto apenas como orientação de execução 
-->

---

## 2. Requisitos da Tarefa
### 2.1 Funcionais (Comportamento)
<!-- Cada requisito DEVE mapear 1:1 com o PRD -->
- [ ] (PRD-REQ-01) ...
- [ ] (PRD-REQ-02) ...

### 2.2 Técnicos (Implementação)
- [ ] Seguir APENAS os padrões definidos na seção {{ITEM_REF}} do techspec.md
- [ ] Utilizar exclusivamente as bibliotecas listadas abaixo:
{{LIBS_LIST}}
<!-- Proibido adicionar novas dependências -->
- [ ] Tratamento de erros conforme padrão do projeto.

---

## 3. Plano de Execução (Sub-tarefas)
<!-- Regras de Execução:
- Os passos DEVEM ser executados em ordem
- Um passo só pode ser marcado como concluído se os arquivos-alvo forem alterados
- Não avançar para o próximo passo se houver erro 
-->

- [ ] **Passo 1: Estruturas de Dados e Contratos**
    - *Ação:* Criar interfaces, DTOs, Enums ou Tabelas.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_1}}`
    - *Critério de Saída:* Código compilável + tipos acessíveis pelos passos seguintes

- [ ] **Passo 2: Implementação da Lógica de Negócio**
    - *Ação:* Implementar o algoritmo, regra de negócio ou fluxo principal.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_2}}`
    - *Critério de Saída:* Código compilável + tipos acessíveis pelos passos seguintes

- [ ] **Passo 3: Integração e Exposição**
    - *Ação:* Conectar a lógica a APIs, UI, CLI ou Banco de Dados.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_3}}`
    - *Critério de Saída:* Código compilável + tipos acessíveis pelos passos seguintes

- [ ] **Passo 4: Testes e Validação**
    - *Ação:* Criar testes unitários ou de integração para garantir o funcionamento.
    - *Arquivos Alvo:* `{{TARGET_FILES_STEP_4}}`
    - *Critério de Saída:* Código compilável + tipos acessíveis pelos passos seguintes

---

## 4. Detalhes de Implementação & Snippets
<!-- 
Os exemplos abaixo são CONTRATOS.
A implementação final DEVE respeitar forma e assinatura. 
-->

* **Nomenclatura Esperada:** `{{NAMING_CONVENTION}}`
* **Estrutura de Input (Exemplo):**
    ```json
    {{INPUT_EXAMPLE}}
    ```
* **Assinaturas/Interfaces Chave:**
    ```csharp
    {{CODE_SIGNATURE_EXAMPLE}}
    ```
* **Restrições:**
- Não alterar assinaturas públicas
- Não introduzir parâmetros opcionais não documentados

---

## 5. Contexto de Arquivos (File Context)
<!-- O modelo está AUTORIZADO a ler SOMENTE os arquivos listados abaixo -->
### 5.1 Arquivos de Leitura (Referência/Exemplos)
- `@spec/features/[nome-da-funcionalidade]/prd.md`
- `@spec/features/[nome-da-funcionalidade]/techspec.md`
- `{{EXAMPLE_FILE_PATH}}` (Exemplo de código existente similar)

### 5.2 Arquivos Permitidos para Escrita (Alvos)
- `{{TARGET_FILE_A}}`
- `{{TARGET_FILE_B}}`
- `{{TARGET_FILE_C}}`

---

## 6. Critérios de Aceite (Definition of Done)
- [ ] O código compila/executa sem erros de sintaxe.
- [ ] Todos os requisitos funcionais da seção 2.1 foram atendidos.
- [ ] Os testes (Passo 4) foram criados e estão passando.
- [ ] Não há trechos de código comentados ou "TODOs" residuais.
- [ ] A implementação respeita a arquitetura descrita no `@spec/features/[nome-da-funcionalidade]/techspec.md`.
- [ ] Todos os passos da seção 3 estão marcados como concluídos
- [ ] Esta task foi marcada como DONE no arquivo `./spec/features/[nome-da-funcionalidade]/tasks.md` <!-- O modelo DEVE atualizar este arquivo -->

### 6.1 Efeitos Colaterais Obrigatórios
- [ ] Status da task atualizado para DONE
- [ ] `./spec/features/[nome-da-funcionalidade]/tasks.md` atualizado corretamente

---

## 7. Arquivos Relevantes (Obrigatório)
[Listar os arquivos relatantes (arquivos da aplicação, documentações, etc) para a execução da tarefa]

## 8. Notas de Execução (Scratchpad)
[Uso para decisões técnicas relevantes. Não repetir informações já documentadas]