# Task: {{TASK_ID}} - {{TASK_TITLE}}

| Metadata | Details |
| :--- | :--- |
| **Status** | [TODO | IN_PROGRESS | DONE] |
| **Data** | {{DATA_ATUAL}} |
| **Task** | {{TASK_TITLE}} |
| **Feature** | [nome-da-funcionalidade] |
 | **Referência PRD** | [Link PRD](./specs/features/[nome-da-funcionalidade]/prd.md) |
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

### 2.3 Contratos (Boundaries)
<!--
Os contratos abaixo sao referencias EXPLICITAS a secao 4 do techspec.md.
Cada contrato que esta task toca DEVE estar listado.
O executor DEVE implementar o contrato EXATAMENTE como definido na techspec.

ORIGEM DO CONTRATO:
- DESCOBERTO: contrato ja existia no codigo (task = adaptar/integrar)
- SOLICITADO: contrato foi definido pelo usuario (task = implementar do zero)
- PROPOSTO: contrato foi proposto pela LLM (task = implementar + validar)
-->

#### Contratos de Entrada (O que esta task recebe)
- [ ] ({{CONTRACT_ID}}) {{CONTRACT_NAME}} - Secao {{TECHSPEC_SECTION}} do techspec.md
  - Schema de entrada: {{INPUT_SCHEMA_REF}}
  - Validacoes obrigatorias: {{VALIDATIONS_REF}}
<!-- ADICIONAR CONTRATOS DE ENTRADA CONFORME NECESSARIO -->

#### Contratos de Saida (O que esta task produz)
- [ ] ({{CONTRACT_ID}}) {{CONTRACT_NAME}} - Secao {{TECHSPEC_SECTION}} do techspec.md
  - Schema de saida: {{OUTPUT_SCHEMA_REF}}
  - Status codes / codigos de erro: {{ERROR_CODES_REF}}
<!-- ADICIONAR CONTRATOS DE SAIDA CONFORME NECESSARIO -->

#### Contratos de Configuracao (Variaveis de ambiente)
- [ ] ({{ENV_ID}}) {{ENV_VAR_NAME}} - obrigatoria: {{REQUIRED}}, default: {{DEFAULT_VALUE}}
<!-- ADICIONAR VARIÁVEIS DE AMBIENTE CONFORME NECESSARIO -->

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

## 4. Detalhes de Implementacao & Contratos
<!-- 
Os exemplos abaixo sao CONTRATOS extraidos da techspec.md secao 4.
A implementacao final DEVE respeitar EXATAMENTE o schema definido.
Qualquer desvio DEVE ser justificado em "Notas de Execucao" (secao 8).
-->

* **Contrato(s) Implementado(s):** {{CONTRACT_IDS}} (ref: techspec.md secao {{TECHSPEC_SECTIONS}})
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
* **Restricoes:**
- Nao alterar assinaturas publicas
- Nao introduzir parametros opcionais nao documentados
- Schemas DEVEM conferir com o definido na techspec.md secao 4

---

## 5. Contexto de Arquivos (File Context)
<!-- O modelo esta AUTORIZADO a ler SOMENTE os arquivos listados abaixo.
EXCECAO: os arquivos das skills declaradas na secao 9 (Skills e MCPs) sao
automaticamente autorizados para leitura, sem necessidade de constarem desta lista.
Nenhum outro arquivo fora desta lista pode ser lido. -->
### 5.1 Arquivos de Leitura (Referência/Exemplos)
- `@spec/features/[nome-da-funcionalidade]/prd.md`
- `@spec/features/[nome-da-funcionalidade]/techspec.md`
- `{{EXAMPLE_FILE_PATH}}` (Exemplo de código existente similar)

### 5.2 Arquivos Permitidos para Escrita (Alvos)
- `{{TARGET_FILE_A}}`
- `{{TARGET_FILE_B}}`
- `{{TARGET_FILE_C}}`

---

## 6. Criterios de Aceite (Definition of Done)
- [ ] O codigo compila/executa sem erros de sintaxe.
- [ ] Todos os requisitos funcionais da secao 2.1 foram atendidos.
- [ ] Todos os contratos listados na secao 2.3 foram implementados conforme techspec.md secao 4.
- [ ] Schemas de entrada/saida conferem exatamente com o definido na techspec.
- [ ] Codigos de erro e responses documentados foram implementados.
- [ ] Variaveis de ambiente obrigatorias estao documentadas e validadas no startup.
- [ ] Os testes (Passo 4) foram criados e estao passando.
- [ ] Nao ha trechos de codigo comentados ou "TODOs" residuais.
- [ ] A implementacao respeita a arquitetura descrita no `@spec/features/[nome-da-funcionalidade]/techspec.md`.
- [ ] Todos os passos da secao 3 estao marcados como concluidos
- [ ] Evidencia de Skills e MCPs registrada na secao 8 para todos os itens declarados na secao 9.
- [ ] Esta task foi marcada como DONE no arquivo `./spec/features/[nome-da-funcionalidade]/tasks.md` <!-- O modelo DEVE atualizar este arquivo -->

### 6.1 Efeitos Colaterais Obrigatórios
- [ ] Status da task atualizado para DONE
- [ ] `./spec/features/[nome-da-funcionalidade]/tasks.md` atualizado corretamente

---

## 7. Arquivos Relevantes (Obrigatório)
[Listar os arquivos relatantes (arquivos da aplicação, documentações, etc) para a execução da tarefa]

## 8. Notas de Execução (Scratchpad)
[Uso para decisões técnicas relevantes. Não repetir informações já documentadas]

### Evidencia de Skills e MCPs
<!--
OBJETIVO: registrar, ao final da execucao, o que ocorreu com cada item declarado na secao 9.

REGRAS:
- `Situacao` aceita exatamente uma de tres: `CARREGADO E UTILIZADO`,
  `CARREGADO E NAO UTILIZADO` ou `INDISPONIVEL`.
- `CARREGADO E NAO UTILIZADO` exige `Justificativa` preenchida.
- Todo item declarado na secao 9 deve ter exatamente uma linha nesta tabela.
- Quando a task nao possuir a secao 9 (formato anterior), registrar a ausencia da
  secao nesta mesma subseccao e prosseguir.
- O registro completo e criterio de aceite bloqueante: a task NAO pode ser marcada
  como DONE sem ele.
- `Passos` referencia os passos da secao 3 em que o item foi efetivamente aplicado,
  ou `N/A` quando nao houve aplicacao.

MODELO:

| Item | Tipo | Origem | Situacao | Passos | Justificativa |
|:---|:---|:---|:---|:---|:---|
| techspec-generator | SKILL | PROJETO | CARREGADO E UTILIZADO | Passo 2, Passo 3 | - |
| product-manager | SKILL | GLOBAL | CARREGADO E NAO UTILIZADO | N/A | Passo 1 foi resolvido sem necessidade da skill |
| context7 | MCP | GLOBAL | INDISPONIVEL | N/A | Servidor nao conectado nesta sessao |

ANTI-PADROES:
- NUNCA marcar a task como DONE com a tabela vazia ou incompleta.
- NUNCA usar situacao fora do dominio das tres permitidas.
- NUNCA registrar credenciais, tokens ou chaves de API de servidores MCP.
-->

| Item | Tipo | Origem | Situacao | Passos | Justificativa |
|:---|:---|:---|:---|:---|:---|

---

## 9. Skills e MCPs
<!--
OBJETIVO: declarar nominalmente quais skills e MCPs devem ser carregados e utilizados
nesta task especifica.

REGRAS:
- Esta secao e OBRIGATORIA. E PROIBIDO omiti-la, deixa-la em branco ou manter placeholders.
- Cinco campos obrigatorios por item: nome, `Tipo`, `Origem`, `Motivo` e `Passos de Aplicacao`.
- `Tipo` aceita exatamente `SKILL` ou `MCP`. `Origem` aceita exatamente `PROJETO` ou `GLOBAL`.
- `Motivo` deve citar explicitamente ao menos um passo, contrato (CT-XXX) ou
  requisito (RF-XXX) desta task.
- `Passos de Aplicacao` deve referenciar passos existentes na secao 3 desta task.
- Itens nao pertinentes a esta task NAO podem ser declarados aqui.
- Quando nenhum item for pertinente, usar a variante de declaracao de ausencia com justificativa.

MODELO (caso com itens):

- [ ] **techspec-generator**
    - *Tipo:* SKILL
    - *Origem:* PROJETO
    - *Motivo:* Passo 2 exige modelagem de contratos conforme CT-003 da techspec
    - *Passos de Aplicacao:* Passo 2, Passo 3

- [ ] **context7**
    - *Tipo:* MCP
    - *Origem:* GLOBAL
    - *Motivo:* Passo 3 integra a biblioteca X, cuja documentacao oficial e necessaria
    - *Passos de Aplicacao:* Passo 3

MODELO (caso de ausencia):

Nenhuma skill ou MCP aplicavel a esta task.
Justificativa: [motivo]

ANTI-PADROES:
- NUNCA replicar o inventario integral de skills e MCPs nesta secao.
- NUNCA declarar item sem os cinco campos preenchidos.
- NUNCA registrar credenciais, tokens ou chaves de API de servidores MCP;
  apenas nome e finalidade.
-->

{{SKILLS_MCPS_CONTENT}}

---

**Template Version:** 0.1.0