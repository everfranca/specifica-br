# Cruzamento com os Documentos CORE (Regras 10 e 11)

## Sumário

1. [Regra 10: Cruzamento com os documentos CORE](#1-regra-10-cruzamento-com-os-documentos-core)
2. [Regra 11: Geração da task de sincronização](#2-regra-11-geração-da-task-de-sincronização)

## 1. Regra 10: Cruzamento com os documentos CORE

### 10.1 Restrição de leitura

Antes do Checkpoint, cruze as decisões do `prd.md` e do `techspec.md` da feature contra os documentos CORE do repositório. Esta etapa é **estritamente de leitura**: nenhum CORE é alterado durante a geração de tasks. A alteração ocorre só na execução da task de sincronização gerada a partir de divergências aprovadas.

### 10.2 Alvos (exatamente quatro, na raiz do repositório)

| Alvo lógico | Caminho | Regra de resolução |
|:---|:---|:---|
| `product_vision` | `specs/core/product_vision.md` | Caminho único |
| `architecture` | `specs/core/architecture.md` | Caminho único |
| `readme` | `README.md` | Caminho único, raiz |
| `guia_agentes` | `AGENTS.md` ou `CLAUDE.md` | Alvo único. Precedência para `AGENTS.md`; `CLAUDE.md` só quando `AGENTS.md` ausente |

Cada alvo existente é lido integralmente. Alvo inexistente -> estado `AUSENTE`, ignorado **sem erro, sem aviso bloqueante e sem pergunta**. Alvo existente e ilegível -> `NAO_INSPECIONADO`.

Formato de apresentação do inventário:

```
| Alvo | Caminho | Estado |
|:---|:---|:---|
| Visao de Produto | specs/core/product_vision.md | AUSENTE |
| Arquitetura | specs/core/architecture.md | ENCONTRADO |
| README | README.md | ENCONTRADO |
| Guia de Agentes | AGENTS.md | AUSENTE |
```

### 10.3 Detecção de metadata (critério literal)

O alvo tem metadata se, e somente se, contiver uma tabela iniciada por `| Metadata | Details |` com uma linha cuja primeira coluna seja `**Data**`. `**Ultima Atualizacao**` NÃO é equivalente.

### 10.4 Categorias de extração

Leia o `prd.md` e o `techspec.md` e extraia apenas decisões enquadráveis em uma destas quatro categorias. Cada decisão referencia `arquivo_origem`, `secao_origem` e `trecho` literal.

| Código | Categoria | Fonte típica | CORE correspondente |
|:---|:---|:---|:---|
| `STACK` | Stack, dependências e versões | Tech Spec 1, 3.3 | `architecture.md` |
| `TECNICO` | Camadas, padrões e invariantes técnicos | Tech Spec 2, 5, 7 | `architecture.md`, guia de agentes |
| `PRODUTO` | Personas, escopo, proposta de valor, métricas | PRD 2, 3, 6 | `product_vision.md` |
| `INTERFACE` | Interface pública e operação (comandos, flags, instalação, uso) | PRD 4, Tech Spec 4 | `README.md`, guia de agentes |

Decisão fora das quatro categorias é **descartada** e não gera divergência.

### 10.5 Geração e classificação das divergências

Compare cada decisão ao CORE correspondente (tabela 10.4). Classificação **binária e derivada da evidência**.

| Condição no CORE | Tipo |
|:---|:---|
| Decisão não consta (omissão), sem afirmação contrária | `EVOLUCAO` |
| CORE afirma algo incompatível com a decisão | `CONFLITO` |
| Decisão já consta de forma equivalente | Nenhuma divergência |

Cada divergência recebe `DIV-XXX` sequencial (três dígitos, a partir de `DIV-001`) e **6 campos obrigatórios:** 1) `id`; 2) `documento_alvo` (CORE a alterar, estado `ENCONTRADO`); 3) `secao_alvo`; 4) `evidencia` (`arquivo_origem` + `secao_origem` + `trecho` literal); 5) `categoria` (uma das quatro); 6) `tipo` (`EVOLUCAO`|`CONFLITO`). Divergência com qualquer campo ausente ou com placeholder é **descartada antes da apresentação** (MSG-005) e não pode ser aprovada nem virar sub-tarefa.

### 10.6 Mensagens (todas NÃO bloqueantes)

| ID | Gatilho | Severidade | Mensagem |
|:---|:---|:---|:---|
| MSG-001 | Nenhum dos quatro alvos CORE existe | Baixa | `Nenhum documento CORE encontrado. Cruzamento não aplicável.` |
| MSG-002 | Alvo existe mas não pôde ser lido | Média | `Documento CORE [caminho] não pôde ser inspecionado. Os demais documentos foram cruzados.` |
| MSG-003 | Feature sem `techspec.md` | Média | `Tech Spec não encontrada. O cruzamento cobriu apenas as decisões de produto do PRD.` |
| MSG-004 | Feature sem `prd.md` | Alta | `PRD não encontrado. Cruzamento com os documentos CORE não executado.` |
| MSG-005 | Divergência sem evidência completa | Média | `Divergência descartada por evidência incompleta.` |
| MSG-006 | CORE existe e nenhuma divergência identificada | Baixa | `Documentos CORE alinhados às decisões desta feature.` |

MSG-001 -> cruzamento pulado, geração prossegue. MSG-004 -> cruzamento não executado, geração prossegue sem task de sincronização. MSG-006 -> nenhuma lista de divergências e nenhuma task de sincronização.

## 2. Regra 11: Geração da task de sincronização

### 11.1 Apresentação no Checkpoint

O plano de tasks e a lista `DIV-XXX` vão na **MESMA mensagem**, no checkpoint da regra 5, sem rodada de aprovação separada. Divergências `CONFLITO` recebem prefixo `[CONFLITO]` e vão no topo, antes das `EVOLUCAO`.

```
PLANO DE TASKS
  task-1.md  [titulo] (CT-XXX)
  task-2.md  [titulo] (CT-XXX)
  task-3.md  Sincronizar documentos CORE

DIVERGENCIAS CORE (indique quais aprovar)

  DIV-001 [CONFLITO]  architecture.md -> secao "2.1 Backend"
     Categoria: Stack, dependencias e versoes
     Evidencia: techspec.md, secao 3.3 - "adocao da biblioteca X na versao 2.0"
     No CORE consta: "biblioteca X na versao 1.4"

  DIV-002 [EVOLUCAO]  README.md -> secao "Comandos Basicos"
     Categoria: Interface publica e operacao
     Evidencia: prd.md, secao 4 RF-003 - "nova flag --dry-run"
     No CORE consta: omissao (nenhuma mencao a --dry-run)

Responda com o DE ACORDO do plano e os IDs que aprova.
```

### 11.2 Aprovação item a item

Nenhuma divergência é aprovada por padrão, inferência ou silêncio. A entrada é o "DE ACORDO" do plano com os IDs `DIV-XXX` aprovados. Divergência não citada é **DESCARTADA** e não aparece em nenhum artefato.

### 11.3 Unicidade e posição

Havendo ao menos uma divergência aprovada, gera-se **exatamente uma** task de sincronização por execução, como **último item** da lista, com o próximo `task-N.md` e sua linha própria em `tasks.md`.

### 11.4 Mapeamento sobre o `task-template.md` vigente

A task de sincronização obedece ao template vigente; o `task-template.md` **não é alterado**.

| Seção do template | Conteúdo na task de sincronização |
|:---|:---|
| Metadata | Todas as colunas: Status `TODO`, Data, Task, Feature, Referência PRD, Referência Tech Spec |
| 1. Contexto e Objetivo | Objetivo da sincronização e citação dos `DIV-XXX` aprovados |
| 2.1 Funcionais | Um item por divergência: `- [ ] (DIV-XXX) [descrição da alteração]` |
| 2.3 Contratos | `Não aplicável: esta task edita documentação, não implementa contratos da seção 4 do techspec.md` |
| 3. Plano de Execução | **Uma sub-tarefa (Passo) por documento CORE impactado** |
| 5.1 Arquivos de Leitura | `prd.md`, `techspec.md` e cada CORE impactado |
| 5.2 Arquivos para Escrita | **Exclusivamente** os CORE impactados; nenhum outro |
| 6. Critérios de Aceite | Critérios do template + os específicos de 11.6 |
| 7. Arquivos Relevantes | Documentos CORE impactados |
| 9. Skills e MCPs | Conforme regras 8 e 9, ou declaração de ausência com justificativa |

### 11.5 Schema de cada sub-tarefa da seção 3 da task gerada

```
- [ ] **Passo 1: Sincronizar specs/core/architecture.md**
    - *Acao:* Editar EXCLUSIVAMENTE a secao "2.1 Backend" para refletir DIV-001,
      e a secao "3.2 Padroes Arquiteturais Especificos" para refletir DIV-004.
      Em seguida atualizar a linha **Data** da tabela de metadata para a data da execucao.
    - *Divergencias:* DIV-001, DIV-004
    - *Arquivos Alvo:* `specs/core/architecture.md`
    - *Atualiza linha Data:* Sim (documento possui tabela de metadata)
    - *Criterio de Saida:* Secoes indicadas refletem as decisoes citadas; linha **Data**
      atualizada; campo **Status** inalterado; demais secoes byte-identicas ao original.
```

**Validações bloqueantes na geração:** número de sub-tarefas **exatamente igual** ao de documentos CORE distintos referenciados pelas divergências aprovadas; toda sub-tarefa referencia ao menos um `DIV-XXX`; metadata com todas as colunas; seção 9 preenchida ou com ausência declarada.

### 11.6 Regras de edição transcritas na própria task gerada (para o executor não reabrir PRD/Tech Spec)

| Alteração | Condição | Comportamento |
|:---|:---|:---|
| (a) Edição de conteúdo | Sempre | Editar **exclusivamente** as seções das divergências aprovadas, preservando o resto do documento |
| (b) Atualização de data | Só com a tabela de metadata do critério 10.3 | Atualizar `**Data**` para a data da execução, formato `dd/MM/aaaa` |

- O campo `**Status**` do CORE permanece **inalterado** sempre.
- Nenhum CORE inexistente é criado. Sem sincronização inversa: `prd.md`/`techspec.md` não são reescritos.
- CORE sem tabela de metadata recebe só a alteração (a), silenciosamente (MSG-009).

| ID | Gatilho | Severidade | Mensagem |
|:---|:---|:---|:---|
| MSG-007 | Todas as divergências descartadas pelo usuário | Baixa | `Nenhuma divergência aprovada. Task de sincronização não gerada.` |
| MSG-008 | Seção alvo não localizada na execução | Média | `Seção [nome] não localizada em [caminho]. Atualização não aplicada — revisar manualmente.` |
| MSG-009 | CORE sem tabela de metadata | Baixa | Nenhuma mensagem; comportamento silencioso |

MSG-007 -> nenhuma task de sincronização, nenhum CORE alterado, geração prossegue. MSG-008 -> sub-tarefa registrada como não aplicada, documento preservado, demais sub-tarefas prosseguem.
