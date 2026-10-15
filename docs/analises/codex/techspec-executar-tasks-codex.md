# Entrada de TechSpec — Integração Codex no `executar-tasks`

| Metadado | Valor |
|:---|:---|
| **Documento** | Levantamento técnico de entrada para a TechSpec da feature |
| **Data** | 11/09/2026 |
| **Escopo** | Contrato de execução do Codex CLI para o adapter de `executar-tasks` |
| **Estado** | Pesquisa concluída; validações práticas pendentes (seção 10) |
| **Documentos irmãos** | `docs/analises/codex/prd-executar-tasks-codex.md` (motivações e regras de negócio) |
| **Fontes** | Documentação oficial: `learn.chatgpt.com/docs/codex/cli`, `/codex/non-interactive-mode`, `/codex/windows/windows-sandbox`, `/codex/config-file/*`. Código-fonte via MCP `context7` (`/openai/codex`): `codex-rs/exec/src/cli.rs`, `exec/src/lib.rs`, `exec/src/exec_events.rs`, `exec/src/event_processor_with_jsonl_output.rs`, `codex-rs/config/src/config_toml.rs`, `sdk/typescript/src/events.ts`, `codex-rs/skills/src/model.rs` |

---

## 1. Identificação

| Item | Valor |
|:---|:---|
| Ferramenta | Codex (OpenAI) |
| Slug proposto | `codex` |
| Executável | `codex` |
| Subcomando de execução | `codex exec` (não-interativo) |
| Config global | `~/.codex/config.toml` (`CODEX_HOME` sobrepõe `~/.codex`) |
| Auth | login ChatGPT salvo em `~/.codex/auth.json` ou `CODEX_API_KEY` |
| Entrada em `tools-mapping.json` | Já existe (skills `.agents/skills/`, templates; sem commands) |
| Situação no registro | `TOOL_SLUGS` (`src/types/config.ts:7`) e `REGISTRO` (`tool-registry.ts:74-110`) não têm o slug `codex` |

## 2. Comando 1 — Execução de task

Sintaxe: `codex exec [OPTIONS] [PROMPT]`. Aprovação é `Never` por padrão no modo
headless (`exec/src/lib.rs`); o controle de escrita é feito pelo sandbox.

### 2.1 Formas de entrega do prompt

| Forma | Como | Avaliação |
|:---|:---|:---|
| Posicional | `codex exec "<prompt>"` | Teto de 32.767 chars de `CreateProcess` no Windows (o Contexto de Execução com teto de 8k tokens chega a ~28k chars pela heurística de 3,5 chars/token); quando o binário é `.cmd`, os argumentos são re-parseados pelo `cmd.exe` via `ComSpec`, com risco de corrupção por aspas e caracteres especiais |
| **stdin (decisão D-03)** | `codex exec -` com o prompt completo escrito no stdin | Imune a `ARG_MAX` e a escaping; suportado explicitamente pela documentação oficial (`cat prompt.txt \| codex exec -`) |
| Skill explícita | prompt iniciado por `$nome-da-skill` | Skills são invocadas com prefixo `$` (não `/`); exige skill presente em `$CODEX_HOME/skills` |

**Lacuna estrutural para a forma stdin:** `process-runner.ts:144` aceita stdin apenas
como `'ignore' \| 'inherit'` — não há suporte a *escrever* no stdin do filho. A
extensão do `RunOptions`/runner é pré-requisito da decisão D-03 (mudança no núcleo
compartilhado, com testes; disciplina de `close` e timeouts preservada).

### 2.2 Flags por necessidade

| Necessidade | Flag Codex | Observação |
|:---|:---|:---|
| Saída estruturada | `--json` (alias `--experimental-json`) | JSONL em stdout; sem ela, progresso vai ao stderr e só a mensagem final ao stdout |
| Modelo | `-m` / `--model` | |
| Esforço | `-c model_reasoning_effort="<nivel>"` | Override de config pela flag `-c`; não é flag dedicada |
| Escrita no workspace | `--sandbox workspace-write` (`-s`) | Padrão do exec é `read-only` — sem isso a task não escreve |
| Acesso pleno | `--sandbox danger-full-access` | Equivalente funcional de bypass |
| Aprovação | `Never` por padrão no exec | `--ask-for-approval` existe; `--full-auto` está deprecado |
| Config isolada | `--ignore-user-config`, `--ignore-rules` | Ignora `config.toml` e arquivos `.rules` do usuário |
| Diretório de trabalho | `--cd <dir>` | |
| Repositório Git | exigido; `--skip-git-repo-check` para ignorar | Novo item de preflight |
| Sessão efêmera | `--ephemeral` | **Não usar** (seção 7) |
| Mensagem final em arquivo | `--output-last-message <arquivo>` (`-o`) | Opcional; a mensagem final também sai no stdout |
| Saída com schema | `--output-schema <arquivo>` | Força resposta final conforme JSON Schema |

### 2.3 Mapeamento de modo de permissão (proposto)

| Entrada specifica-br | Codex |
|:---|:---|
| `acceptEdits` | `--sandbox workspace-write` |
| `bypassPermissions` / `--auto-approve` | `--sandbox danger-full-access` (aprovação já é `Never`) |
| `manual` / `dontAsk` / `auto` | sem equivalente direto; degradar para o mais próximo com aviso nominal |

Diretórios extras: sem equivalente de `--add-dir`. Em `workspace-write`, escrita fora do
workspace exige `writable_roots` via config (`-c sandbox_workspace_write.writable_roots=[...]`).

## 3. Comando 2 — Contexto de Execução (context pack)

Não há `--append-system-prompt`. Alternativas levantadas:

| Alternativa | Avaliação |
|:---|:---|
| **Concatenação ao prompt** (recomendada) | Análoga à forma `--context-injection prompt` do adapter OpenCode; combina naturalmente com a entrega via stdin (D-03); muda a economia de cache (o destilado é reenviado por task) |
| `model_instructions_file` em `config.toml` | **Substitui** as instruções base do modelo — arriscado, descartado |
| `AGENTS.md` | Mecanismo nativo de contexto de projeto do Codex; não substitui o destilado por task |

## 4. Contrato de saída — JSONL

Fonte: `exec/src/exec_events.rs` e `sdk/typescript/src/events.ts`. Cada linha é um
objeto JSON com campo `type`. Eventos: `thread.started`, `turn.started`, `item.started`,
`item.updated`, `item.completed`, `turn.completed`, `turn.failed`, `error`.

Amostra oficial (abreviada):

```
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":24763,"cached_input_tokens":24448,"output_tokens":122,"reasoning_output_tokens":0}}
```

### 4.1 Mapeamento para `TaskResult`

| Origem (JSONL) | Destino (`TaskResult`) | Observação |
|:---|:---|:---|
| `thread.started.thread_id` | `sessionId` | fallback `'?'` |
| `turn.completed.usage.input_tokens` | `inputTokens` | |
| `turn.completed.usage.cached_input_tokens` | `cacheReadInputTokens` | tende a dominar a contagem |
| `turn.completed.usage.cache_write_input_tokens` | `cacheCreationInputTokens` | |
| `turn.completed.usage.output_tokens` | `outputTokens` | |
| `turn.completed.usage.reasoning_output_tokens` | **TBD-001** | 5º contador; decisão compartilhada com a pendência do OpenCode |
| — | `costUsd` | `n/d` (decisão D-02); sem campo de custo em nenhum evento |
| contagem de `turn.completed` | `numTurns` | |
| — | `durationMs` / `durationApiMs` | sem equivalente no JSONL; usar duração medida pelo orquestrador |
| — | `modelosReportados` | evento não reporta modelo efetivo → `relatoDeModeloEfetivo: false` |
| `turn.failed` / `error` + `exitCode !== 0` | `isError`, `subtype` | caminho degradado análogo ao das outras CLIs: JSONL ilegível → `subtype: 'parse_error'`, contadores zerados |
| — | `permissionDenials` / `ferramentasNegadas` | não reportado → `n/d`, nunca zero (mesma disciplina do OpenCode) |

Contabilidade: `tokensDaTask = input + output + cacheCreation + cacheRead`, leitura de
cache com peso integral (`accounting.ts`) — régua idêntica às outras ferramentas.

## 5. Capacidades propostas (13)

Ligadas: `execucaoNaoInterativa`, `modoSemPromptDePermissao`,
`saidaEstruturadaComTokens`, `identificadorDeSessao`,
`injecaoDeContextoNoSystemPrompt` (via concatenação ao prompt), `consultaAosMcps`.

Desligadas: `relatoDeCustoEmUSD` (D-02), `tetoDeCustoNativo`, `modeloDeFallback`,
`otimizacaoDeCacheDePrompt`, `relatoDeNegacoesDePermissao`, `formaDeInjecaoSelecionavel`
(uma única forma), `relatoDeModeloEfetivo`.

`liberacaoDeDiretoriosDeLeitura`: a validar — em `workspace-write` a leitura fora do
workspace pode já ser ampla no Codex; confirmar em teste prático antes de ligar.

## 6. Auxiliares

| Item | Valor |
|:---|:---|
| Versão | `codex --version`; **piso de versão a definir** — a superfície do `exec` muda rápido (`--json` é alias recente de `--experimental-json`) |
| MCPs | `codex mcp list`; **formato a capturar byte a byte** (verificar presença de ANSI, como feito com o OpenCode) |
| MCP obrigatório | servidor com `required = true` que falha derruba o `exec` inteiro — comportamento desejável para o preflight grupo E (fail fast) |
| Limite de uso | regex atual (`/usage limit\|rate.?limit\|weekly limit\|session limit/i`) deve casar; validar o texto real do provider |
| Auth | detectar antes do lote: `~/.codex/auth.json` existente ou `CODEX_API_KEY` no ambiente; comando de status a confirmar — sem isso a primeira task queima o lote |

## 7. Sessões

Rollouts de sessão são persistidos por padrão em `CODEX_HOME`. **Não usar `--ephemeral`**:
o RF-017 grava o identificador de sessão nas evidências e o Codex só retoma via
`codex exec resume <thread_id>` quando a sessão foi persistida. A persistência não
escreve no projeto do usuário (atende RNF-002).

## 8. Sistemas operacionais

| SO | Situação |
|:---|:---|
| Linux / macOS | sandbox nativo (landlock-seccomp / Seatbelt); sem ressalvas conhecidas |
| Windows | CLI nativa (ConPTY; Windows 11 recomendado, Windows 10 1809+ best effort). Sandbox nativo em dois modos via `config.toml`: `[windows] sandbox = "elevated"` (preferido; exige setup aprovado por administrador) ou `"unelevated"` (fallback com token restrito e ACLs). WSL é alternativa. **Maior risco SO:** validar `codex exec --sandbox workspace-write` no Windows antes de prometer suporte |
| Binário | distribuição via npm cobre os três SO; wrapper `.cmd` no Windows já tratado pelo `process-runner` (PATHEXT + `ComSpec`) |

## 9. Encaixe estrutural no código

| Ponto | Mudança |
|:---|:---|
| `src/types/config.ts:7` | acrescentar `'codex'` a `TOOL_SLUGS` |
| `src/utils/tool-adapters/tool-registry.ts` | nova entrada em `REGISTRO` (executável `codex`, capacidades da seção 5); atualizar `NOMES_DISPONIVEIS` (`:117`) e o despacho de `getAdapter` |
| `src/utils/preflight-service.ts:22-28` | acrescentar `codex` em `EXECUTAVEL_POR_SLUG`; novos itens: repositório Git, auth |
| `src/assets/tools-mapping.json` | entrada Codex já existe (skills-only) |
| Novo `src/utils/tool-adapters/codex-adapter.ts` | padrão dos adapters existentes; `buildTaskArgs`, `buildContextPackArgs`, `buildEnv`, `parseResult` (agregação NDJSON — reusar `parse-helpers`), `detectRateLimit`, `getVersion`, `listMcps` |
| `src/utils/process-runner.ts` | estender `RunOptions.stdin` para permitir escrita no stdin do filho (pré-requisito da D-03) |
| Detecção de ferramenta | **TBD-02:** `.agents/skills/` colide com OpenCode/Gemini; opções: existência de `.codex/` no projeto, ou resolução apenas por `--tool`/registro |

## 10. Validações práticas pendentes (contra a CLI real)

- [ ] Capturar o JSONL real de um `codex exec` com escrita de arquivo (confirmar campos da seção 4).
- [ ] Capturar byte a byte a saída de `codex mcp list` (ANSI?) para a regex de status.
- [ ] Confirmar a mensagem real de rate limit e de ausência de autenticação.
- [ ] Definir o piso de versão da CLI e fixar em preflight.
- [ ] Confirmar se o Codex lê skills de `.agents/skills/` (mapeado hoje) ou exige `~/.codex/skills` / `.codex/skills/` (**TBD-03** do PRD).
- [ ] Confirmar comportamento de leitura fora do workspace em `workspace-write` (capacidade `liberacaoDeDiretoriosDeLeitura`).
- [ ] Validar `--sandbox workspace-write` no Windows nos modos de sandbox nativo.
