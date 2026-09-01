# Inventário de Integração com Ferramentas de IA

| Metadado | Valor |
|:---|:---|
| **Documento** | Inventário de referência (documento vivo) |
| **Última atualização** | 01/09/2026 |
| **Escopo** | Comando `specifica-br executar-tasks` |
| **Estado** | 1 de 5 ferramentas com contrato validado |
| **Fontes** | Código-fonte em `src/`, `specs/features/comando-executar-tasks-global/techspec.md` (CT-020 a CT-024) e documentação oficial atual das CLIs (via MCP `context7`) |
| **Levantamentos concluídos** | OpenCode — coluna fechada em 01/09/2026 contra o código-fonte da CLI (`/anomalyco/opencode`). Detalhamento em `specs/prompts/0006-techspec-executar-tasks-opencode.md` |

---

## 1. Sumário executivo

O comando `executar-tasks` invoca uma CLI de IA externa em modo não-interativo, uma vez por
arquivo `task-*.md`, e lê o resultado estruturado dessa invocação. Todo o conhecimento de
*como falar* com uma CLI específica está isolado atrás de um **Adapter**
(`src/types/tool-adapter.ts`), registrado por slug em `tool-registry.ts`.

Estado atual do registro (`src/utils/tool-adapters/tool-registry.ts:40-76`):

| Slug | Nome | Executável | Contrato validado | Capacidades |
|:---|:---|:---|:---|:---|
| `claudecode` | ClaudeCode | `claude` | **Sim** | 7 de 7 ligadas |
| `cursor` | Cursor | `cursor` | Não | 0 de 7 |
| `gemini-cli` | Gemini CLI | `gemini` | Não | 0 de 7 |
| `kiro` | Kiro | `kiro` | Não | 0 de 7 |
| `opencode` | OpenCode | `opencode` | Não | 0 de 7 |

`getAdapter()` recusa as quatro não validadas com
`contrato de execucao de <Nome> ainda nao validado nesta versao. Disponivel: ClaudeCode`
(`tool-registry.ts:118-132`).

**Como ler este documento:** a seção 2 define o contrato que qualquer ferramenta precisa
cumprir; a seção 3 é o inventário completo da única integração existente (Claude Code);
a seção 4 é o mapa de equivalência flag a flag entre as cinco ferramentas — o insumo direto
de planejamento; a seção 5 traz a ficha e o checklist de cada ferramenta pendente; a seção 6
lista as pendências estruturais que precisam ser resolvidas *antes* do segundo adapter.

---

## 2. O contrato de adapter

### 2.1 As sete capacidades

`ToolCapabilities` (`src/types/tool-adapter.ts:4-12`). Cada capacidade ausente desliga
funcionalidade dependente em vez de abortar o lote — a matriz de degradação está em
`ajustarPorCapacidades` (`src/utils/task-runner.ts:65-107`), escrita explicitamente
"para o dia em que outra ferramenta entrar com contrato parcial" (`task-runner.ts:61-63`).

| Capacidade | O que destrava | O que a ausência desliga |
|:---|:---|:---|
| `execucaoNaoInterativa` | A execução em lote em si | Bloqueante — sem isso não há integração |
| `modoSemPromptDePermissao` | `--auto-approve` / `--permission-mode` | Execução não supervisionada |
| `saidaEstruturadaComTokens` | Contabilidade de tokens e custo | `--window-budget-tokens` e `--max-budget-usd` zerados |
| `identificadorDeSessao` | Bloco de evidências do resumo (RF-017) | Rastreabilidade por task |
| `injecaoDeContextoNoSystemPrompt` | Contexto de Execução (destilado) | `--context-pack` desligado |
| `liberacaoDeDiretoriosDeLeitura` | Skills globais fora do projeto | `--skill-dirs` desligado |
| `consultaAosMcps` | Preflight grupo E | `--mcp-check` desligado |

### 2.2 Métodos do `ToolAdapter`

Declarados na interface (`src/types/tool-adapter.ts:55-66`):
`slug`, `contratoValidado`, `capacidades`, `buildTaskArgs`, `buildContextPackArgs`,
`buildEnv`, `parseResult`, `detectRateLimit`, `getVersion`, `listMcps`.

Usados pelo comando mas **ausentes da interface**: `resolveExtraDirs`, `runTask`, `runPack`,
`mcpListRaw`, `interpretMcpStatus`. Ver pendência 6.1.

### 2.3 Tipos de fronteira

`TaskResult` (`:14-33`) é a forma normalizada que todos os consumidores leem — nenhum
consumidor conhece o formato bruto da CLI. `BuildTaskArgsInput` (`:35-40`),
`BuildContextPackArgsInput` (`:48-53`), `McpCheckResult` (`:42-46`).

---

## 3. Ferramenta: Claude Code (`claudecode`) — IMPLEMENTADA

Implementação: `src/utils/tool-adapters/claude-code-adapter.ts` (454 linhas).
Especificação de origem: techspec CT-020 a CT-023. A implementação corresponde literalmente
à especificação.

### 3.1 Identificação e descoberta

| Item | Valor | Fonte |
|:---|:---|:---|
| Executável | `claude` (constante `EXECUTAVEL_CLAUDE`) | `claude-code-adapter.ts:16` |
| Detecção no projeto | Existência de `.claude/commands/` | `src/assets/tools-mapping.json` + `tool-resolver.ts:139-155` |
| Comandos globais | `~/.claude/commands/` | `tools-mapping.json` |
| Skills | `.claude/skills/` (projeto) e `~/.claude/skills/` (global) | `tools-mapping.json` |
| Configs validadas no preflight | `.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json` | `preflight-service.ts:36-42` |

Ordem de resolução da ferramenta (RF-011, `tool-resolver.ts:95-137`):
`--tool` > registro do projeto em `~/.specifica-br/config.json` > detecção por diretório >
seleção interativa (só com TTY). A ferramenta resolvida é **sempre** gravada no registro.

### 3.2 Comando 1 — Execução de task (CT-020)

`buildTaskArgs` (`claude-code-adapter.ts:91-135`). Ordem estável, prefixo fixo seguido de
condicionais:

| # | Flag | Valor | Condição | Origem / default |
|:---|:---|:---|:---|:---|
| 1 | `-p` | `/executar-task <caminho-absoluto>` (um único elemento de argv) | sempre | `TaskInfo.caminho` |
| 2 | `--output-format` | `json` | sempre | fixo no código |
| 3 | `--model` | `<modelo>` | sempre | `--model`, default `sonnet` |
| 4 | `--effort` | `<nivel>` | sempre | `--effort`, default `medium` |
| 5 | `--permission-mode` | modo efetivo | modo efetivo não vazio | ver 3.2.1 |
| 6 | `--add-dir` | `<dir>` | uma vez por diretório existente | `resolveExtraDirs`, ver 3.2.2 |
| 7 | `--fallback-model` | `<modelo>` | `fallbackModel` não vazio | `--fallback-model`, default `''` |
| 8 | `--allowedTools` | `<regra>` | uma vez por regra | `--allow` (repetível), default `[]` |
| 9 | `--max-budget-usd` | `<n>` | `maxBudgetUsd > 0` | `--max-budget-usd`, default `0` |
| 10 | `--append-system-prompt-file` | `<featureDir>/contexto-execucao.md` | destilado disponível | `ContextPackService.caminhoParaInjecao` |
| 11 | `--exclude-dynamic-system-prompt-sections` | (sem valor) | `cacheTuning` ligado | `--no-cache-tuning` desliga |

**Atenção ao item 8:** `--allowedTools` é emitido como **pares flag/valor repetidos**, um por
regra — nunca como uma única lista separada por vírgula.

**Atenção ao item 9:** a flag é *omitida* quando o valor é `0`, e não passada como zero.

#### 3.2.1 Modo de permissão efetivo

`modoDePermissaoEfetivo` (`:74-84`), regra em três degraus:

1. `--permission-mode <modo>` informado vence;
2. senão `bypassPermissions` quando `--auto-approve`;
3. senão string vazia → **nenhuma flag é emitida**, e o preflight grupo C classifica isso
   como ERRO (`preflight-service.ts:184-199`).

Valores aceitos na validação (`executar-tasks-validation.ts:40-46`):
`acceptEdits`, `auto`, `dontAsk`, `manual`, `bypassPermissions`.

Esta mesma regra está duplicada no preflight — ver pendência 6.2.

#### 3.2.2 Diretórios extras (`--add-dir`)

`resolveExtraDirs` (`:182-204`). Retorna `[]` quando `--no-skill-dirs` foi informada.
Caso contrário, candidatos incluídos apenas se existirem no disco:
`<home>/.claude/skills` e `<cwd>/.claude/skills`.
Chamado uma vez por execução (`executar-tasks.ts:219`) e registrado como `extra_dirs`
no evento `run_start`.

### 3.3 Comando 2 — Construção do Contexto de Execução (CT-021)

`buildContextPackArgs` (`:141-160`):

| # | Flag | Valor | Condição |
|:---|:---|:---|:---|
| 1 | `-p` | prompt interpolado (`CONTEXT_PACK_PROMPT`) | sempre |
| 2 | `--output-format` | `json` | sempre |
| 3 | `--model` | `--pack-model`, default `sonnet` | sempre |
| 4 | `--effort` | `--pack-effort`, default `low` | sempre |
| 5 | `--permission-mode` | `acceptEdits` — **fixo no código** | sempre |
| 6 | `--exclude-dynamic-system-prompt-sections` | (sem valor) | `cacheTuning` ligado |

**Não são passados:** `--add-dir`, `--allowedTools`, `--fallback-model`, `--max-budget-usd`,
`--append-system-prompt-file`.

Regras de orquestração (`context-pack-service.ts`):

- **Deriva por mtime** (`:83-111`): reconstrói se `contexto-execucao.md` não existe, ou se o
  mtime de `techspec.md`, `prd.md` ou `specs/core/architecture.md` for mais recente.
- **Sucesso exige três condições** (`:223`): `exitCode === 0`, `is_error` falso e o arquivo
  existir depois. Falha nunca bloqueia — emite `[ AVIS]` e segue sem o destilado.
- **Estimativa de tamanho** (`:175`, `:260`): `Math.floor(bytes * 10 / 35)` (~3,5 caracteres
  por token). É a única heurística de estimativa de tokens do código.
- Teto `--pack-max-tokens` (default `8000`) → aviso e `pack_over_ceiling: true`, sem abortar.
- Em `--dry-run` a construção é pulada por inteiro (`executar-tasks.ts:416-424`).

### 3.4 Comando 3 — Versão (CT-023)

`getVersion` (`:331-335`): `claude --version`, timeout de **5 s**
(`CLI_VERSION_TIMEOUT_MS`, `:17`), primeira linha do stdout.
Falha de spawn, timeout ou código de saída diferente de zero produzem string vazia, e o
preflight classifica o item `cli-versao` como ERRO (`preflight-service.ts:135-139`).

### 3.5 Comando 4 — Verificação de MCPs (CT-022)

`mcpListRaw` / `interpretMcpStatus` / `listMcps` (`:342-402`):

| Item | Valor |
|:---|:---|
| Comando | `claude mcp list` |
| Timeout | `--mcp-timeout` segundos, default `15` |
| stdin | `'ignore'` — sem isso o processo pode aguardar entrada indefinidamente |
| cwd / env | nenhum customizado |
| Saída parcial | **descartada por inteiro** em timeout ou falha de spawn (`:348-350`) |

Interpretação por MCP declarado na task, com o nome escapado por `escaparRegExp` (`:49-51`):

| Situação | Regex | Severidade |
|:---|:---|:---|
| Conectado | `^<nome>:.*(Connected\|✔)` (flag `m`) | `OK` |
| Configurado, não conectado | `^<nome>:` | `AVISO` |
| Ausente da listagem | — | `AVISO` |
| Leitura invalidada (`null`) | — | `AVISO` |

Os nomes de MCP e skill vêm da seção `## 9.` do arquivo de task, no formato
`- [ ] **<nome>**` + `*Tipo:* SKILL|MCP` (`preflight-service.ts:45-49`, `:442-481`).

### 3.6 Ambiente do processo filho (ENV-001)

`buildEnv` (`:167-175`): `{ ...process.env }` mais **exatamente uma** adição —
`CLAUDE_CODE_PROMPT_CACHE_TTL = '1h'`, e somente quando o cache tuning está ligado **e** a
variável ainda está indefinida no ambiente. Nenhuma outra variável é criada, alterada ou
removida.

### 3.7 Contrato de saída — campos consumidos

`parseResult` (`:240-318`). A saída é lida como **um único objeto JSON bufferizado**
(`JSON.parse`, `:247`). Não há parsing de JSONL nem de stream em lugar algum do código —
confirmado por varredura: `--print`, `--verbose`, `stream-json`, `--resume`, `--session-id`,
`--settings` e `--mcp-config` não ocorrem em `src/`.

| Campo JSON | Campo em `TaskResult` | Observação |
|:---|:---|:---|
| `session_id` | `sessionId` | fallback `'?'` |
| `is_error` | `isError` | `true` força o caminho degradado |
| `subtype` | `subtype` | fallback `'success'` |
| `num_turns` | `numTurns` | |
| `duration_ms` | `durationMs` | |
| `duration_api_ms` | `durationApiMs` | |
| `total_cost_usd` | `costUsd` | custo **verbatim**; não há tabela de preços |
| `model` | `model` | fallback `''` |
| `modelUsage.<modelo>.{inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens}` | os quatro contadores | **soma de todas as chaves** |
| `usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` | os quatro contadores | **apenas** quando `modelUsage` ausente ou vazio |
| `permission_denials[]` | `permissionDenials` | quantidade |
| `permission_denials[].tool_name` | `ferramentasNegadas` | deduplicado, junto por vírgula, ou `null` |

**Regra de contabilidade — exclusiva, não cumulativa:** quando `modelUsage` existe e tem ao
menos uma chave, os quatro contadores são a soma de todas as entradas, e `usage` é ignorado
por completo — porque `usage` cobre só o loop principal e não conta subagentes
(`:269-282`). `modelosReportados` = chaves de `modelUsage` juntas por vírgula, ou `model`.

**Caminho degradado** (`:206-232`), acionado por `exitCode !== 0`, exceção no `JSON.parse`
ou `is_error === true`: `subtype: 'parse_error'`, `isError: true`, os quatro contadores em
`0`, `sessionId: '?'`. A task é contabilizada como erro e o lote segue, salvo
`--stop-on-failure`.

Contabilidade derivada (`src/utils/accounting.ts`):
`tokensDaTask = input + output + cacheCreation + cacheRead` — leituras de cache contadas com
peso integral, sem fator de desconto (`:30-34`).

### 3.8 Detecção de limite de uso (RF-019)

`detectRateLimit` (`:323-325`), aplicada ao **texto bruto** de
`` `${rawStdout}\n${rawStderr}` `` (`task-runner.ts:435`):

```
/usage limit|rate.?limit|weekly limit|session limit/i
```

Ao casar, o lote encerra imediatamente com motivo `limite_de_uso`.

### 3.9 Mecanismo de processo

`src/utils/process-runner.ts`, comum a todas as invocações:

| Aspecto | Comportamento |
|:---|:---|
| Spawn | `child_process.spawn`, `shell: false` sempre (`:150`) — nunca há string de comando concatenada |
| Resolução do binário | varredura explícita de `PATH`/`Path`, descartando entradas vazias, de forma que o **diretório corrente nunca é pesquisado** (`:75-105`) |
| Windows | `PATHEXT` (default `.COM;.EXE;.BAT;.CMD`); `.bat`/`.cmd` lançados via `ComSpec` com `['/d','/s','/c', ...]` (`:139-142`) — relevante porque o `claude` instalado por npm é um `claude.cmd` |
| stdio | `[stdin ?? 'ignore', 'pipe', 'pipe']`; stderr transmitido por `onStderrChunk` e **nunca impresso na tela** — vai para `run_<RUN_ID>.stderr` |
| Encerramento | resolve em `'close'`, não em `'exit'` (`:242`), para o JSON do stdout nunca chegar truncado |
| Timeout | `SIGTERM` no prazo, `SIGKILL` 5 s depois (`SIGKILL_GRACE_MS`); mesma disciplina para `AbortSignal` |
| Timeout da task | **nenhum** — a duração de uma task é por natureza desconhecida; o controle é `--max-budget-usd`, repassado à CLI |
| Falha de spawn | `{ exitCode: -1, spawnFailed: true }`, nunca lança exceção |

Frequência de invocação: a CLI é chamada **no máximo duas vezes fora do loop de tasks** —
`--version` e `mcp list` (`preflight-service.ts:61`).

### 3.10 Opções do comando e seus defaults

`src/commands/executar-tasks.ts:546-569`, validadas em `executar-tasks-validation.ts`:

| Opção | Default | Validação |
|:---|:---|:---|
| `--tool <slug>` | resolvido | um dos 5 slugs, case-insensitive |
| `--model <modelo>` | `sonnet` | não vazio |
| `--effort <nivel>` | `medium` | `low\|medium\|high\|xhigh\|max` |
| `--fallback-model <modelo>` | `''` | não vazio quando informado |
| `--auto-approve` | `false` | — |
| `--permission-mode <modo>` | `''` | enum de 5 valores |
| `--no-skill-dirs` | `skillDirs = true` | — |
| `--max-budget-usd <n>` | `0` | finito, ≥ 0 |
| `--window-budget-tokens <n>` | `0` | inteiro, ≥ 0 |
| `--stop-on-failure` | `false` | — |
| `--sleep <segundos>` | `0` | finito, ≥ 0 |
| `--no-cache-tuning` | `cacheTuning = true` | — |
| `--no-context-pack` | `contextPack = true` | — |
| `--pack-model <modelo>` | `sonnet` | não vazio |
| `--pack-effort <nivel>` | `low` | enum de esforço |
| `--pack-max-tokens <n>` | `8000` | inteiro, ≥ 0 |
| `--tasks <selecao>` | `''` | `/^[0-9,\-\s]+$/` |
| `--allow <regra>` (repetível) | `[]` | entradas não vazias |
| `--preflight` | `false` | — |
| `--skip-preflight` | `false` | — |
| `--require-cmd <cmd>` (repetível) | `[]` | entradas não vazias |
| `--mcp-timeout <seg>` | `15` | inteiro > 0 |
| `--no-mcp-check` | `mcpCheck = true` | — |
| `--dry-run` | `false` | — |

Das 24 opções, **11 são repassadas à CLI** (seção 3.2); as demais são orquestração interna.

---

## 4. Mapa de equivalência por necessidade

Este é o insumo de planejamento das próximas integrações. Cada linha é uma necessidade do
`executar-tasks`; cada coluna, o equivalente real na CLI daquela ferramenta.

**Legenda:** `—` = não existe equivalente · `?` = a confirmar (não verificado na documentação
oficial até esta data — nenhum contrato foi inventado aqui).

A coluna **OpenCode** foi fechada em 01/09/2026 contra o código-fonte da CLI
(`packages/opencode/src/cli/cmd/run.ts`, `permission/index.ts`, `agent/agent.ts` e
`packages/schema/src/v1/session.ts`). As demais colunas seguem no estado anterior.

### 4.1 Execução de task

| Necessidade | Claude Code | OpenCode | Cursor CLI | Gemini CLI | Kiro |
|:---|:---|:---|:---|:---|:---|
| Execução headless | `-p <prompt>` | `opencode run --command <nome> <args>` | `agent -p <prompt>` | `gemini -p <prompt>` | `?` |
| Saída estruturada | `--output-format json` | `--format json` (**NDJSON de eventos**) | `--output-format json\|stream-json` | `--output-format json\|stream-json` (`-o`) | `?` |
| Modelo | `--model <modelo>` | `--model provider/modelo` (`-m`) | `--model <modelo>` | `--model <modelo>` | `?` |
| Nível de esforço | `--effort <nivel>` | `--variant <high\|max\|minimal>` | — | — | `?` |
| Sem prompt de permissão | `--permission-mode bypassPermissions` | agente com `{"*":"allow"}` via `OPENCODE_CONFIG` + `--agent` (`--auto` **não** basta) | `--force` | `--approval-mode=yolo` (`--yolo` está deprecado) | `?` |
| Modo de permissão granular | `acceptEdits\|auto\|dontAsk\|manual\|bypassPermissions` | `permission` em config, global ou por agente; última regra casada vence | `permissions.allow` / `permissions.deny` em config | `--approval-mode` | `?` |
| Diretórios extras de leitura | `--add-dir <dir>` (repetível) | — (só `external_directory: allow`; `--dir` troca o cwd) | — | `--include-directories` (repetível ou por vírgula) | `?` |
| Injeção de system prompt | `--append-system-prompt-file <arquivo>` | `agent.<id>.prompt = "{file:...}"` (acrescenta ou substitui: **a confirmar**) | — | — | `?` |
| Modelo de fallback | `--fallback-model <lista ordenada>` | — | — | — | — |
| Restrição de ferramentas | `--allowedTools <regra>` (repetível) | `permission` por ferramenta, em config ou agente | `permissions.allow` em config | `--allowed-tools` (`?` verificar) | `?` |
| Teto de custo nativo | `--max-budget-usd <n>` | — | — | — | — |
| Otimização de cache de prompt | `--exclude-dynamic-system-prompt-sections` + `CLAUDE_CODE_PROMPT_CACHE_TTL` | — | — | — | — |

### 4.2 Leitura do resultado

| Necessidade | Claude Code | OpenCode | Cursor CLI | Gemini CLI | Kiro |
|:---|:---|:---|:---|:---|:---|
| Formato da saída | objeto JSON único | NDJSON: `{type, timestamp, sessionID, ...}` por linha | JSON ou stream-json | JSON ou stream-json | `?` |
| Tipos de evento | — (objeto único) | `tool_use`, `step_start`, `step_finish`, `text`, `reasoning`, `error` | `?` | `?` | `?` |
| Identificador de sessão | `session_id` | `sessionID` em **todo** evento | `?` | `--list-sessions` existe; campo na saída `?` | `?` |
| Sinal de erro | `is_error` + código de saída | evento `error` + `exitCode 1` | `?` | `?` | `?` |
| Contagem de tokens | `usage` + `modelUsage` (com subagentes) | soma de `step_finish.part.tokens` | `?` | `?` | `?` |
| Custo em USD | `total_cost_usd` | soma de `step_finish.part.cost` | — `?` | — `?` | `?` |
| Turnos | `num_turns` | contagem de eventos `step_finish` | `?` | `?` | `?` |
| Duração | `duration_ms`, `duration_api_ms` | só a total, por diferença de `timestamp` | `?` | `?` | `?` |
| Negações de permissão | `permission_denials[].tool_name` | — (negação vira erro/recusa) | `?` | `?` | `?` |

### 4.3 Comandos auxiliares

| Necessidade | Claude Code | OpenCode | Cursor CLI | Gemini CLI | Kiro |
|:---|:---|:---|:---|:---|:---|
| Versão da CLI | `claude --version` | `opencode --version` (`-v`) | `?` | `?` | `?` |
| Listagem de MCPs | `claude mcp list` | `opencode mcp list` (alias `mcp ls`) — **formato da linha a confirmar** | `?` | `?` | `?` |
| Detecção de limite de uso | regex sobre o texto bruto | mesma regex sobre o texto bruto (mensagem vem do provider) | `?` | `?` | `?` |

### 4.4 Leitura das tabelas acima

Quatro conclusões saltam do mapa:

1. **`--max-budget-usd` e o cache tuning são exclusivos do Claude Code.** Nenhuma das outras
   quatro CLIs tem equivalente. Decisão de produto necessária: desligar via capacidade ou
   emular no orquestrador. Com o custo por passo confirmado no OpenCode (conclusão 4), a
   emulação passou a ser viável.
2. **Permissões migram de flag para arquivo de configuração.** No Claude Code é uma flag por
   invocação; no OpenCode e no Cursor é config persistida em disco. Um adapter para essas
   ferramentas precisa ou escrever config (o que viola RNF-002, "o binário escreve zero
   arquivos no projeto") ou aceitar a config do usuário como pressuposto do preflight.
   **No OpenCode existe uma terceira saída**, que é a recomendada: um agente dedicado com
   `{"*": "allow"}` entregue por `OPENCODE_CONFIG` a partir de diretório próprio do
   specifica-br. Como o OpenCode resolve permissão por *última regra que casa* (`findLast`)
   e concatena a regra de agente depois da global, o agente vence qualquer `deny` do usuário
   sem que nada seja escrito no projeto.
3. **A injeção do Contexto de Execução (`--append-system-prompt-file`) não tem equivalente
   direto em Cursor nem em Gemini CLI.** Alternativa provável: concatenar o destilado ao
   próprio prompt do `-p`, o que muda a economia de cache e precisa ser medido. No OpenCode
   há um candidato melhor — `agent.<id>.prompt = "{file:...}"` no mesmo arquivo de agente da
   conclusão 2 — pendente de confirmar se acrescenta ou substitui o system prompt base.
4. **A forma da saída não é uniforme, e essa é a maior diferença estrutural.** O Claude Code
   entrega um objeto JSON único ao final; o OpenCode entrega NDJSON de eventos durante a
   execução, com tokens e custo em `step_finish`. `parseResult` precisa admitir agregação de
   eventos, e não apenas `JSON.parse` de stdout bufferizado. Em compensação, o OpenCode
   reporta **custo em USD**, o que não se supunha na revisão anterior deste documento.

---

## 5. Fichas das ferramentas pendentes

Estrutura uniforme para cada integração futura. As três primeiras linhas de cada ficha já
estão definidas no código; o restante precisa ser levantado.

### 5.1 OpenCode (`opencode`) — próximo alvo

| Item | Valor |
|:---|:---|
| Executável | `opencode` (`tool-registry.ts`) |
| Detecção | `.opencode/command/` (legado `.opencode/commands/` — **não é lido**, ver 6.5) |
| Comandos globais | `<config>/opencode/command/` (única ferramenta com base `config`, não `home`) |
| Skills | `.agents/skills/` (projeto e global) |
| Config validada no preflight | `opencode.json` |
| Execução headless | `opencode run --command <nome> <args>` — `--command` é obrigatório para invocar comando customizado; sem ele a mensagem vai como texto puro, **sem expansão de `/`** |
| Modelo | `--model provider/modelo` (`-m`) |
| Esforço | `--variant <high\|max\|minimal>` — flag dedicada, não sufixo de modelo |
| Permissões | `permission` em `opencode.json`/`opencode.jsonc`, global ou por agente; resolução por *última regra que casa* |
| Saída estruturada | `--format json` → NDJSON de eventos; tokens e custo em `step_finish` |
| Auxiliares | `opencode --version`, `opencode mcp list` |
| A levantar | **formato de linha de `opencode mcp list`**; se `agent.prompt` acrescenta ou substitui o system prompt base |

**Prioridade confirmada:** `specs/prompts/0004-execucao-tasks-loop-com-opencode.md` é o pedido
formal desta integração; `specs/prompts/0005-prd-executar-tasks-opencode.md` (o quê) e
`specs/prompts/0006-techspec-executar-tasks-opencode.md` (o como) são o levantamento que o
atende. Contexto anterior:
`docs/analises/0001-consumo-de-tokens-loop-tasks.md:10` ("Apenas Claude Code. OpenCode fica
para outro momento"). O MVP 1 do produto nasceu focado em OpenCode
(`docs/mvp-roadmap.md`).

**Capacidades projetadas: 6 de 7.** Só `liberacaoDeDiretoriosDeLeitura` fica desligada — não
há equivalente de `--add-dir`.

**Checklist para `contratoValidado: true`:**
- [x] Confirmar o formato de saída estruturada de `opencode run` e mapear os campos de `TaskResult` — NDJSON, agregação por `step_finish`
- [x] Decidir como expressar permissões sem escrever arquivos no projeto do usuário — agente allow-all via `OPENCODE_CONFIG`
- [x] Mapear `--effort` — é `--variant`, não sufixo de modelo
- [x] Definir o comportamento quando não há `total_cost_usd` — há custo (`step_finish.part.cost`); a questão deixou de existir
- [ ] Decidir o destino do Contexto de Execução (`agent.prompt` vs. concatenação no prompt) — depende de confirmar se `agent.prompt` acrescenta ou substitui
- [ ] Levantar o formato de linha de `opencode mcp list` para a regex de status
- [ ] Ler `legacyCommands` na detecção
- [ ] Implementar `getVersion` e `listMcps`
- [ ] Decidir o destino do quinto contador `tokens.reasoning`, que não existe em `TaskResult`

Especificação completa em `specs/prompts/0006-techspec-executar-tasks-opencode.md`
(decisões de produto correlatas em `specs/prompts/0005-prd-executar-tasks-opencode.md`).

### 5.2 Gemini CLI (`gemini-cli`)

| Item | Valor |
|:---|:---|
| Executável | `gemini` |
| Detecção | `.gemini/commands/` |
| Skills | `.agents/skills/` |
| Config validada no preflight | `.gemini/settings.json` |
| Execução headless | `gemini -p "<prompt>"` |
| Saída estruturada | `--output-format text\|json\|stream-json` (alias `-o`), default `text` |
| Diretórios extras | `--include-directories` (por vírgula ou repetível) — equivalente direto de `--add-dir` |
| Aprovação automática | `--approval-mode=yolo`; `--yolo` está deprecado |
| Ausentes | `--effort`, `--max-budget-usd`, injeção de system prompt, fallback de modelo |
| A levantar | campos de token/custo/sessão na saída JSON, listagem de MCPs |

É a ferramenta com a **maior cobertura de flags equivalentes** depois do Claude Code.

### 5.3 Cursor CLI (`cursor`)

| Item | Valor |
|:---|:---|
| Executável | `cursor` no registro — **atenção:** a documentação oficial usa `agent` / `cursor-agent` |
| Detecção | `.cursor/commands/` |
| Config validada no preflight | `.cursor/mcp.json` |
| Execução headless | `agent -p "<prompt>"` |
| Saída estruturada | `--output-format text\|json\|stream-json` |
| Escrita de arquivos | `--force` — **sem ele, mudanças são apenas propostas, não aplicadas** |
| Permissões | `permissions.allow` / `permissions.deny` na config, sintaxe `Shell(...)`, `Read(...)`, `Write(...)`, `WebFetch(...)`, `Mcp(...)` |
| Ausentes | `--effort`, `--add-dir`, injeção de system prompt, `--max-budget-usd` |

**Risco identificado:** o nome do executável registrado (`cursor`) diverge do binário
documentado (`agent` / `cursor-agent`). Precisa ser confirmado antes da integração — hoje o
preflight procuraria `cursor` no PATH e reprovaria.

### 5.4 Kiro (`kiro`)

| Item | Valor |
|:---|:---|
| Executável | `kiro` |
| Detecção | `.kiro/commands/` |
| Skills | `.kiro/skills/` |
| Config validada no preflight | `.kiro/settings/mcp.json` |
| Tudo o mais | a levantar — nenhuma documentação de CLI headless foi consultada |

É a ferramenta com menos informação disponível. Recomendado deixar por último.

---

## 6. Pendências estruturais que bloqueiam a segunda integração

### 6.1 A interface `ToolAdapter` está incompleta

`ToolAdapter` (`src/types/tool-adapter.ts:55-66`) não declara `runTask`, `runPack` nem
`resolveExtraDirs`, embora o comando use os três. A consequência está em
`src/commands/executar-tasks.ts:169`:

```ts
const adapter = adapterBase as unknown as ClaudeCodeAdapter;
```

Um cast de tipo concreto no meio do fluxo genérico. **Qualquer segundo adapter exige ampliar
a interface primeiro** — caso contrário o comando continuará tipado contra o Claude Code.

### 6.2 Nome do executável duplicado em três lugares

1. `tool-registry.ts:40-76` — campo `executavel` de cada entrada;
2. `preflight-service.ts:22-28` — `EXECUTAVEL_POR_SLUG`, mapa idêntico;
3. `claude-code-adapter.ts:16` — constante `EXECUTAVEL_CLAUDE`.

Três fontes da mesma verdade que podem divergir. Relacionado ao risco de 5.3
(`cursor` vs `agent`).

### 6.3 Regra de permissão duplicada

`modoDePermissaoEfetivo` existe no adapter (`:74-84`) e é reimplementada no preflight
(`preflight-service.ts:184-199`). Ferramentas cujo modelo de permissão é config em disco
(OpenCode, Cursor) vão precisar de uma terceira variante — o ponto certo é o adapter.

### 6.4 Vazamento do nome "claude" na saída ao usuário

Dois pontos imprimem o nome literal independentemente da ferramenta resolvida:

- `src/commands/executar-tasks.ts:262` — `Ferramenta ${ferramenta} (claude ${versao})`
- `src/utils/task-runner.ts:313` — `dry-run: claude ${args.join(' ')}`

Com OpenCode registrado, o cabeçalho exibiria `opencode (claude 2.1.0)`.

### 6.5 `legacyCommands` do OpenCode nunca é consultado

`tools-mapping.json` traz `legacyCommands: ".opencode/commands/"` para o OpenCode, mas
`ToolResolver.detectar` (`tool-resolver.ts:139-155`) só testa o campo `commands`. Projetos
OpenCode criados antes da renomeação para `.opencode/command/` não são detectados.

### 6.6 Custo depende de a CLI reportá-lo

Não há tabela de preços nem aritmética por modelo em lugar nenhum
(`src/utils/accounting.ts`). O custo vem verbatim de `total_cost_usd`, então `--max-budget-usd`
e o custo acumulado do resumo dependem inteiramente da capacidade
`saidaEstruturadaComTokens`, que hoje é binária (tokens *e* custo juntos).

**Atualização de 01/09/2026:** o OpenCode **reporta custo em USD** (`step_finish.part.cost`),
ao contrário do que se supunha quando esta pendência foi escrita. Isso não elimina o problema,
apenas o desloca: a capacidade continua binária, e Cursor, Gemini CLI e Kiro seguem não
confirmados. O desmembramento sugerido em 7.3 continua valendo — ver especialmente
`relatoDeCustoEmUSD` e `tetoDeCustoNativo`.

### 6.7 Flags sem equivalente exigem decisão de produto

`--effort`, `--max-budget-usd` e o cache tuning
(`--exclude-dynamic-system-prompt-sections` + `CLAUDE_CODE_PROMPT_CACHE_TTL`)
não existem fora do Claude Code. As opções continuam expostas no comando para todas as
ferramentas. É preciso decidir, por opção: degradar silenciosamente via capacidade, recusar
com `[ AVIS]`, ou emular no orquestrador.

---

## 7. Sugestões

Registradas como recomendação; nada aqui foi implementado.

### 7.1 Ordem de integração sugerida

1. **OpenCode** — origem histórica do produto, próximo alvo declarado, e o único cuja
   configuração de permissão já está documentada em detalhe.
2. **Gemini CLI** — maior cobertura de flags equivalentes (`-p`, `--output-format json`,
   `--model`, `--include-directories`, `--approval-mode`), portanto o menor esforço por
   capacidade destravada.
3. **Cursor CLI** — depende de resolver a divergência do nome do executável e da ausência de
   `--add-dir`.
4. **Kiro** — última, por falta de documentação de modo headless.

### 7.2 Preparação estrutural antes do segundo adapter

Sugerido resolver, nesta ordem, antes de escrever qualquer adapter novo:
ampliar `ToolAdapter` (6.1) → centralizar o nome do executável (6.2) → mover a regra de
permissão só para o adapter (6.3) → limpar o vazamento de "claude" na saída (6.4).

São quatro mudanças pequenas, sem alteração de comportamento observável, que transformam o
segundo adapter de refatoração em adição.

### 7.3 Granularizar o contrato de capacidades

`saidaEstruturadaComTokens` hoje agrupa duas coisas que as outras CLIs oferecem
separadamente. Sugerido desmembrar e acrescentar:

| Capacidade sugerida | Motivo |
|:---|:---|
| `relatoDeCustoEmUSD` | separa custo de contagem de tokens; hoje estão fundidos |
| `tetoDeCustoNativo` | `--max-budget-usd` só existe no Claude Code |
| `esforcoConfiguravel` | `--effort` só existe no Claude Code; no OpenCode é variante do modelo |
| `otimizacaoDeCacheDePrompt` | exclusivo do Claude Code |

Isso permite que uma ferramenta entre com contrato parcial honesto, em vez de precisar de
tudo ou nada.

### 7.4 Documentar o levantamento de cada CLI antes de codar

Sugerido, para cada ferramenta, preencher primeiro a coluna correspondente do mapa da seção 4
— substituindo cada `?` por evidência da documentação oficial — e só então abrir a
implementação do adapter. As células `?` são, hoje, a lista de perguntas em aberto do
projeto.

**A prática foi exercitada no OpenCode em 01/09/2026 e se pagou.** Duas suposições deste
documento caíram (`--effort` não é sufixo de modelo, e sim `--variant`; o custo em USD existe),
e apareceu uma diferença estrutural — NDJSON em vez de objeto único — que teria sido descoberta
tarde, já com o adapter em código. Recomenda-se tornar o levantamento prévio obrigatório para
Cursor, Gemini CLI e Kiro.
