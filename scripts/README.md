# scripts/loop-tasks.sh — execução de tasks em loop (v4.2, Claude Code)

Executa **cada task de uma feature em loop, uma por _context window_ nova**, com
log que evidencia isso, **contabilidade de tokens por task** e um **Contexto de
Execução** compactado compartilhado entre as tasks.

Não é (ainda) um comando do `specifica-br`. É um script de validação.

> **Leia antes de rodar:** [`docs/analises/0001-consumo-de-tokens-loop-tasks.md`](../docs/analises/0001-consumo-de-tokens-loop-tasks.md)
> — a análise do caso em que uma execução com `--model opus` esgotou a janela de
> 5 horas em 3 tasks, e as correções que originaram as versões seguintes.

## Como funciona

- Lê os arquivos `task-*.md` da feature e os **ordena por número** (natural
  sort): `task-2` vem antes de `task-10`; `task-1` e `task-01` são tratados
  igual.
- **Antes do loop**, constrói o [Contexto de Execução](#contexto-de-execução-alfa)
  da feature — um destilado de PRD + Tech Spec + `architecture.md`.
- Para **cada** task, dispara **um processo novo** de `claude -p`, rodando o
  comando `/executar-task`, com o Contexto de Execução injetado no system
  prompt. Processo novo = **context window nova**, garantido pelo sistema
  operacional.
- **Entre as tasks**, verifica se algum documento-fonte ficou mais novo que o
  pacote e, se ficou, o reconstrói antes de seguir.
- Registra `run_start`, `pack_build`, `pack_build_failed`, `start`, `end`,
  `skip`, `budget_exhausted`, `rate_limited` e `run_end` em
  `.specifica-br/logs/run_<timestamp>.jsonl`.
- Pula tasks já marcadas como `DONE`, então dá para **re-rodar e continuar de
  onde parou**.
- **Para o loop** ao estourar o orçamento de tokens ou ao detectar limite de uso
  do plano.
- **Reaproveita o pacote** ao retomar uma execução interrompida: só reconstrói se
  ele faltar ou se um documento-fonte tiver mudado (evento `pack_reused`).

### A evidência de "janela nova por task"

Cada processo da CLI recebe um `session_id` próprio. **Session ids distintos por
task = janelas de contexto distintas.** É um fato observável emitido pela
ferramenta, não uma afirmação do modelo sobre si mesmo.

## Contexto de Execução (alfa)

O custo de uma task é aproximadamente a soma do tamanho do contexto em **cada
turno** do agente. Todo token carregado no turno 1 é pago N vezes. No caso que
originou este trabalho, PRD + Tech Spec + `architecture.md` somavam ~60k tokens
carregados no início de **cada** task.

O Contexto de Execução é um arquivo de ~4k tokens que as tasks leem no lugar
desses documentos.

**O que tem dentro.** Duas partes:

1. **Invariantes**, copiadas **caractere a caractere** da fonte: contratos,
   schemas, códigos de erro, versões de biblioteca, regras proibitivas,
   fronteiras de camada. Nada de paráfrase — a regra existe porque um
   `^[a-z0-9]{1,128}$` reescrito como *"letras minúsculas e dígitos"* perde as
   âncoras, perde o `{1,` e não diz que hífen é recusado. Quem implementa a
   partir da frase escreve o código errado **e o teste errado junto**, porque os
   dois saem da mesma frase.
2. **Mapa de consulta**, `assunto → arquivo seção`, para tudo que não virou
   invariante. O executor abre a fonte só quando o mapa aponta — é a válvula de
   segurança que evita escrever código contra um resumo.

Há ainda uma seção de **lacunas conhecidas**: o que o gerador não conseguiu
extrair com confiança, e que o executor deve buscar na fonte obrigatoriamente.
Na prática esta seção rende mais do que parece: na primeira execução real ela
apontou sete inconsistências entre PRD, Tech Spec e `architecture.md` que
ninguém tinha notado — entre elas um enum grafado `ErrorCode` num documento e
`ErrorCodes` em outro, e uma contagem de códigos de erro que dizia "nove" num
lugar e "dez" em outro. Destilar obriga a ler as fontes lado a lado, e isso
funciona como checagem de consistência.

**Tamanho.** O orçamento escala com o número de contratos:
`alvo = 3.500 + 1.200 por contrato`, teto `alvo x 1,3`. O gerador declara o
resultado na linha `Tamanho` da seção 0 — mas **quem decide é o script**, que
mede o arquivo e compara com `--pack-max-tokens`. Essa desconfiança é
deliberada: na primeira execução real o gerador estourou o limite declarado no
prompt e não registrou o excesso. O pacote entra no system prompt de **toda**
task, então cada token excedente é pago uma vez por task.

**Onde cai.** `specs/features/<feature>/contexto-execucao.md`, versionável junto
com a feature.

**Precedência.** O documento-fonte **vence o pacote, sempre**. O pacote é
derivado; a fonte é a verdade. O `/executar-task` registra na seção 8 da task se
usou o pacote e quais fontes precisou abrir mesmo assim.

**O que ele não é.** Não é comando do `specifica-br`, não aparece no `help`, não
vai para `specs/templates/`. É **alfa** e pode sair sem aviso. A instrução de
geração e a estrutura do artefato vivem em `scripts/context-pack/`, ao lado
deste script — ambas em markdown agnóstico de ferramenta.

**Não edite o pacote à mão.** Ele é derivado e a próxima execução o sobrescreve.
Correção de conteúdo se faz no documento-fonte.

## Pré-requisitos

- `claude` (Claude Code) instalado e autenticado.
- `jq` — obrigatório para a contabilidade de tokens.
- `scripts/context-pack/` (`prompt.md` e `template.md`) presente ao lado do
  script. **Ausente, o loop avisa e roda sem Contexto de Execução** — é o caso
  de cópias antigas do script em outros projetos.
- A feature já inicializada com o boilerplate do specifica-br.
- Rodar a partir da **raiz do projeto**.

> OpenCode saiu desta versão. O foco é Claude Code; o suporte a outras
> ferramentas volta quando a mecânica de contabilidade estiver estabilizada.

## Uso

```bash
# 0) Verifique o acesso primeiro: 3 segundos, zero token.
./scripts/loop-tasks.sh specs/features/minha-feature --preflight --auto-approve

# 1) Depois o dry-run: mostra ordem, loop e log, sem gastar tokens.
./scripts/loop-tasks.sh specs/features/minha-feature --dry-run

# 2) Primeira execução real: modelo barato e orçamento apertado, para MEDIR.
./scripts/loop-tasks.sh specs/features/minha-feature \
  --auto-approve --model sonnet --effort medium \
  --window-budget-tokens 5000000 --stop-on-failure

# 3) Depois de calibrado, ajuste o teto (e o modelo, se realmente precisar).
./scripts/loop-tasks.sh specs/features/minha-feature \
  --auto-approve --model opus --effort medium \
  --window-budget-tokens 20000000 --fallback-model sonnet
```

## Opções

| Flag | Descrição | Default |
|:--|:--|:--|
| `<feature-dir>` | Diretório da feature (1º argumento, obrigatório) | — |
| `--tool` | Apenas `claude` nesta versão | `claude` |
| `--model` | `sonnet`, `opus`, … | `sonnet` |
| `--effort` | `low`\|`medium`\|`high`\|`xhigh`\|`max`. Tokens de *thinking* são cobrados como saída | `medium` |
| `--fallback-model` | Modelo alternativo quando o primário está indisponível | nenhum |
| `--auto-approve` | **Acesso total** para as tasks: Read, Write, Bash, Skill e MCP, sem prompt (`--permission-mode bypassPermissions`) | desligado |
| `--permission-mode` | Sobrescreve o modo acima quando você quer menos que acesso total: `acceptEdits`, `auto`, `dontAsk`, `manual` | conforme `--auto-approve` |
| `--no-skill-dirs` | Não libera `~/.claude/skills` e `.claude/skills` via `--add-dir` | libera |
| `--max-budget-usd` | Teto de gasto **por task**, aplicado pela própria CLI | `0` (sem teto) |
| `--window-budget-tokens` | Teto de tokens **da execução inteira**. O loop para antes de estourar | `0` (sem teto) |
| `--stop-on-failure` | Interrompe na primeira task com erro | desligado |
| `--sleep` | Pausa em segundos entre tasks | `0` |
| `--no-cache-tuning` | Desliga as otimizações de cache entre processos | ligado |
| `--no-context-pack` | Desliga o Contexto de Execução. **É a chave do A/B**: rode duas vezes o mesmo estado inicial, com e sem, e compare os logs | ligado |
| `--pack-model` | Modelo da **construção** do pacote. Extração literal é trabalho mecânico e não paga o prêmio de um modelo de raciocínio | `sonnet` |
| `--pack-effort` | Esforço da construção do pacote | `low` |
| `--pack-max-tokens` | Teto de tamanho do pacote. Acima disso o script avisa e marca `pack_over_ceiling` no log; não aborta | `8000` |
| `--allow` | Libera um comando de shell específico (repetível). Desnecessário com acesso total; útil junto de `--permission-mode acceptEdits` | nenhum |
| `--tasks` | Executa apenas as tasks selecionadas: `1,2,5`, `1-3` ou `1-3,7,9-10`. Omitido, executa todas — ver [Execução parcial](#execução-parcial) | todas |
| `--preflight` | Roda só as verificações de acesso, imprime, grava no log e sai. Exit 1 se houver ERRO — ver [Preflight](#preflight) | desligado |
| `--skip-preflight` | Pula as verificações (escape hatch) | verifica |
| `--require-cmd` | Exige um comando no PATH, ex.: `dotnet` (repetível) | nenhum |
| `--mcp-timeout` | Timeout, em segundos, da verificação de MCP no preflight | `15` |
| `--no-mcp-check` | Não verifica MCPs no preflight | verifica |
| `--dry-run` | Não executa nada; só mostra ordem/loop/log | desligado |

> A construção do pacote usa `--permission-mode acceptEdits` mesmo sem
> `--auto-approve`, porque escreve exatamente um arquivo: o próprio
> `contexto-execucao.md`. Use `--no-context-pack` se não quiser essa escrita.

> **A construção usa modelo próprio, e por um motivo medido.** Na primeira
> execução real ela herdava `--model`/`--effort` do run: com Opus, custou
> US$ 2,15 e 1,05M de tokens — **31% do custo do run inteiro** — para 15 turnos
> de um trabalho puramente mecânico. Destilar é extração literal, não
> deliberação. Se quiser comparar, force `--pack-model opus` uma vez e olhe o
> `custo_usd` do evento `pack_build`.

## Execução parcial

`--tasks` filtra quais tasks entram no loop. **Omitida, nada muda:** o script
executa todas as pendentes, como sempre fez.

| Entrada | Executa |
|:---|:---|
| `--tasks 1,2,5` | tasks 1, 2 e 5 |
| `--tasks 1-3` | tasks 1, 2 e 3 |
| `--tasks 1-3,7,9-10` | intervalos e avulsos misturados |
| *(omitido)* | todas |

Os números são os do nome do arquivo, com a mesma regra do resto do script:
`task-1.md` e `task-01.md` são ambos `1`.

```bash
# Retomar depois de um limite de uso, sem refazer o que já rodou
./scripts/loop-tasks.sh specs/features/minha-feature --auto-approve --tasks 6-10

# Validar uma task isolada, sem gastar nada
./scripts/loop-tasks.sh specs/features/minha-feature --tasks 3 --dry-run
```

**A ordem é sempre numérica, nunca a digitada.** `--tasks 5,1` executa a 1 e
depois a 5. As tasks dependem umas das outras por convenção (número menor
primeiro), e permitir inverter isso por acidente criaria uma falha difícil de
diagnosticar.

**Erros abortam antes de qualquer chamada de IA** — falhar agora é barato,
falhar depois da construção do pacote não é. Seleção malformada (`abc`, `1-`),
intervalo invertido (`5-2`), número sem arquivo (`99`, que lista os disponíveis)
e `--tasks ""` param a execução com mensagem própria. Duplicatas colapsam em
silêncio: `1,1,2-3` é `1,2,3`.

### `DONE` vence a seleção

Selecionar é **filtrar**, nunca autorizar a refazer. Uma task selecionada que já
está `DONE` é pulada — mas com aviso próprio, para a ausência de execução não ser
confundida com execução:

```
  skip (DONE): task-3.md
  !! 3 foi SELECIONADA mas ja esta DONE - nao foi executada.
     Para reexecutar de proposito, altere o Status no arquivo da task.
```

O evento `skip` no log carrega `selecionada: true` nesse caso.

### Como saber de onde retomar

O `Status` do arquivo é a **autoridade**; o log é só histórico. Compare os dois:

```bash
# O que está certificado (autoridade)
grep -l '^| \*\*Status\*\* | DONE' specs/features/<f>/task-*.md

# O que rodou sem erro alguma vez (histórico)
jq -r 'select(.event=="end" and .is_error==false)|.task' \
  .specifica-br/logs/run_*.jsonl | sort -u
```

**Divergência entre as duas listas é sinal de problema**, e o script avisa
sozinho no início da execução:

```
!! ATENCAO: 5 task(s) concluiram sem erro em execucoes anteriores mas NAO estao DONE:
   task-1.md task-2.md task-3.md task-4.md task-5.md
   Serao REEXECUTADAS agora: task-1.md task-2.md task-3.md
   Fora desta selecao (seguem sem certificacao): task-4.md task-5.md
   Causa tipica: permissao negada impediu a validacao
```

**Esse aviso não pula nada, de propósito.** Numa execução real cinco tasks
terminaram com `subtype: success`, escreveram 21 arquivos e não compilaram uma
linha — o `dotnet build` estava bloqueado por permissão e o protocolo
corretamente se recusou a certificar sem evidência. **"Success" da CLI não
significa trabalho validado.** Pular com base no log reintroduziria exatamente o
erro que este aviso existe para tornar visível.

## Preflight

Toda verificação de acesso roda **antes da primeira chamada de IA**. Uma falha de
configuração deve custar 3 segundos, não 3 milhões de tokens — que foi
literalmente o preço pago três vezes antes disto existir.

### O que é verificado

| Grupo | Item | Severidade |
|:---|:---|:---|
| **A** Ambiente | `claude`, `jq`, `bc` | ERRO |
| | `column` (o bloco de evidências tem fallback) | AVISO |
| **B** Instalação | comando `executar-task` em `.claude/commands` ou `~/.claude/commands` | **ERRO** |
| | `scripts/context-pack/` completo, quando o pacote está ligado | AVISO |
| **C** Permissões | modo de permissão efetivo definido | **ERRO** |
| | `.claude/settings.json` e `settings.local.json` são JSON válido | **ERRO** |
| | `command` de cada hook existe e é executável | AVISO |
| | skill GLOBAL declarada com `--no-skill-dirs` ligado | ERRO |
| **D** Feature | `.specifica-br/logs` gravável | ERRO |
| | cada task **selecionada** legível **e gravável** | **ERRO** |
| | `tasks.md` gravável | ERRO |
| | `prd.md`, `techspec.md`, `architecture.md` legíveis | AVISO |
| **E** Skills/MCPs | skill da seção 9 existe em `~/.claude/skills` ou `.claude/skills` | AVISO |
| | MCP da seção 9 aparece como `Connected` | AVISO |
| **F** Escrita | alvo da seção 5.2 fora do projeto (exigiria `--add-dir`) | AVISO |
| **G** Build | comando exigido por `--require-cmd` | ERRO |

Três merecem destaque, porque falham **em silêncio**:

- **Comando `executar-task` ausente.** Sem ele, `/executar-task <path>` é enviado
  como **texto literal**: a task roda, gasta tokens e não implementa nada.
- **`settings.json` malformado.** A documentação diz que em modo `-p` um settings
  inválido é *silenciosamente ignorado* — suas permissões e hooks somem sem aviso.
- **`bc` ausente.** Sustenta a soma de custo em `acumular()`. Sem ele o custo
  acumulado quebra e o loop segue reportando números errados.

### A verificação de MCP

É a única etapa do preflight que sai da máquina: uma chamada a `claude mcp list`,
reaproveitada para todos os MCPs declarados. Controle com `--mcp-timeout`
(padrão 15s) ou desligue com `--no-mcp-check`.

Ela é blindada contra travamento, por um motivo aprendido na prática — **uma
execução ficou 15 minutos parada apesar do `timeout`**:

- a saída vai para um **arquivo**, nunca para `$(...)`. Numa substituição de
  comando o shell bloqueia até o *pipe* fechar, e servidores MCP lançados via
  `npx` deixam processos-neto que herdam esse pipe: o `timeout` matava o
  `claude` e o shell seguia esperando os netos, indefinidamente;
- `</dev/null`, porque `claude mcp list` pode ficar aguardando algo no stdin do
  terminal, sem nada visível na tela;
- `SIGKILL` após o `SIGTERM`, caso o processo ignore o primeiro sinal;
- saída **parcial é descartada**: um timeout no meio do health check deixa só o
  cabeçalho no arquivo, e tratar isso como resposta faria todo MCP aparecer como
  "não configurado" — diagnóstico errado é pior que nenhum.

### As duas severidades

**ERRO aborta antes de gastar token. AVISO registra e segue.**

O critério do AVISO vem do próprio protocolo do `/executar-task`, que é
explícito: *"É PROIBIDO abortar a execução por indisponibilidade de item"*. Skill
ausente e MCP fora do ar são coisas que o agente sabe contornar; falta de
permissão e task não-gravável não são.

Em `--dry-run` e `--preflight` um ERRO **não interrompe**: os dois são
diagnósticos, e ver a lista completa de problemas de uma vez vale mais que parar
no primeiro. O exit code final reflete o resultado, para uso em CI.

### Saída

`--preflight` mostra **todos** os itens, inclusive os OK — o valor ali é ver o
que foi verificado. Numa execução normal só os problemas aparecem.

```
== PREFLIGHT ==
  [OK   ] comando executar-task: /home/voce/.claude/commands
  [OK   ] permissoes: bypassPermissions (Read/Write/Bash/Skill/MCP)
  [OK   ] .claude/settings.json: JSON valido
  [OK   ] tasks selecionadas: 4 legivel(is) e gravavel(is)
  [OK   ] skill:aws-auth: global, diretorio liberado
  [OK   ] mcp:context7: conectado

  0 aviso(s), 0 erro(s)
```

Reprovando numa execução real:

```
  [ERRO ] permissoes: nenhuma - toda escrita e todo Bash seriam negados. Use --auto-approve

  0 aviso(s), 1 erro(s)

ABORTADO antes de gastar tokens.
Corrija os itens acima ou use --skip-preflight (nao recomendado).
```

### No log

O evento `preflight` grava **todos** os itens, inclusive os OK, para que o log
sirva de retrato da configuração daquela execução:

```bash
# Só o que não passou, em todas as execuções
jq -r 'select(.event=="preflight")|.itens[]|select(.severidade!="OK")
  |[.grupo,.item,.severidade,.mensagem]|@tsv' .specifica-br/logs/run_*.jsonl

# Contagem por execução
jq -c 'select(.event=="preflight")|{erros,avisos}' .specifica-br/logs/run_*.jsonl
```

## Otimização de cache (ligada por padrão)

Cada task é um processo novo, mas processos sequenciais **só** reaproveitam o
prefixo cacheado se o system prompt for **idêntico**. Duas coisas quebram isso, e
o script trata as duas:

- `--exclude-dynamic-system-prompt-sections` move `cwd`, plataforma e o snapshot
  do `git status` para a primeira mensagem de usuário. Sem isso, cada task que
  escreve arquivos muda o `git status`, muda o system prompt e **invalida o cache
  da task seguinte**.
- `--append-system-prompt-file` coloca o Contexto de Execução no system prompt,
  no mesmo lugar em todas as tasks do run.

Combinadas, o prefixo fica `[preset estático][pacote]` — igual do começo ao fim
da execução. **Uma sozinha não entrega o efeito:** sem a primeira, o `git status`
quebra o prefixo; sem a segunda, não há o que compartilhar além do preset.

Ainda: `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` mantém o cache vivo através do intervalo
entre tasks (relevante sobretudo quando a conta passa a consumir créditos, em que
o padrão cai para 5 minutos).

Use `--no-cache-tuning` para desligar as duas primeiras e comparar o efeito.

## Ler o log depois

```bash
# Consumo por task
jq -r 'select(.event=="end")
  | [.task, .model_solicitado, .num_turns, .tokens_gastos_task,
     .usou_contexto_execucao, .custo_task_usd] | @tsv' \
  .specifica-br/logs/run_*.jsonl

# Onde os tokens foram: entrada, saída, escrita e leitura de cache
jq -r 'select(.event=="end")
  | [.task, .input_tokens, .output_tokens,
     .cache_creation_input_tokens, .cache_read_input_tokens] | @tsv' \
  .specifica-br/logs/run_*.jsonl

# Custo e tamanho de cada construção do Contexto de Execução
jq -r 'select(.event|startswith("pack_build"))
  | [.event, .motivo, .pack_model, .est_tokens_pack, .pack_over_ceiling,
     .tokens_gastos, .custo_usd] | @tsv' .specifica-br/logs/run_*.jsonl

# Total da execução
jq -r 'select(.event=="run_end")' .specifica-br/logs/run_*.jsonl
```

### Comparação A/B

Rode a mesma feature duas vezes do mesmo estado inicial — uma com
`--no-context-pack`, outra sem — e compare:

```bash
for f in run_SEM.jsonl run_COM.jsonl; do
  echo "== $f"
  jq -r 'select(.event=="end")
    | [.task, .num_turns, .cache_creation_input_tokens,
       .cache_read_input_tokens, .tokens_gastos_task] | @tsv' \
    ".specifica-br/logs/$f"
  jq -r 'select(.event=="run_end") | "TOTAL \(.tokens_gastos_total) \(.custo_total_usd)"' \
    ".specifica-br/logs/$f"
done
```

O que procurar:

- `tokens_gastos_task` menor de forma **consistente da task 2 em diante**;
- `cache_creation_input_tokens` caindo bastante da task 2 em diante — é a
  evidência de que o prefixo foi reaproveitado **entre processos**;
- o custo somado dos `pack_build` menor que a economia agregada. Se não for, o
  mecanismo não se paga nessa feature.

Uma proporção alta de `cache_read` sobre `cache_creation` indica que o cache está
funcionando. Se `cache_creation` continua alto task após task, algo está mudando
no prefixo — ver §3.5 da análise.

## ⚠️ Permissões: `--auto-approve` dá acesso total

**A partir da v4.0**, `--auto-approve` usa `--permission-mode bypassPermissions`:
Read, Write, Bash, Skill e MCP, sem nenhum prompt. Uma task de implementação
precisa de tudo isso, e conceder menos não a torna mais segura — apenas a torna
incapaz de se validar.

**Por que mudou.** Até a v3.3 a flag usava `acceptEdits`, que autoriza somente
escrita de arquivo. Execuções reais falharam por isso, com quatro classes de
negação distintas:

| Negado | Causa |
|:---|:---|
| `Bash` | `dotnet build` e até `sed -n '/### 6.1/,/### 6.2/p' techspec.md` — leitura pura, barrada por ser comando composto |
| `Skill` | A ferramenta `Skill` não é coberta por `acceptEdits` |
| `mcp__context7__query-docs` | Ferramentas MCP exigem permissão explícita |
| `Read` | Leitura de `~/.claude/skills/aws-auth/references/…`, **fora do diretório do projeto** |

**Por que é traiçoeiro em modo headless:** uma permissão negada **não gera erro**.
A CLI devolve a recusa ao agente e a execução continua. Numa das execuções, cinco
tasks escreveram 21 arquivos, **nunca compilaram nenhum**, e corretamente se
recusaram a marcar `DONE` sem evidência de build. Gastou-se 14,6M tokens e
nenhuma task avançou. Do lado de fora, tudo parecia `success`.

### Skills globais e o `--add-dir`

Skills de origem `GLOBAL` vivem em `~/.claude/skills` e seus arquivos de
referência estão **fora** do projeto. O script libera esses diretórios com
`--add-dir` por padrão; sem isso a leitura é recusada mesmo com permissão ampla.
Desligue com `--no-skill-dirs`.

### Se você quiser menos que acesso total

```bash
./scripts/loop-tasks.sh specs/features/minha-feature --auto-approve \
  --permission-mode acceptEdits --allow 'Bash(dotnet build:*)'
```

Ou, por projeto, em `.claude/settings.json` — commitado, o time inteiro ganha:

```jsonc
{
  "permissions": {
    "allow": ["Bash(dotnet build:*)", "Bash(dotnet test:*)", "Bash(dotnet restore:*)"]
  }
}
```

### O script avisa quando algo é negado

Cada evento `end` traz `permission_denials` e `ferramentas_negadas`, o terminal
alerta, e o bloco de evidências final tem a coluna `negadas`:

```bash
jq -r 'select(.event=="end" and .permission_denials > 0)
  | [.task, .permission_denials, .ferramentas_negadas] | @tsv' \
  .specifica-br/logs/run_*.jsonl
```

**`bypassPermissions` é acesso irrestrito ao seu repositório e ao shell.** Rode
sempre em `--dry-run` antes, e de preferência em um branch limpo, para conseguir
revisar (`git diff`) ou reverter o que cada task produziu.

## Saída de build e testes

Saída de build fica no contexto e é **reenviada em todos os turnos seguintes**. A
receita continua sendo a mais simples: **pedir menos verbosidade ao próprio runner**,
nunca filtrar com `grep`.

```bash
dotnet build --nologo --verbosity quiet
dotnet test  --nologo --verbosity minimal
```

Por que não `grep`, e a razão vale para qualquer stack:

1. `grep -E 'error:'` não casa com `Program.cs(12,5): error CS0246:`. Todo erro de
   compilação C# seria descartado em silêncio.
2. Em `cmd | grep ... | head`, o exit code passa a ser o do `head`. Um build quebrado
   reportaria **sucesso**, e a task seria marcada DONE sobre código que não compila.
3. `-A 5` trunca stack trace e diff de assertion no meio.

Com verbosidade nativa quem decide o que é erro é o próprio compilador, não um regex.

### O que foi medido, e por que não há mais nada aqui

Existiu neste diretório um mecanismo maior — um wrapper que lia o relatório JUnit/TRX
do runner e devolvia um resumo, mais um hook `PreToolUse` que reescrevia os comandos
para passarem por ele. Ele funcionava: comprimia a saída **23,8×** num projeto .NET
real. Foi removido porque a medição mostrou que comprimia a coisa errada.

Três execuções da mesma task (`plus-sso`, `00001-credencial-de-aplicacao`, sonnet):

| Run | Turnos | Tokens | Digest |
|:--|--:|--:|:--|
| sem o mecanismo | 44 | 2.114.037 | — |
| perfil presente, wrapper ignorado | 41 | 2.748.743 | — |
| digest ativo | 48 | 2.680.109 | 23,8× |

Com `--verbosity minimal` já aplicado, a saída bruta de terminal da **task inteira**
somava 4.884 tokens. Comprimi-la a 205 rende, no melhor caso, **4,2%** — e a dispersão
entre runs idênticos é de ±13%. O efeito estava abaixo do piso de ruído.

Onde o custo realmente está: 48 turnos × ~55.800 tokens por turno, enquanto a soma de
**todos** os resultados de ferramenta da task dá 17 mil tokens. O contexto não é feito
de acúmulo — é o **prefixo fixo reenviado a cada turno**: system prompt, Contexto de
Execução, o comando e o arquivo da task. Quem quiser reduzir consumo ataca
`turnos × prefixo`, não stdout.

Duas lições que sobreviveram ao experimento e estão aplicadas:

- **O comando `/executar-task` encolheu** de 13.940 para 12.165 bytes por consolidação
  de repetições, sem perda semântica. Texto de prompt custa `tamanho × turnos`.
- **`exit=0` não é evidência de trabalho feito.** Ver a seção seguinte.

### Certificação da execução

Uma task que termina com `exit=0` e `subtype=success` pode não ter feito nada — o
escopo estava vazio, ou o agente fez uma pergunta que ninguém responde em modo `-p`.
Aconteceu de verdade: 6 turnos, 238 mil tokens, `success`. Nas métricas de consumo isso
aparece como uma melhoria de 9×, e é o contrário.

O script agora verifica, **na própria execução**, se a task ficou `DONE`. Se não ficou:

```
!! NAO CERTIFICADA: terminou com sucesso mas a task nao esta DONE.
   Turnos=6. Trate os numeros desta task como INVALIDOS para medicao.
```

e grava `sem_certificacao: true` no evento `end`. Sem isso, um no-op vence qualquer
otimização real num A/B.

### `resetar-tasks.sh`

```bash
scripts/resetar-tasks.sh specs/features/<feature> [1|1-3|1,5]
```

Resetar só a linha `Status` **não basta**, e o modo de falha é traiçoeiro: o PASSO 1 do
`/executar-task` define o escopo pelos checkboxes `[ ]`, então uma task com
`Status: TODO` e todos os itens `[x]` tem escopo vazio. O script reabre os checkboxes,
volta o `Status`, limpa a seção 8 (que guarda a evidência da execução anterior) e ajusta
`tasks.md`. Grava `.bak` de tudo que altera.

## Limitações conhecidas

- **O saldo da janela de 5 horas do plano não é acessível pela CLI.** Os campos
  `tokens_disponiveis_antes` / `_depois` são relativos ao teto que você define em
  `--window-budget-tokens`; sem ele, vêm como `null`. Ver §5 da análise.
- **Só o loop gera o Contexto de Execução.** Quem roda `/executar-task` na mão
  (ou com outra ferramenta) só aproveita o pacote que uma execução anterior
  deixou em disco. Sem pacote, o comando cai na leitura dirigida dos documentos.
- **O pacote é derivado.** Não o edite: a próxima execução sobrescreve. Se o
  conteúdo está errado, o erro está na fonte ou no `scripts/context-pack/prompt.md`.
- `total_cost_usd` é uma **estimativa client-side**, calculada localmente a
  partir de uma tabela de preços embutida na CLI. Não serve para faturamento.
- Ordem = ordem numérica dos arquivos. Não há resolução de dependências além da
  convenção "número menor primeiro".
- Cobre apenas `claude`.
