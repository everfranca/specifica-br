# Análise 0002 — Turnos em tasks que criam e executam testes

| Metadado | Valor |
|:---|:---|
| **Data** | 28/08/2026 |
| **Caso** | Plus-SSO / feature `00001-credencial-de-aplicacao`, task-1 |
| **Logs** | `run_20260827_123219`, `run_20260828_{145122,153112,154614,160845}` |
| **Continuação de** | [0001 — Esgotamento da janela de 5 horas](./0001-consumo-de-tokens-loop-tasks.md) |
| **Escopo** | Claude Code CLI em modo `-p`, via `scripts/loop-tasks.sh` |

---

## 1. Resumo executivo

A análise 0001 baixou o **piso** de contexto por turno de ~95k para ~35k e deixou
declarado na §8.3 que o **número de turnos** seguia intocado. Esta análise atacou os
turnos, e o resultado principal é negativo em relação à hipótese de partida:

> **A saída de terminal não é o gargalo.** Numa task inteira ela somou **4.884 tokens**.
> O custo é `turnos × prefixo fixo`, e o prefixo é reenviado a cada turno.

Um mecanismo completo de digest de testes foi construído, medido e **removido**: ele
funcionava (comprimia 23,8× num projeto .NET real) mas comprimia algo que vale 4,2% do
consumo — abaixo da dispersão entre execuções idênticas.

---

## 2. Evidência

### 2.1 Onde o custo está

Task-1, run `160845`, 48 turnos, 2.680.109 tokens (55.836 por turno). Medido na
transcrição da sessão `d4313f92`:

| Componente | Tokens | Nota |
|:---|---:|:---|
| **Todos** os resultados de ferramenta da task | 16.984 | 44 chamadas: 15 Read, 10 Bash, 9 Write, 7 Edit, 3 Skill |
| Maior resultado isolado | ~7.000 | o próprio `task-1.md` (24.514 B) |
| Saída bruta de terminal (5 execuções) | 4.884 | já com `--verbosity minimal` |
| Tokens de saída do modelo | 19.635 | |

Tudo o que o agente leu e escreveu na task inteira cabe em ~37k tokens. O contexto
médio por turno é 55.836. **A diferença é prefixo fixo reenviado 48 vezes.**

### 2.2 O prefixo fixo, medido nos arquivos

Medido em 27/08, com os arquivos que a task-7 carregava:

| Artefato | Bytes | Tokens (est., ÷3,5) |
|:---|---:|---:|
| `contexto-execucao.md` | 27.339 | ~7.811 |
| `task-7.md` | 24.150 | ~6.900 |
| `/executar-task` v0.5.0 | 13.940 | ~3.982 |
| `AGENTS.md` (plus-sso) | 8.971 | ~2.563 |
| **Total** | **74.400** | **~21.256** |

Na task-7 (80 turnos) isso são ~1,7 M tokens, ~16% do consumo, antes de qualquer
código lido. Servido como *cache read*, custa ~10% em dólar e **100% da cota** do plano.

Os arquivos mudam entre execuções — em 28/08 o pacote estava em 26.095 B, o `task-1.md`
em 26.148 B, e o `AGENTS.md` não existia mais na branch recriada. A ordem de grandeza e
o ranking se mantêm: **pacote e arquivo da task são sempre os dois maiores.**

### 2.3 A task-8 como medição de controle

Do run `20260827_123219`, com contexto por turno = `(cache_read + cache_creation) ÷ turnos`:

| Task | Turnos | Tokens | ctx/turno | Output |
|:---|---:|---:|---:|---:|
| task-5 | 69 | 6,90 M | 99.334 | 48.759 |
| task-6 | 56 | 5,27 M | 93.746 | 25.241 |
| **task-7** | **80** | **10,39 M** | **129.144** | **57.498** |
| **task-8** | **4** | **0,14 M** | **34.394** | 2.900 |
| task-9 | 27 | 1,63 M | 59.667 | 15.069 |
| task-10 | 29 | 2,65 M | 90.720 | 18.794 |

A task-8, com 4 turnos, quase não acumula: seus **34.394 tokens/turno são o piso**, e
batem com os ~35k previstos na §8.2 da análise 0001. Toda task com trabalho real roda a
3–4× esse piso. **O pacote de contexto funcionou; o que sobra é acúmulo e turnos.**

### 2.4 As quatro execuções da mesma task-1

Mesma feature, mesmo estado inicial, `sonnet` / `medium`:

| Run | Estado | Turnos | Tokens | Output | Digest |
|:---|:---|---:|---:|---:|:---|
| `145122` | comando v0.6.0, sem perfil | 44 | 2.114.037 | 20.456 | não rodou |
| `153112` | — | **6** | 238.908 | 2.511 | **no-op** |
| `154614` | perfil presente, wrapper ignorado | 41 | 2.748.743 | 18.193 | não rodou |
| `160845` | digest ativo | 48 | 2.680.109 | 19.635 | **23,8×** |

Três observações que valem mais que os números:

**Dispersão de ±13%** entre execuções que fizeram o mesmo trabalho (2,11–2,75 M), com
n=1 cada. **Nenhum efeito abaixo de ~15% é detectável neste desenho.**

**O run `153112` não fez nada.** Terminou com `exit=0` e `subtype=success` em 6 turnos.
Causa: o reset havia zerado a linha `Status` mas deixado os 50 checkboxes `[x]`, e o
PASSO 1 do `/executar-task` define escopo pelos itens `[ ]`. O agente detectou a
contradição — arquivos ausentes com a seção 8 afirmando "67 testes verdes" — e pediu
confirmação, que ninguém responde em modo `-p`. **Nas métricas de consumo isso é uma
melhoria de 9×.** Um no-op vence qualquer otimização real.

**O digest, quando finalmente rodou, teve `rodadas: 0`.** Os testes passaram de
primeira, então o ciclo de correção — onde o mecanismo teria valor — nunca aconteceu.

### 2.5 O mecanismo construído e removido

Wrapper agnóstico (`sdd-run`) que lia o relatório do runner (JUnit, TRX, TAP, JSONL) e
devolvia um resumo, mais um hook `PreToolUse` que reescrevia os comandos. Verificado
com 53 asserções automatizadas e ponta a ponta no projeto real: **4.106 B brutos → 122 B**,
67 testes, exit code preservado.

Removido porque o teto de ganho é 4,2%. O que sobreviveu:

- `/executar-task` **v0.7.1: 12.165 B** contra 13.940 da v0.5.0, por consolidação de
  repetições sem perda semântica. Texto de prompt custa `tamanho × turnos`.
- **Certificação da execução** no `loop-tasks.sh`: se a task terminou com `exit=0` mas
  não ficou `DONE`, o script marca `sem_certificacao: true`. É o que impede um no-op de
  vencer um A/B.
- **`resetar-tasks.sh`**: reabre checkboxes, `Status` e seção 8. Resetar só o `Status`
  produz escopo vazio.

### 2.6 Defeitos encontrados no caminho

Registrados porque são armadilhas gerais, não específicas deste mecanismo:

1. **Reescrita integral de arquivos.** A task-7 gastou 57.498 tokens de saída, ~25% do
   seu custo. Virou anti-pattern de edição pontual no comando.
2. **Relatório obsoleto.** Se a execução falha antes de escrever o relatório, um arquivo
   da execução anterior é lido e produz um falso "tudo verde".
3. **Zero testes executados.** Vários runners saem com código 0 quando o filtro não casa
   nada. Sem tratamento explícito, a task é marcada DONE sobre uma suíte que nunca rodou.
4. **Pipe destrói o exit code.** `cmd | grep ... | head` devolve o código do `head`. O
   agente escreveu `| tail -20` em todas as cinco invocações, **mesmo com a proibição
   presente no prompt**. Regra de prompt não é enforcement.
5. **Protocolo custa turnos.** A geração incremental (caminho feliz → executar → borda →
   executar, com filtrado e completo por fase) produziu 5 execuções e levou os turnos de
   44 para 48. Foi revertida.

---

## 3. O que atacar para melhora real

Em ordem de retorno esperado, derivada de §2.1 e §2.2. O alvo é `turnos × prefixo`.

| # | Item | Base medida | Por que rende |
|:--|:---|---:|:---|
| 1 | **Granularidade de task** | 80 turnos (task-7) | Cada turno custa ~55k. A task-7 cria solution, projetos, código e testes numa iteração. Já apontado na §8.3 da 0001 e ainda não atacado. |
| 2 | **`contexto-execucao.md`** | 7.811 tok | Maior item fixo, maior que o próprio TASK_FILE. Está **acima do teto declarado**: o default do script caiu para 6.000 mas a fórmula do `context-pack/prompt.md` (`3500 + 1200×contrato`) não mudou, então gera aviso, não pacote menor. |
| 3 | **Tamanho do `task-N.md`** | 6.900 tok | Segundo maior. Parte é instrução ao **gerador** (comentários HTML do template) que sobrevive no arquivo e é paga em todo turno por quem não a usa; a seção 4 redeclara schemas já presentes na 2.3. Escopo do `/gerar-tasks`. |
| 4 | **`AGENTS.md`** | 2.563 tok | 8.971 B. A documentação oficial recomenda manter o arquivo de memória **abaixo de 200 linhas** e mover instruções de workflow para skills, que carregam sob demanda. |
| 5 | **Tokens de saída** | 57.498 (task-7) | Edição pontual já está no comando v0.7.1; falta medir se está sendo seguida. |

O que **não** atacar de novo sem evidência nova: saída de terminal. Está medida em
4.884 tokens por task, com `--verbosity minimal` já aplicado.

---

## 4. Próximos passos e testes futuros

### 4.1 Estabelecer o piso de ruído (pré-requisito)

Rodar a mesma task 3–5 vezes sem mudar nada e medir a dispersão. Com ±13% observado em
n=1, **nenhuma das conclusões desta análise sobre efeitos pequenos é confiável**, e
qualquer experimento futuro sem esta linha de base mede ruído.

### 4.2 Usar `/context`, que nunca foi usado

A documentação de [Manage costs](https://code.claude.com/docs/en/costs) indica o comando
`/context` para ver **o que** está ocupando a janela. Toda a §2.2 desta análise foi
reconstruída somando bytes de arquivos à mão. O comando responde diretamente.

### 4.3 `--max-turns`, disponível e não usado

Confirmado na [CLI reference](https://code.claude.com/docs/en/cli-reference) via
context7:

```bash
claude -p --max-turns 3 "query"
```

> "Restricts execution to a maximum number of agentic turns when running in print mode
> (-p). Exits with an error if the specified turn limit is exceeded."

E na documentação do Agent SDK: *"max_turns (which counts tool-use turns only) or
max_budget_usd to cap execution... making budget caps a recommended default for
production agents"*. O `loop-tasks.sh` não expõe `--max-turns`, e `--max-budget-usd`
está em `0`. **Teste:** rodar a task-1 com `--max-turns 30` e verificar se ela conclui;
se concluir, os 48 turnos tinham folga, e o limite vira instrumento de medição.

### 4.4 Code intelligence plugins — o lever mais promissor e não testado

Da documentação oficial de custos:

> "Code intelligence plugins give Claude precise symbol navigation instead of text-based
> search, reducing unnecessary file reads when exploring unfamiliar code. **A single 'go
> to definition' call replaces what might otherwise be a grep followed by reading
> multiple candidate files.** Installed language servers also report type errors
> automatically after edits, so Claude catches mistakes without running a compiler."

Ataca **turnos** diretamente, que é a variável dominante, e o Plus-SSO é C# — linguagem
tipada, exatamente o caso de uso. Nada disso foi testado. **Teste:** instalar o plugin
de C#, rodar a task-1, comparar `num_turns` e a contagem de `Read`/`Bash`.

### 4.5 Delegação a subagents, com critério

A documentação recomenda [isolar operações verbosas em subagents](https://code.claude.com/docs/en/sub-agents).
Um subagent custa um boot completo (~27,6k medidos na 0001 §2.3) mais os próprios
turnos, então só se paga quando **o input é grande, o output é pequeno e o input não
precisa voltar**. Pelos números da §2.1, executar teste **não** qualifica (12 linhas de
digest não pagam um boot). Candidato real: consultar documento-fonte quando o pacote não
cobre — hoje o `techspec.md` inteiro entra no contexto e fica até o fim da task.

### 4.6 Cuidado com a receita oficial de filtro de saída

A mesma página de custos traz um hook `PreToolUse` de exemplo:

```bash
filtered_cmd="$cmd 2>&1 | grep -A 5 -E '(FAIL|ERROR|error:)' | head -100"
```

Esse comando tem os três defeitos documentados no `dotnet-quiet.sh` do Plus-SSO: o regex
não casa `Program.cs(12,5): error CS0246:`; o pipeline faz o exit code virar o do `head`,
de modo que um build quebrado reporta sucesso; e `-A 5` trunca stack trace. **Se for
adotada, adotar com o exit code preservado** — e, pela §2.1, o ganho esperado é pequeno.

### 4.7 Documentação a consultar antes de cada experimento

Via context7 (`/websites/code_claude`) e páginas oficiais, sempre verificando a versão
corrente em vez de assumir:

- [Manage costs effectively](https://code.claude.com/docs/en/costs) — compactação,
  thinking/effort, `MAX_THINKING_TOKENS`, subagents, hooks, skills.
- [CLI reference](https://code.claude.com/docs/en/cli-reference) — `--max-turns`,
  `--max-budget-usd`.
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) —
  reenvio integral do contexto, TTL, escopo do cache.
- [Sub-agents](https://code.claude.com/docs/en/sub-agents) — isolamento de operações de
  alto volume.
- [Memory / CLAUDE.md](https://code.claude.com/docs/en/memory) — o limite de 200 linhas
  aplicável ao `AGENTS.md`.

**Nota de método.** Ao verificar os perfis de teste do mecanismo removido, a consulta ao
context7 invalidou 3 de 5 configurações escritas de memória: o logger `junit` do .NET
exige um pacote NuGet de terceiros (`trx` é nativo), o Jest documenta que *"reporter
options are not available via CLI"*, e o `surefire.reportsDirectory` aponta para
diretório, não arquivo. **Consultar a documentação antes de escrever configuração de
ferramenta não é formalidade.**

---

## 5. Critérios para o próximo experimento

Um experimento só conta se, antes de comparar tokens:

1. o piso de ruído estiver medido (§4.1);
2. as tasks estiverem resetadas com `resetar-tasks.sh`, não só no campo `Status`;
3. `sem_certificacao` for `false` no evento `end` — **`exit=0` não é evidência de
   trabalho feito**;
4. o modelo for o mesmo entre os braços (a comparação opus × sonnet da §2.4 não é limpa);
5. mais de uma task rodar, para amortizar o `pack_build`, que sozinho foi 43% do consumo
   num run de task única.

E o critério que veta os demais: **nenhuma regressão de correção**. Menos tokens com um
teste a menos passando é uma piora.
