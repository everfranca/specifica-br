---
name: gerar-tasks
description: Gera a lista de tasks de implementação a partir do PRD e da Tech Spec, com atomicidade (uma camada tecnológica por task), rastreabilidade total de contratos CT/ENV/SEC-XXX, cruzamento com documentos CORE, task de sincronização de divergências DIV-XXX e checkpoint com DE ACORDO. Use esta skill SEMPRE que o usuário pedir "/gerar-tasks", "gerar tasks", "quebrar em tarefas", "lista de tarefas de implementação", "task breakdown" ou for transformar um PRD e uma Tech Spec aprovados em arquivos task-N.md executáveis, mesmo sem mencionar a palavra task.
metadata:
  version: 0.10.0
---

# Skill: gerar-tasks

<critical>

**PRECEDÊNCIA OPERACIONAL (aplique nesta ordem):**
1. **Explorar** — PRD, Tech Spec e o código existente (arquivos similares, imports, config).
2. **Propor** — toda decisão de contrato/arquivo recebe rótulo: `DESCOBERTO` (já existe no código), `SOLICITADO` (definido pelo usuário) ou `PROPOSTO` (sugerido pela LLM).
3. **Perguntar** — ao usuário SOMENTE quando a lacuna for bloqueante.

**ANTI-VAZAMENTO DE COMENTÁRIOS:** os comentários `<!-- ... -->` dos templates existem apenas para autoria. NÃO devem aparecer nos artefatos finais (`task-N.md`, `tasks.md`). Remova-os ao gerar.

**Regras 1 a 9 (invioláveis):**

1. **LINGUAGEM EXPLÍCITA E NÃO-AMBÍGUA:** nunca "Crie o controller"; sim "Crie o arquivo `src/controllers/UserController.ts`, adicione a classe `UserController`, importe `UserService`". Sempre o CAMINHO RELATIVO completo.

2. **LEITURA OBRIGATÓRIA:** leia o conteúdo real dos arquivos em `PRD_PATH` e `TECHSPEC_PATH` (leitura dirigida: da techspec, a seção 4 completa e o plano da seção 8 são prioritários; consulte as demais seções quando o passo exigir).

3. **DIRETÓRIO E SALVAMENTO:** todas as tasks são salvas em `./specs/features/[nome-da-funcionalidade]/`, nomeadas `task-[X].md` (ex.: `./specs/features/[nome-da-funcionalidade]/task-1.md`).

4. **ATOMICIDADE E GRANULARIDADE:** uma Task = um Pull Request. O código deve ser testável e compilável (sem erros) ao fim da task. TODA task DEVE ser quebrada em sub-tasks (1.1, 1.2, 1.3 ...); sempre que possível, quebre mais.

5. **HUMAN-IN-THE-LOOP:** apresente o plano resumido e aguarde o "DE ACORDO" do usuário antes de gerar e gravar os arquivos finais.

6. **ISOLAMENTO DE CAMADA:** cada task foca em UMA camada tecnológica exclusiva — **Database** (schema/migrations/models/seeds) | **Backend** (controllers/services/lógica) | **Frontend** (components/views/states) | **Infraestrutura** (Terraform/Docker/CI-CD/cloud). Nunca misture camadas na mesma task.
   - Bom: "Criar migration users table" (só DB). Ruim: "Criar tabela users E implementar cadastro" (DB + Backend).
   - Auto-validação: a task toca só uma camada, é testável isolada e revisável por um único especialista? Se não -> quebre em tasks menores.

7. **RASTREABILIDADE E COBERTURA DE CONTRATOS** (Obrigatório):
   Antes de criar tasks, leia a seção 4 do `techspec.md` COMPLETAMENTE, extraia a Tabela Resumo de Contratos e, para cada contrato, atribua a task responsável e classifique a origem (`DESCOBERTO`/`SOLICITADO`/`PROPOSTO`). O título de cada task no `tasks.md` inclui os IDs dos contratos. NENHUM contrato pode ficar sem task. Cada task lista contratos de ENTRADA e SAÍDA; a seção 2.3 do `task-template.md` é preenchida para cada task.

   **Mapeamento por camada:**
   - **Database**: Backend-Database (4.2)
   - **Backend**: Client-Backend (4.1), Message Broker (4.3), Cache (4.4), External (4.5), Search (4.7), Application-Environment (4.8)
   - **Frontend**: Client-Backend como CONSUMIDOR (4.1), Application-Environment (4.8)
   - **Infraestrutura**: Config + Docker + CI/CD (4.8)

   **Auto-validação (antes de gerar):**
   - [ ] Todo `CT-XXX`, `ENV-XXX` e `SEC-XXX` da techspec está mapeado em ao menos uma task?
   - [ ] Nenhum contrato está órfão (sem responsável)?
   - [ ] Tasks de Frontend referenciam contratos Client-Backend como consumidores?
   - [ ] Contrato de terceiros não documentado na techspec -> a task NÃO é criada; sinalize a lacuna ao usuário.
   - Se qualquer resposta = NÃO -> corrigir antes de gerar.

8. **DESCOBERTA DE SKILLS E MCPS ANTES DE GERAR TASKS** (Obrigatório): leia e execute `references/descoberta-skills-mcps.md` (BLOCO-DESC, CT-006) nos escopos PROJETO e GLOBAL.
   - **Momento:** conclua a descoberta ANTES do Checkpoint (item 4 do fluxo de execução).
   - **Independência:** execute-a de forma INDEPENDENTE. É PROIBIDO substituí-la pelo inventário da seção 9 da Tech Spec ou condicioná-la à existência desse registro. Tech Spec de versão anterior sem seção 9 -> prossiga silenciosamente. Skills instaladas após a Tech Spec DEVEM ser capturadas aqui.
   - **Destino:** o inventário alimenta a regra 9 (seleção por task).

9. **SELEÇÃO E DECLARAÇÃO DE SKILLS E MCPS POR TASK** (Obrigatório):
   Cada task declara nominalmente APENAS os itens pertinentes a ela (por camada, contratos `CT-XXX` e ações das sub-tarefas). Replicar o inventário integral em toda task é PROIBIDO.

   **Cinco campos obrigatórios por item declarado:** 1) nome; 2) `Tipo` (SKILL|MCP); 3) `Origem` (PROJETO|GLOBAL); 4) `Motivo` — cita ao menos um passo, contrato (`CT-XXX`) ou requisito (`RF-XXX`) daquela task; 5) `Passos de Aplicação` — referencia passos existentes na seção 3 daquela task.

   **Declaração de ausência (obrigatória quando não há item pertinente, ou inventário vazio):** preencha a seção 9 com "Nenhuma skill ou MCP aplicável a esta task." + "Justificativa: [motivo]". É PROIBIDO omitir a seção, deixá-la em branco ou manter placeholders.

   **Validação bloqueante antes de gravar cada task:** todo item selecionado tem os cinco campos. Faltando algum, emita "Item [nome] está incompleto: campos obrigatórios ausentes." e NÃO grave a task até completar.

   **Auto-validação:** seção 9 existe; todo item tem cinco campos sem placeholders; o motivo cita passo/contrato/requisito DESTA task; os passos de aplicação existem na seção 3 DESTA task; nenhum item não pertinente foi declarado; tasks de camadas diferentes com seleção idêntica têm justificativas próprias.

   **Consulta ativa durante o research (amarração com a regra 8):** os itens disponíveis são USADOS no research de cada task, quando pertinentes. Havendo MCP de documentação disponível (ex.: `context7`), consulte-o para validar APIs/versões/assinaturas ANTES de escrever os schemas da §4 e o exemplo canônico do §5.1; indisponível, declare a ausência e prossiga com o melhor conhecimento. Todo item efetivamente consultado no research é candidato natural à declaração na §9 daquela task e à Evidência na §8 ao fim da execução.

   **PROIBIDO:** registrar credenciais, tokens ou chaves de API de servidores MCP. Declare apenas nome e finalidade.

**Regras 10 e 11 (invioláveis):** o cruzamento com os documentos CORE (regra 10) e a geração da task de sincronização (regra 11) vivem integralmente em `references/cruzamento-core.md` — incluindo os quatro alvos CORE, as categorias de extração, as divergências `DIV-XXX`, as mensagens MSG-001 a MSG-009 e o formato do Checkpoint combinado. Execute-as ANTES do Checkpoint, estritamente de leitura.

</critical>

## 1. Papel

Você é um **especialista em gerenciamento de projetos de software**. Cria listas de tasks de implementação a partir de um PRD e uma Tech Spec. Cada task tem instruções explícitas, sem ambiguidade, passo a passo. Não assuma conhecimento prévio: indique exatamente onde e como executar cada ação.

## 2. Entrada, Destino e Precedência de Templates (BLOQUEANTE)

- **Entrada:** `PRD_PATH` = `./specs/features/[nome-da-funcionalidade]/prd.md`; `TECHSPEC_PATH` = `./specs/features/[nome-da-funcionalidade]/techspec.md`.
- **Destino base de cada task:** `./specs/features/[nome-da-funcionalidade]/`; índice: `./specs/features/[nome-da-funcionalidade]/tasks.md`.
- **Templates:** se `specs/templates/task-template.md` e/ou `specs/templates/tasks-template.md` existirem no projeto, eles PREVALEM; caso contrário, use `{{SKILL_DIR}}/assets/task-template.md` e `{{SKILL_DIR}}/assets/tasks-template.md` desta skill.

Antes de gerar, você DEVE ler os templates efetivos (do projeto ou da skill). Gerar tasks sem ler os templates invalida a execução.

### Resolução do diretório da skill

Os caminhos desta skill apontam para onde ela foi instalada. Se algum caminho de `assets/` ou `scripts/` falhar, resolva o diretório da skill nesta ordem antes de desistir:

1. Diretório anunciado pelo carregador de skills da sessão (nota de base directory).
2. Localização do `SKILL.md` desta skill por busca nos diretórios de skills do projeto e do usuário (padrão típico: `**/skills/<nome-da-skill>/SKILL.md`).

Localizado o diretório, use-o como base para todos os templates (`assets/`) e validadores (`scripts/`). Sem localizar a skill, informe o usuário e não prossiga improvisando.

## 3. Fluxo de Execução (7 passos)

1. **Análise e Contexto:** leia o PRD e o Tech Spec. Entenda o objetivo macro e as restrições.
2. **Quebra de Tarefas:** identifique dependências, quebre em passos lógicos e sequenciais. Pergunte-se: "um executor realizaria a task só lendo este arquivo?" Se não, detalhe mais.
3. **Research por task (exploração de código):** para cada task, explore o código existente (arquivos similares, imports, config) para (a) preencher `Arquivos Alvo`/§5 com caminhos reais e (b) produzir 1 exemplo canônico CURTO e representativo no §4, ancorado em um padrão já usado no repositório. Consulte MCPs/skills disponíveis (regra 9) para validar APIs/versões. O exemplo é curto: o few-shot rico vive na task gerada, não no template.
4. **Descoberta de Skills e MCPs:** execute a regra 8 (BLOCO-DESC) nos escopos PROJETO e GLOBAL e aplique a regra 9 por task. Antes do Checkpoint.
5. **Cruzamento com os CORE:** execute a regra 10 e prepare a task de sincronização conforme a regra 11 (`references/cruzamento-core.md`). Antes do Checkpoint, estritamente de leitura.
6. **Checkpoint:** valide o plano com o usuário apresentando, na MESMA mensagem, a lista de tasks e as divergências `DIV-XXX`, no formato da regra 11.1 (`references/cruzamento-core.md`). Aplique a auto-validação da regra 7 ao plano antes de apresentá-lo.
7. **Geração:** após o "DE ACORDO", crie os arquivos Markdown completos, sem os comentários `<!-- ... -->` dos templates (exceção: o comentário de metadata de status).

## 4. Formato de Saída

Somente após o usuário aprovar o plano, a saída segue estritamente este formato, para automação do salvamento:

FILE_PATH: `./specs/features/[nome-da-funcionalidade]/tasks.md`

```markdown
[Conteudo do tasks.md]
```

(e, na mesma saída, um bloco FILE_PATH por `task-N.md` gerado)

## 5. Validação Determinística Pós-Geração (BLOQUEANTE)

Após gravar `tasks.md` e cada `task-N.md`, execute o validador da skill, sempre via `node`:

```
node {{SKILL_DIR}}/scripts/validar-tasks.mjs specs/features/[nome-da-funcionalidade]/techspec.md specs/features/[nome-da-funcionalidade]/tasks.md specs/features/[nome-da-funcionalidade]/task-1.md [task-2.md ...]
```

O validador confere deterministicamente, no plano materializado: todo `CT/ENV/SEC-XXX` da techspec mapeado em ao menos uma task, nenhuma task órfã (arquivo sem linha no índice ou linha sem arquivo), uma camada tecnológica por task (via interseção das camadas possíveis dos contratos declarados) e seção 9 de cada task com os cinco campos ou variante de ausência.

- **Exit 0** (OK): artefatos conformes; a geração está concluída.
- **Exit 1**: corrija CADA violação listada (com número de linha) e reexecute o validador. Repita o loop validar -> corrigir -> revalidar até obter exit 0. Somente então considere a execução concluída.

## 6. Orçamento de Contexto (meta por fase)

- **Análise (passos 1-2):** leitura dirigida — da techspec, priorize a seção 4 (contratos) e a seção 8 (plano de implementação); consulte as demais seções somente quando o passo exigir.
- **Research (passo 3):** por task, apenas os arquivos similares e configs que fundamentam caminhos e o exemplo canônico.
- **Geração (passo 7):** templates efetivos + Tabela Resumo de Contratos como fontes principais.

Regressão de custo em qualquer fase é sinal de leitura não dirigida: reduza o escopo de leitura ao exigido pelo passo.

**Nota de sincronização:** o arquivo `references/descoberta-skills-mcps.md` é compartilhado, byte a byte, com a skill `gerar-techspec` (BLOCO-DESC, CT-006). Qualquer alteração neste arquivo DEVE ser replicada no equivalente da skill irmã.

<critical>
Antes de gerar, releia o bloco `<critical>` do topo. Reforço: uma camada por task · todo `CT/ENV/SEC-XXX` mapeado · §9 de cada task com os cinco campos ou ausência justificada (nunca vazia) · metadata com todas as colunas · comentários `<!-- ... -->` removidos dos artefatos · nada de alterar documentos CORE aqui — só a task de sincronização, a partir de divergências aprovadas · checkpoint com "DE ACORDO" · validador `scripts/validar-tasks.mjs` com exit 0.
</critical>
