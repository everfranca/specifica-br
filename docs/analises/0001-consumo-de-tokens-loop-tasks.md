# Análise 0001 — Esgotamento da janela de 5 horas em 3 tasks (`loop-tasks.sh`)

| Metadado | Valor |
|:---|:---|
| **Data da análise** | 25/08/2026 |
| **Caso** | Plus-SSO / feature `00001-credencial-de-aplicacao` |
| **Comando executado** | `./scripts/loop-tasks.sh specs/features/00001-credencial-de-aplicacao/ --tool claude --model opus --auto-approve` |
| **Log da execução** | `.specifica-br/logs/run_20260825_080114.jsonl` |
| **Ferramenta** | Claude Code CLI 2.1.245 |
| **Escopo** | Apenas Claude Code. OpenCode fica para outro momento. |

---

## 1. Resumo executivo

A execução consumiu a janela de 5 horas inteira (que estava zerada) em **3 tasks
concluídas e 1 interrompida**, num total de ~24 minutos de relógio.

O consumo **não foi causado pelo loop**. O loop está correto: cada task roda em
um processo novo, portanto em uma *context window* nova — e o log comprova isso
com um `session_id` distinto por task. O consumo foi causado pelo **tamanho do
contexto que cada task carrega**, multiplicado pelo **número de turnos** que o
agente gasta dentro dela.

O comando `/executar-task` obrigava o agente a importar PRD, Tech Spec e
`architecture.md` **integralmente** — ~67.500 tokens — antes de escrever a
primeira linha de código. Como o Claude Code reenvia todo o contexto a cada
requisição, e cada uso de ferramenta é uma requisição, esses 67.500 tokens são
pagos **uma vez por turno**, não uma vez por task. Em uma task de 8 minutos com
algumas dezenas de turnos, isso sozinho responde por milhões de tokens.

Somam-se a isso o modelo Opus com esforço padrão (tokens de *thinking* são
cobrados como saída), um `output_format` que mandava reimprimir o conteúdo
completo de cada arquivo já gravado em disco, e a ordem de regerar o arquivo da
task inteiro (~20 KB) ao final.

E, criticamente: **o script não media nada disso**. O log antigo tinha apenas
`task`, `session_id` e `ts`. Não havia como perceber o problema antes de a
janela acabar, nem havia trava de orçamento para interromper o loop.

---

## 2. Evidências

### 2.1 O que o log registrou

```
{"event":"start","task":"task-1.md","ts":"2026-08-25T08:01:14-03:00"}
{"event":"end","task":"task-1.md","session_id":"0d635d40-…","ts":"2026-08-25T08:09:13-03:00"}
{"event":"start","task":"task-2.md","ts":"2026-08-25T08:09:13-03:00"}
{"event":"end","task":"task-2.md","session_id":"55a65bba-…","ts":"2026-08-25T08:17:00-03:00"}
{"event":"start","task":"task-3.md","ts":"2026-08-25T08:17:00-03:00"}
{"event":"end","task":"task-3.md","session_id":"36919680-…","ts":"2026-08-25T08:25:14-03:00"}
{"event":"start","task":"task-4.md","ts":"2026-08-25T08:25:14-03:00"}
```

| Task | Duração | `session_id` |
|:---|:---|:---|
| task-1 | 7m59s | `0d635d40-…` |
| task-2 | 7m47s | `55a65bba-…` |
| task-3 | 8m14s | `36919680-…` |
| task-4 | — | **sem evento `end`** |

Três observações:

1. **Session ids distintos confirmam janelas de contexto distintas.** A premissa
   do script está correta; o problema é outro.
2. **`task-4` não tem evento `end`.** O processo foi interrompido sem devolver
   resultado — coerente com o esgotamento da janela de uso.
3. **Nenhum dado de consumo foi registrado.** Nem tokens, nem custo, nem número
   de turnos, nem modelo. Esta é a falha de instrumentação que impediu o
   diagnóstico em tempo de execução.

### 2.2 O volume de leitura obrigatória por task

Medido nos arquivos reais da feature (estimativa de ~3,5 caracteres por token,
apropriada para markdown em português):

| Arquivo | Bytes | Tokens (est.) |
|:---|---:|---:|
| `specs/core/architecture.md` | 90.385 | ~25.800 |
| `specs/features/…/techspec.md` | 73.349 | ~21.000 |
| `specs/features/…/prd.md` | 43.623 | ~12.500 |
| `specs/features/…/task-1.md` | 19.876 | ~5.700 |
| `AGENTS.md` | 9.032 | ~2.600 |
| **Total** | **236.265** | **~67.500** |

Os três primeiros arquivos eram de importação **obrigatória e integral** por
ordem explícita do comando `/executar-task` v0.3.0:

> `{{[Link PRD]}}` — VOCÊ DEVE OBRIGATORIAMENTE IMPORTAR TODO O CONTEUDO DO
> ARQUIVO PRD DA FEATURE E ADICIONAR EM SEU CONTEXTO.

### 2.3 O custo fixo de subir um processo

Medição direta feita para esta análise, com um prompt trivial (`"responda
apenas: ok"`), Sonnet, `--effort low`, em diretório vazio:

```json
"usage": { "input_tokens": 2, "output_tokens": 4,
           "cache_creation_input_tokens": 27632,
           "cache_read_input_tokens": 0 }
```

**27.632 tokens** só para inicializar o processo — system prompt, definições de
ferramentas, skills. Esse custo é pago **por task**, já que cada task é um
processo novo. Nove tasks = ~250.000 tokens só de boot, na melhor hipótese
(sem reaproveitamento de cache; ver §3.5).

---

## 3. Causas, em ordem de impacto

### 3.1 Amplificação de contexto por turno (causa dominante)

A documentação oficial é explícita:

> "Claude Code re-sends the full context: the system prompt, your project
> context, every prior message and tool result, and your new message."
> — *[How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)*

> "each time Claude uses tools it sends another request carrying that batch of
> tool results"
> — *[Manage costs effectively](https://code.claude.com/docs/en/costs)*

Cada chamada de ferramenta (ler arquivo, escrever arquivo, rodar `dotnet build`)
é uma requisição nova que carrega **todo o contexto acumulado**. O custo de uma
task não é `contexto`, é aproximadamente:

```
custo_da_task ≈ Σ (tamanho do contexto no turno i)  para i = 1..N
```

Com um piso de ~95.000 tokens de contexto (27,6k de boot + 67,5k de documentos)
e uma task de 8 minutos criando uma solution .NET com testes — facilmente 40 a
80 turnos — o resultado fica na casa de **5 a 8 milhões de tokens por task**.
Três tasks explicam a janela inteira.

O ponto que importa: **cada token colocado no contexto no início é pago N
vezes**, onde N é o número de turnos. Reduzir 67.500 tokens de leitura inicial
para ~10.000 não economiza 57.500 tokens — economiza `57.500 × N`.

Parte desse volume é cobrada como *cache read* (a ~10% da taxa de entrada), o
que reduz o custo em dólar, mas **continua contando contra os limites do plano**.

### 3.2 Importação integral de PRD, Tech Spec e architecture

Causa direta do piso de contexto descrito acima. O agravante é que a **seção 5.1
da própria task já indicava as seções exatas** a consultar:

```
- `specs/core/architecture.md` (secoes 2.1, 3.1, 3.2, 4.1, 8, 11 e 14)
```

O comando ignorava essa precisão e mandava importar tudo.

### 3.3 Opus com esforço padrão

O comando foi executado com `--model opus`, sem controle de esforço.

> "Thinking tokens are billed as output tokens, and the default budget can be
> tens of thousands of tokens per request."
> — *[Manage costs effectively](https://code.claude.com/docs/en/costs)*

Tokens de saída são os mais caros do orçamento. Dezenas de milhares de tokens de
*thinking* **por requisição**, multiplicados por dezenas de turnos, por três
tasks. A documentação recomenda diretamente:

> "Sonnet handles most coding tasks well and costs less than Opus. Reserve Opus
> for complex architectural decisions or multi-step reasoning."

Tasks de implementação geradas a partir de uma Tech Spec já decidida são
exatamente o caso em que a decisão arquitetural **já foi tomada** — o trabalho é
execução, não deliberação.

### 3.4 Formato de saída que duplica o trabalho em tokens de saída

O `output_format` v0.3.0 exigia:

```
## Arquivos de Código (Persistidos no Projeto)
 Para cada arquivo:
 Arquivo: caminho/do/arquivo.ext
 Conteúdo completo do arquivo
```

e, na seção `<critical>`:

```
- Gere o conteúdo COMPLETO do arquivo da task.
```

Ou seja: depois de gravar N arquivos em disco, o agente **reimprimia todos eles
na resposta**, e ainda regerava o arquivo da task (~20 KB, ~5.700 tokens) por
completo. Tudo isso em tokens de saída, sem produzir nenhuma informação que já
não estivesse no disco.

### 3.5 Perda de cache entre tasks sequenciais

Este é o ponto menos óbvio e está documentado:

> "Sequential sessions share the prefix only when the git status snapshot at
> startup matches, since the system prompt also captures branch and recent
> commits."
> — *[Cache scope](https://code.claude.com/docs/en/prompt-caching#cache-scope)*

Cada task **escreve arquivos**, portanto **altera o `git status`**. O snapshot
do `git status` entra no system prompt. Logo, a task seguinte tem um system
prompt diferente e **não aproveita nada do cache da task anterior** — paga os
~27.600 tokens de boot como *cache creation*, que é cobrado com prêmio sobre a
entrada normal.

O loop, por construção, garante a invalidação de cache a cada iteração.

### 3.6 Ausência de instrumentação e de trava de orçamento

O `--output-format json` já era usado, e o JSON de resultado **sempre trouxe**
`total_cost_usd`, `usage` e `modelUsage`. O script extraía dele apenas o
`session_id`, via `grep`, e **descartava o resto**.

Não havia teto de gasto (`--max-budget-usd`), nem contador acumulado, nem
detecção de erro: o loop seguiria disparando processos até a lista acabar,
mesmo depois de o limite de uso ter sido atingido.

---

## 4. Correções aplicadas

### 4.1 No comando `/executar-task` (v0.3.0 → v0.4.0)

Arquivo: `src/assets/boilerplate/commands/executar-task.md`

| # | Antes | Depois |
|:--|:---|:---|
| 1 | "IMPORTAR TODO O CONTEUDO" do PRD e da Tech Spec | **Leitura dirigida**: apenas as seções nomeadas nas seções 2.2 e 5.1 da task. Importação integral do PRD só como *fallback* quando um requisito citado não é localizável, com registro do motivo na seção 8. |
| 2 | `architecture.md` importado junto | Idem: apenas as seções nomeadas na seção 5.1. **Fallback obrigatório**: se a task citar Tech Spec ou `architecture.md` sem nomear seção, ou se a seção citada não existir, lê o arquivo inteiro e registra a referência imprecisa na seção 8. |
| 3 | Reimprimir o conteúdo completo de cada arquivo na resposta | Tabela `Arquivo \| Acao \| Evidencia`. Reimpressão **proibida** — o arquivo em disco é a evidência. |
| 4 | "Gere o conteúdo COMPLETO do arquivo da task" | Edição pontual das linhas alteradas. Regeração integral **proibida**. |
| 5 | — | Quatro novos *anti-patterns*: importação integral indevida, reimpressão de arquivos, regeração da task, e releitura **sem motivo** de arquivo inalterado (reler continua correto quando o arquivo mudou). |

Este é o conjunto de mudanças de maior alavancagem, porque ataca o multiplicador
`N` da §3.1 na sua base.

### 4.2 No script `scripts/loop-tasks.sh` (v1 → v2)

**Contabilidade de tokens (novos marcadores de log).** O resultado JSON passa a
ser parseado com `jq`, somando por `modelUsage` quando disponível (que inclui
subagents; `usage` sozinho os omite, conforme a documentação de *cost tracking*).
Cada task registra:

```json
{"event":"end","task":"task-1.md","tool":"claude",
 "model_solicitado":"sonnet","modelos_reportados":"claude-sonnet-5,claude-haiku-4-5-20251001",
 "effort":"medium","session_id":"…","subtype":"success","is_error":false,
 "num_turns":47,"duration_ms":…,"duration_api_ms":…,"wall_seconds":…,
 "input_tokens":…,"output_tokens":…,
 "cache_creation_input_tokens":…,"cache_read_input_tokens":…,
 "tokens_gastos_task":…,
 "tokens_gastos_acumulado_depois":…,"tokens_disponiveis_depois":…,
 "custo_task_usd":"…","custo_acumulado_usd":"…"}
```

E, no `start`, `tokens_gastos_acumulado_antes` e `tokens_disponiveis_antes`.

**Marcador de modelo e de ferramenta.** Impressos no cabeçalho e gravados no
evento `run_start` e em todo evento `start`/`end`. O campo
`modelos_reportados` vem do `modelUsage` e mostra o que foi **efetivamente**
usado — inclusive o Haiku que a CLI aciona para tarefas auxiliares —, não apenas
o que foi pedido.

**Trava de orçamento.** `--window-budget-tokens` define o teto total da execução;
o loop para **antes** de iniciar a task que o estouraria, registrando
`budget_exhausted`. `--max-budget-usd` repassa um teto por task para a própria
CLI.

**Detecção de limite de uso.** Se o resultado indica limite de plano atingido, o
loop registra `rate_limited` e **interrompe** — em vez de queimar o resto da
janela disparando processos que vão falhar.

**Otimização de cache entre processos.** Aplicada por padrão (desligável com
`--no-cache-tuning`):

- `--exclude-dynamic-system-prompt-sections` move `cwd`, plataforma e o snapshot
  do `git status` do system prompt para a primeira mensagem de usuário. É a
  correção direta da §3.5: o system prompt passa a ser **idêntico** entre as
  tasks, e o prefixo cacheado é reaproveitado de uma para a outra.
- `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` mantém o cache vivo através dos ~8 minutos
  de intervalo entre tasks (relevante sobretudo quando a conta passa a consumir
  créditos, situação em que o padrão cai para 5 minutos).

**Padrões mais conservadores.** `--model sonnet` e `--effort medium` passam a ser
o default; Opus continua disponível, mas por escolha explícita.

**Outros.** `--fallback-model`, `--stop-on-failure`, `--sleep`, `set -uo pipefail`
(sem `-e`, para que uma task com erro não derrube o loop antes de o log ser
gravado) e resumo final com totais.

---

## 5. Limitação conhecida: tokens disponíveis no plano

O critério pedia registrar "a quantidade de tokens disponíveis antes e depois da
task". **A CLI do Claude Code não expõe o saldo restante da janela de 5 horas de
forma programática.** O `/usage` é um comando de terminal interativo, não há
subcomando `claude usage`, e a documentação registra que os números do `/usage`
são calculados a partir do histórico local da máquina.

O que o script v2 faz, no lugar:

- mede com precisão **quanto cada task consumiu** (`tokens_gastos_task`), a
  partir do dado que a própria API devolve;
- mantém o **acumulado da execução** (`tokens_gastos_acumulado_*`);
- expressa "disponível" **em relação a um teto que você define** com
  `--window-budget-tokens` (`tokens_disponiveis_antes` / `_depois`).

Na prática isso é mais útil do que o saldo do plano: com duas ou três execuções
medidas, você calibra o teto e o loop passa a parar sozinho antes de esgotar a
janela. Enquanto `--window-budget-tokens` não for informado, os campos
`tokens_disponiveis_*` vêm como `null` — e não como um número inventado.

---

## 6. Como operar daqui em diante

```bash
# 1) Sempre comece medindo, com orçamento apertado e modelo barato.
./scripts/loop-tasks.sh specs/features/minha-feature \
  --auto-approve --model sonnet --effort medium \
  --window-budget-tokens 5000000 --stop-on-failure

# 2) Leia o consumo real por task.
jq -r 'select(.event=="end")
  | [.task, .model_solicitado, .num_turns, .tokens_gastos_task, .custo_task_usd]
  | @tsv' .specifica-br/logs/run_*.jsonl

# 3) Calibre o teto e siga.
```

Recomendações operacionais:

1. **Sonnet como padrão** para tasks de implementação. Opus só quando a task
   envolve decisão arquitetural de fato.
2. **Rode em branch limpo.** Além de facilitar o `git diff`, reduz o ruído no
   snapshot de `git status`.
3. **Fatie tasks grandes.** Uma task de 8 minutos é uma task com muitos turnos, e
   turnos são o multiplicador do custo.
4. **Emagreça a Tech Spec e o `architecture.md`.** 90 KB de architecture é muito
   documento para carregar em toda execução. Com leitura dirigida o impacto cai,
   mas a raiz permanece.
5. **Não rode o loop com a janela já parcialmente consumida** sem ajustar o teto.

---

## 7. Referências

Documentação oficial da Anthropic consultada nesta análise:

- [Manage costs effectively](https://code.claude.com/docs/en/costs) — redução de
  consumo, escolha de modelo, esforço/thinking, por que o consumo cresce em
  sessões longas.
- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)
  — reenvio integral do contexto, camadas do prefixo, invalidação, TTL, escopo do
  cache (incluindo o efeito do `git status`).
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) —
  `-p`, `--output-format json`, `--permission-mode`, `--bare`.
- [Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
  — campos `usage`, `modelUsage`, `total_cost_usd`; por que `modelUsage` é a
  fonte correta quando há subagents.
- [Modifying system prompts](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
  — *improve prompt caching across users and machines* e a flag
  `--exclude-dynamic-system-prompt-sections`.

---

## 8. Acompanhamento — Contexto de Execução (v3 do script)

As correções das §4.1 e §4.2 reduzem o piso de contexto, mas ainda dependem de o
agente **escolher bem** o que ler de 236 KB de documentos, a cada task. A v3
ataca a raiz: o agente deixa de escolher e passa a receber um destilado pronto.

**O mecanismo.** Antes do loop, uma chamada de IA lê PRD + Tech Spec +
`architecture.md` e escreve `specs/features/<f>/contexto-execucao.md` — ~4k
tokens contendo as **invariantes copiadas literalmente** da fonte (contratos,
schemas, códigos de erro, versões, regras proibitivas, fronteiras de camada) e um
**mapa** `assunto → arquivo seção` para o restante. O pacote é injetado no system
prompt de todas as tasks do run via `--append-system-prompt-file`.

**Por que literal e não resumo.** Um resumo escreveria `^[a-z0-9]{1,128}$` como
"letras minúsculas e dígitos, até 128 caracteres": perde as âncoras, perde o
`{1,`, não diz que hífen é recusado. O código sai errado e o teste sai errado
junto, porque os dois nascem da mesma frase. Por isso o que vira código é
copiado, e o que é contexto explicativo vira ponteiro.

**Por que isso interage com o cache.** Combinado ao
`--exclude-dynamic-system-prompt-sections` da §4.2, o system prompt fica
`[preset estático][pacote]` — idêntico do começo ao fim da execução. É a condição
que a documentação exige para que processos sequenciais reaproveitem o prefixo
cacheado, e que a §3.5 identificou como quebrada pelo snapshot do `git status`.

**Deriva.** Entre as tasks, o script compara o `mtime` dos documentos-fonte com o
do pacote e o reconstrói se algum mudou. O caso concreto é a task de
sincronização CORE da v1.7.0, que edita `architecture.md` no meio do run.

**Precedência.** O documento-fonte vence o pacote, sempre. O pacote é derivado; a
fonte é a verdade.

### 8.1 O que a primeira geração revelou

Teste na feature `prompt-yn-atualizacao` deste repositório (fontes: 37,9 KB;
pacote: 12,5 KB ≈ 3,6k tokens; 10 turnos; US$ 0,33):

- **A seção "Lacunas conhecidas" encontrou duas contradições reais** entre PRD e
  Tech Spec que ninguém tinha notado: o comando executado ao aceitar a
  atualização (`specifica-br upgrade` no PRD vs. reuso de `executeUpdate()` na
  Tech Spec) e o número máximo de tentativas de retry (2 na seção 5.1 vs. 3 na
  5.2 da mesma Tech Spec). Efeito colateral não previsto: o processo de
  destilação funciona como uma checagem de consistência entre os documentos.
- **Defeito corrigido:** a primeira versão do gerador colocou passo a passo de
  implementação e números de linha (`middleware.ts:284-344`) na seção de
  invariantes. Referência de linha envelhece no primeiro commit e o executor
  passa a confiar em ponteiro morto. O `prompt.md` v0.2.0 proíbe as duas coisas.

### 8.2 Primeira execução real com o mecanismo

Run `run_20260825_182536.jsonl`, feature `00001-credencial-de-aplicacao`,
`--model opus --effort medium --window-budget-tokens 20000000`.

| Etapa | Turnos | Tokens | Custo | Resultado |
|:---|---:|---:|---:|:---|
| `pack_build` | 15 | 1.045.396 | US$ 2,15 | pacote de 25.830 B (~7.400 tokens) |
| task-1 | 68 | 2.513.292 | US$ 3,48 | `success` |
| task-2 | 27 | 745.276 | US$ 1,36 | interrompida por limite de uso |
| **Total** | | **4.303.964** | **US$ 7,00** | |

**A compactação funcionou, e é mensurável.** O indicador é
`cache_read ÷ num_turns`, que dá o tamanho médio do contexto reenviado por turno:

- task-1: 2.347.752 / 68 = **~34.500 tokens por turno**

Antes, o piso era ~27,6k de boot mais ~67,5k de documentos, **~95k por turno**.
Agora é boot mais pacote (~7,4k), ~35k — e o medido bate. Isso confirma de uma
vez que o pacote entrou no prefixo e que o prefixo foi servido de cache em
praticamente todos os 68 turnos. **Redução de ~2,7x no piso de contexto.**

**Por que a execução parou mesmo assim.** Opus a US$ 3,48 por task, 68 turnos na
task-1, e um saldo de janela desconhecido no início — este run não partiu de
janela zerada como o de 08:00, então os totais não são comparáveis entre os dois.
Só o número por turno é, e esse melhorou.

**Dois defeitos que a execução expôs, ambos corrigidos na v3.1 do script:**

1. **A construção do pacote herdava `--model`/`--effort` do run.** Com Opus,
   custou US$ 2,15 e 1,05M de tokens — **31% do custo do run inteiro** — para 15
   turnos de extração literal, que é trabalho mecânico. Agora tem modelo próprio:
   `--pack-model` (default `sonnet`) e `--pack-effort` (default `low`).
2. **O pacote estourou o teto declarado no prompt (7.400 contra 6.000 tokens) e
   não registrou o excesso**, como a própria instrução mandava. O conteúdo era
   legítimo — cinco contratos com schemas e políticas de resiliência, pouca
   gordura —, então a correção não foi comprimir mais, e sim: teto proporcional
   ao número de contratos (`3.500 + 1.200 por contrato`), declaração obrigatória
   de tamanho na seção 0, e **verificação feita pelo script**, que mede o arquivo
   e compara com `--pack-max-tokens`. A lição vale além deste caso: **não delegue
   ao gerador a fiscalização do próprio limite.**

**O que a execução também revelou, e não era sobre tokens.** A seção "Lacunas
conhecidas" do pacote apontou sete inconsistências entre PRD, Tech Spec e
`architecture.md`. Duas atingem a task-1 diretamente: o enum grafado `ErrorCode`
em `techspec.md` §2.2 e `ErrorCodes` em `architecture.md` §5.1, e a contagem de
códigos estáveis, que diz "dez" na §8 da Tech Spec e "nove" na Nota de Decisão 4
do mesmo documento. São ambiguidades que produziriam código errado
silenciosamente.

### 8.3 O que ainda não foi atacado

O piso de contexto caiu, mas **o número de turnos não**. Com 68 turnos a
task-1 gasta 68 × 34,5k = 2,35M tokens mesmo com o contexto enxuto. Nenhuma
técnica de engenharia de contexto resolve isso — o que resolve é granularidade
de task. A task-1 do Plus-SSO cria a solution, oito projetos, value objects e
testes: é grande demais para uma iteração.

Duas alavancas ainda disponíveis:

- **`--max-budget-usd`** por task, hoje em `0`. Um teto de US$ 2 teria encerrado
  a task-1 antes dos US$ 3,48.
- **Delegar operações verbosas a subagents.** Saída de `dotnet build` e de testes
  fica hoje no contexto principal e é reenviada em todos os turnos seguintes. A
  documentação recomenda isolá-las para que só o resumo retorne.

### 8.4 Medição A/B pendente

O ganho por turno está medido (§8.2), mas a **comparação A/B direta** — mesma
feature, mesmo estado inicial, com e sem o pacote — ainda não foi feita. A
receita está em `scripts/README.md` (seção "Comparação A/B"):
rodar a mesma feature duas vezes do mesmo estado inicial, uma com
`--no-context-pack` e outra sem, e comparar `tokens_gastos_task` e
`cache_creation_input_tokens` por task.

Critério de sucesso: consumo por task consistentemente menor da task 2 em diante,
`cache_creation_input_tokens` em queda acentuada a partir da task 2 (evidência de
prefixo reaproveitado entre processos), e custo somado dos `pack_build` menor que
a economia agregada. **Se o terceiro critério não se sustentar, o mecanismo não
se paga e deve ser removido** — é o que `--no-context-pack` existe para permitir
decidir com dado, não com intuição.
