#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# specifica-br :: loop-tasks.sh  (v4.2 - Claude Code)
#
# Executa, EM LOOP, cada task de uma feature - uma task por PROCESSO novo,
# ou seja, cada task roda em uma CONTEXT WINDOW nova (garantido pelo SO, nao
# por instrucao de prompt).
#
# A evidencia de "janela nova por task" e o session_id que a CLI emite a cada
# processo: um session_id distinto por task = janelas distintas.
#
# v2 acrescentou CONTABILIDADE DE TOKENS por task e trava de orcamento.
# v3 acrescenta o CONTEXTO DE EXECUCAO: um destilado de ~4k tokens do PRD,
# da Tech Spec e do architecture.md, construido uma vez por execucao e
# injetado no prefixo cacheado de todas as tasks do run.
#
# Analise que originou estas versoes:
#   docs/analises/0001-consumo-de-tokens-loop-tasks.md
#
# Uso:
#   ./scripts/loop-tasks.sh <feature-dir> [opcoes]
#
# Opcoes:
#   --tool claude            Ferramenta de IA. Apenas `claude` nesta versao.
#   --model <modelo>         Modelo (default: sonnet). Ex.: sonnet, opus.
#   --effort <nivel>         Esforco de raciocinio: low|medium|high|xhigh|max
#                            (default: medium). Tokens de thinking sao
#                            cobrados como OUTPUT - este e um dos maiores
#                            multiplicadores de consumo.
#   --fallback-model <m>     Modelo de fallback quando o primario esta
#                            indisponivel/sobrecarregado (default: nenhum).
#   --auto-approve           ACESSO TOTAL para a task: leitura, escrita, Bash,
#                            Skills e MCPs, sem nenhum prompt de permissao
#                            (--permission-mode bypassPermissions).
#                            ATE a v3.3 esta flag usava acceptEdits, que NAO
#                            cobre Bash, Skill nem MCP - e por isso tasks
#                            escreviam codigo sem conseguir compilar.
#   --permission-mode <m>    Sobrescreve o modo acima quando voce quer menos
#                            que acesso total: acceptEdits|auto|dontAsk|manual.
#   --no-skill-dirs          Nao adiciona os diretorios de skills ao acesso.
#                            (Por padrao ~/.claude/skills e .claude/skills sao
#                            liberados: skills GLOBAIS vivem fora do projeto e
#                            seus arquivos de referencia sao ilegiveis sem isso.)
#   --max-budget-usd <n>     Teto de gasto POR TASK. A CLI encerra a task ao
#                            ultrapassar. Default: 0 (sem teto).
#   --window-budget-tokens <n>
#                            Orcamento TOTAL de tokens da execucao. O loop
#                            para antes de iniciar a task que estouraria o
#                            teto. Default: 0 (sem teto).
#   --stop-on-failure        Interrompe o loop na primeira task com erro.
#   --sleep <segundos>       Pausa entre tasks (default: 0).
#   --no-cache-tuning        Nao aplica as flags/env de otimizacao de cache.
#   --no-context-pack        Nao constroi nem injeta o Contexto de Execucao.
#                            Use para medir o antes/depois (A/B).
#   --pack-model <modelo>    Modelo da CONSTRUCAO do pacote (default: sonnet).
#                            Extracao literal e trabalho mecanico: nao paga o
#                            premio de um modelo de raciocinio.
#   --pack-effort <nivel>    Esforco da construcao do pacote (default: low).
#   --pack-max-tokens <n>    Teto de tamanho do pacote (default: 8000). Acima
#                            disso o script avisa e marca o log; nao aborta.
#   --tasks <selecao>        Executa apenas as tasks selecionadas. Aceita
#                            lista, intervalo ou mistura: 1,2,5 | 1-3 |
#                            1-3,7,9-10. Omitido, executa TODAS (default).
#                            A ordem e sempre numerica, nao a digitada.
#                            Task DONE continua sendo pulada mesmo se
#                            selecionada.
#   --allow <regra>          Libera um comando de shell para o agente
#                            (repetivel). --auto-approve NAO cobre shell.
#                            Ex.: --allow 'Bash(dotnet build:*)'
#   --preflight              Roda so as verificacoes de acesso, imprime, grava
#                            no log e sai. Exit 1 se houver ERRO.
#   --skip-preflight         Pula as verificacoes (escape hatch).
#   --require-cmd <cmd>      Exige um comando no PATH (repetivel). Ex.: dotnet.
#   --mcp-timeout <seg>      Timeout da verificacao de MCP (default: 15).
#   --no-mcp-check           Nao verifica MCPs no preflight.
#   --dry-run                Nao executa nada; so mostra ordem, loop e log.
#
# Exemplos:
#   ./scripts/loop-tasks.sh specs/features/minha-feature --dry-run
#   ./scripts/loop-tasks.sh specs/features/minha-feature --auto-approve \
#       --model sonnet --effort medium --window-budget-tokens 20000000
#   ./scripts/loop-tasks.sh specs/features/minha-feature --auto-approve \
#       --tasks 6-10          # retoma apos um limite de uso
#   ./scripts/loop-tasks.sh specs/features/minha-feature --tasks 3 --dry-run
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FEATURE_DIR="${1:?informe o diretorio da feature (ex: specs/features/minha-feature)}"; shift
FEATURE_DIR="${FEATURE_DIR%/}"
TOOL="claude"
MODEL="sonnet"
EFFORT="medium"
FALLBACK_MODEL=""
DRY_RUN=0
AUTO_APPROVE=0
STOP_ON_FAILURE=0
MAX_BUDGET_USD=0
WINDOW_BUDGET_TOKENS=0
SLEEP_BETWEEN=0
CACHE_TUNING=1
CONTEXT_PACK=1
PACK_MODEL="sonnet"
PACK_EFFORT="low"
PACK_MAX_TOKENS=8000
ALLOWED_TOOLS=()
TASK_SELECTION=""
TASK_SELECTION_INFORMADA=0
PERMISSION_MODE=""
SKILL_DIRS=1
PREFLIGHT_ONLY=0
SKIP_PREFLIGHT=0
REQUIRE_CMDS=()
MCP_TIMEOUT=15
MCP_CHECK=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool)                  TOOL="$2"; shift 2;;
    --model)                 MODEL="$2"; shift 2;;
    --effort)                EFFORT="$2"; shift 2;;
    --fallback-model)        FALLBACK_MODEL="$2"; shift 2;;
    --auto-approve)          AUTO_APPROVE=1; shift;;
    --max-budget-usd)        MAX_BUDGET_USD="$2"; shift 2;;
    --window-budget-tokens)  WINDOW_BUDGET_TOKENS="$2"; shift 2;;
    --stop-on-failure)       STOP_ON_FAILURE=1; shift;;
    --sleep)                 SLEEP_BETWEEN="$2"; shift 2;;
    --no-cache-tuning)       CACHE_TUNING=0; shift;;
    --no-context-pack)       CONTEXT_PACK=0; shift;;
    --pack-model)            PACK_MODEL="$2"; shift 2;;
    --pack-effort)           PACK_EFFORT="$2"; shift 2;;
    --pack-max-tokens)       PACK_MAX_TOKENS="$2"; shift 2;;
    --allow)                 ALLOWED_TOOLS+=("$2"); shift 2;;
    --tasks)                 TASK_SELECTION="$2"; TASK_SELECTION_INFORMADA=1; shift 2;;
    --permission-mode)       PERMISSION_MODE="$2"; shift 2;;
    --no-skill-dirs)         SKILL_DIRS=0; shift;;
    --preflight)             PREFLIGHT_ONLY=1; shift;;
    --skip-preflight)        SKIP_PREFLIGHT=1; shift;;
    --require-cmd)           REQUIRE_CMDS+=("$2"); shift 2;;
    --mcp-timeout)           MCP_TIMEOUT="$2"; shift 2;;
    --no-mcp-check)          MCP_CHECK=0; shift;;
    --dry-run)               DRY_RUN=1; shift;;
    *) echo "flag desconhecida: $1" >&2; exit 1;;
  esac
done

[[ -d "$FEATURE_DIR" ]] || { echo "diretorio nao encontrado: $FEATURE_DIR" >&2; exit 1; }
[[ "$TOOL" == "claude" ]] || { echo "tool invalida: $TOOL (esta versao cobre apenas 'claude')" >&2; exit 1; }
# jq e pre-requisito do proprio preflight (o relatorio e gravado como JSON);
# `claude` e checado la dentro, junto dos demais itens.
command -v jq >/dev/null || { echo "'jq' e obrigatorio para a contabilidade de tokens" >&2; exit 1; }

CLI_VERSION="$(claude --version 2>/dev/null | head -1)"

# --- Permissoes -------------------------------------------------------------
# Uma task de implementacao precisa de acesso TOTAL: ler (inclusive arquivos de
# skills fora do projeto), escrever, rodar build e testes, invocar Skills e
# consultar MCPs. `acceptEdits` cobre apenas a escrita de arquivo - a
# documentacao e explicita: "Apart from the read-only command set, other shell
# commands and network requests still need an --allowedTools entry or a
# permissions.allow rule".
#
# Em modo -p uma negacao NAO gera erro: a CLI devolve a recusa ao agente e a
# execucao continua. O efeito observado em producao foi task escrevendo codigo,
# nunca compilando e nunca marcando DONE - em silencio.
if [[ -n "$PERMISSION_MODE" ]]; then
  EFFECTIVE_PERMISSION_MODE="$PERMISSION_MODE"
elif [[ $AUTO_APPROVE -eq 1 ]]; then
  EFFECTIVE_PERMISSION_MODE="bypassPermissions"
else
  EFFECTIVE_PERMISSION_MODE=""
fi

# Skills de origem GLOBAL vivem em ~/.claude/skills e seus arquivos de
# referencia estao FORA do diretorio do projeto. Sem liberar o diretorio, a
# leitura e recusada mesmo com permissao ampla.
EXTRA_DIRS=()
if [[ $SKILL_DIRS -eq 1 ]]; then
  for d in "$HOME/.claude/skills" ".claude/skills"; do
    [[ -d "$d" ]] && EXTRA_DIRS+=(--add-dir "$d")
  done
fi

LOG_DIR=".specifica-br/logs"
mkdir -p "$LOG_DIR"
RUN_ID="$(date +%Y%m%d_%H%M%S)"
LOG="$LOG_DIR/run_${RUN_ID}.jsonl"
STDERR_LOG="$LOG_DIR/run_${RUN_ID}.stderr"

# --- Contexto de Execucao ---------------------------------------------------
# Destilado do PRD + Tech Spec + architecture.md. Artefato agnostico de
# ferramenta; o que e especifico do Claude Code (injecao no system prompt,
# deteccao de deriva por mtime) vive so aqui, nunca no prompt ou no template.
PACK_DIR="$SCRIPT_DIR/context-pack"
PACK_PROMPT="$PACK_DIR/prompt.md"
PACK_TEMPLATE="$PACK_DIR/template.md"
PACK_FILE="$FEATURE_DIR/contexto-execucao.md"
PACK_SOURCES=("$FEATURE_DIR/techspec.md" "$FEATURE_DIR/prd.md" "specs/core/architecture.md")

if [[ $CONTEXT_PACK -eq 1 && ( ! -f "$PACK_PROMPT" || ! -f "$PACK_TEMPLATE" ) ]]; then
  echo "aviso: $PACK_DIR/ ausente ou incompleto - seguindo sem Contexto de Execucao." >&2
  CONTEXT_PACK=0
fi

# Ordena por NUMERO extraido do nome (natural sort): task-2 vem antes de task-10,
# e task-1 / task-01 sao tratados igual.
mapfile -t TASKS < <(
  find "$FEATURE_DIR" -maxdepth 1 -name 'task-*.md' -printf '%f\n' \
  | sed -E 's/task-0*([0-9]+).*/\1\t&/' | sort -n | cut -f2
)
[[ ${#TASKS[@]} -eq 0 ]] && { echo "nenhuma task-*.md em $FEATURE_DIR" >&2; exit 1; }

# Numero da task extraido do nome do arquivo, com a mesma regra do natural sort
# acima: task-1.md e task-01.md sao ambos 1.
task_num() { sed -E 's/^task-0*([0-9]+).*/\1/' <<<"$1"; }

# Expande "1,2,5" / "1-3" / "1-3,7,9-10" em uma lista de numeros ordenada e sem
# duplicatas. Toda validacao acontece AQUI, antes de gastar qualquer token:
# falhar agora e barato, falhar depois da construcao do pacote nao e.
expandir_selecao() {
  local entrada="$1" parte ini fim n
  local -a numeros=()

  [[ "$entrada" =~ ^[0-9,\ -]+$ ]] || {
    echo "--tasks: selecao invalida '$entrada'." >&2
    echo "  Formatos aceitos: 1,2,5 | 1-3 | 1-3,7,9-10" >&2
    return 1
  }

  entrada="${entrada// /}"
  IFS=',' read -ra PARTES <<<"$entrada"
  for parte in "${PARTES[@]}"; do
    [[ -z "$parte" ]] && continue
    if [[ "$parte" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      ini="${BASH_REMATCH[1]}"; fim="${BASH_REMATCH[2]}"
      if (( ini > fim )); then
        echo "--tasks: intervalo invertido '$parte' (o inicio deve ser <= o fim)." >&2
        return 1
      fi
      for (( n = ini; n <= fim; n++ )); do numeros+=("$n"); done
    elif [[ "$parte" =~ ^[0-9]+$ ]]; then
      numeros+=("$parte")
    else
      echo "--tasks: trecho invalido '$parte'." >&2
      echo "  Formatos aceitos: 1,2,5 | 1-3 | 1-3,7,9-10" >&2
      return 1
    fi
  done

  [[ ${#numeros[@]} -eq 0 ]] && { echo "--tasks: selecao vazia." >&2; return 1; }
  printf '%s\n' "${numeros[@]}" | sort -n -u
}

TASKS_SELECIONADAS=()   # numeros pedidos, vazio quando --tasks foi omitido
if [[ "$TASK_SELECTION_INFORMADA" == "1" && -z "$TASK_SELECTION" ]]; then
  echo "--tasks: selecao vazia. Omita a flag para executar todas as tasks." >&2
  exit 1
fi
if [[ -n "$TASK_SELECTION" ]]; then
  # `mapfile < <(...)` roda em subshell e engoliria um `exit` da funcao; a
  # substituicao de comando abaixo propaga o status corretamente.
  SELECAO_EXPANDIDA="$(expandir_selecao "$TASK_SELECTION")" || exit 1
  mapfile -t TASKS_SELECIONADAS <<<"$SELECAO_EXPANDIDA"

  # Numeros disponiveis na feature, para validar o pedido e para a mensagem
  # de erro. Sem isso, "--tasks 99" so falharia como lista vazia.
  DISPONIVEIS=()
  for t in "${TASKS[@]}"; do DISPONIVEIS+=("$(task_num "$t")"); done

  FALTANDO=()
  for n in "${TASKS_SELECIONADAS[@]}"; do
    encontrou=0
    for d in "${DISPONIVEIS[@]}"; do [[ "$d" == "$n" ]] && { encontrou=1; break; }; done
    [[ $encontrou -eq 0 ]] && FALTANDO+=("$n")
  done
  if [[ ${#FALTANDO[@]} -gt 0 ]]; then
    echo "--tasks: nao existe task para: ${FALTANDO[*]}" >&2
    echo "  Disponiveis em $FEATURE_DIR: $(IFS=,; echo "${DISPONIVEIS[*]}")" >&2
    exit 1
  fi

  # Filtra preservando a ordem NUMERICA da lista original, nunca a ordem
  # digitada: as tasks dependem umas das outras por convencao (numero menor
  # primeiro), e inverter isso por acidente cria falha dificil de diagnosticar.
  TODAS_TASKS=("${TASKS[@]}")
  FILTRADAS=()
  for t in "${TASKS[@]}"; do
    n="$(task_num "$t")"
    for sel in "${TASKS_SELECIONADAS[@]}"; do
      [[ "$sel" == "$n" ]] && { FILTRADAS+=("$t"); break; }
    done
  done
  TASKS=("${FILTRADAS[@]}")
else
  TODAS_TASKS=("${TASKS[@]}")
fi

# Pertinencia na selecao, para distinguir um skip silencioso de uma task que o
# usuario pediu explicitamente e nao rodou.
foi_selecionada() {
  [[ -z "$TASK_SELECTION" ]] && { echo false; return; }
  local n; n="$(task_num "$1")"
  local sel
  for sel in "${TASKS_SELECIONADAS[@]}"; do
    [[ "$sel" == "$n" ]] && { echo true; return; }
  done
  echo false
}

log() { printf '%s\n' "$1" >> "$LOG"; }
fmt_int() { printf "%'d" "$1" 2>/dev/null || printf '%s' "$1"; }
# "disponiveis na janela" pode ser um numero ou o literal null (sem orcamento).
fmt_disp() { [[ "$1" == "null" ]] && printf 'sem teto' || fmt_int "$1"; }
# A CLI devolve custo com 16 casas decimais; 4 bastam e cabem na linha.
fmt_usd() { printf '%.4f' "$1" 2>/dev/null || printf '%s' "$1"; }
fmt_seg() { printf '%ds' $(( ${1:-0} / 1000 )); }

# --- PREFLIGHT --------------------------------------------------------------
# Verifica TUDO que pode falhar por acesso antes da primeira chamada de IA.
#
# Motivacao medida: em modo -p uma permissao negada NAO gera erro - a CLI
# devolve a recusa ao agente e a execucao continua. Tres execucoes reais
# gastaram tokens (uma delas 14,6M e uma janela de 5 horas) para so no fim
# revelar problemas de configuracao. Uma falha de setup deve custar 3 segundos,
# nao 3 milhoes de tokens.
#
# Severidade:
#   ERRO  = a execucao nao tem como dar certo -> aborta
#   AVISO = degrada mas funciona -> registra e segue
# O criterio de AVISO segue o protocolo do /executar-task, explicito em
# "E PROIBIDO abortar a execucao por indisponibilidade de item".
PF_ITENS=()     # linhas JSON, uma por item verificado
PF_ERROS=0
PF_AVISOS=0

pf_add() {  # grupo, item, severidade, mensagem
  local sev="$3"
  case "$sev" in
    ERRO)  PF_ERROS=$(( PF_ERROS + 1 ));;
    AVISO) PF_AVISOS=$(( PF_AVISOS + 1 ));;
  esac
  # Em execucao normal so os problemas aparecem, para nao poluir a saida.
  # Com --preflight (modo diagnostico) tudo aparece: o valor ali e justamente
  # ver o que foi verificado, nao so o que falhou.
  if [[ "$sev" != "OK" || $PREFLIGHT_ONLY -eq 1 ]]; then
    printf '  [%-5s] %s: %s\n' "$sev" "$2" "$4"
  fi
  PF_ITENS+=("$(jq -nc --arg g "$1" --arg i "$2" --arg s "$sev" --arg m "$4" \
    '{grupo:$g,item:$i,severidade:$s,mensagem:$m}')")
}

# Extrai os nomes declarados na secao 9 de uma task, por tipo (SKILL ou MCP).
# Formato: "- [ ] **nome**" seguido de "*Tipo:* SKILL|MCP".
pf_secao9() {  # arquivo, tipo
  awk -v tipo="$2" '
    /^## 9\./        { dentro = 1 }
    dentro && /^## [0-9]+\./ && !/^## 9\./ { dentro = 0 }
    dentro && match($0, /^- \[[ xX]\] \*\*([^*]+)\*\*/, m) { nome = m[1] }
    dentro && nome != "" && $0 ~ ("\\*Tipo:\\*[[:space:]]*" tipo) { print nome; nome = "" }
  ' "$1" 2>/dev/null | sort -u
}

preflight() {
  echo "== PREFLIGHT =="

  # --- A. Ferramentas do ambiente -------------------------------------------
  if command -v claude >/dev/null; then
    pf_add A "claude" OK "$CLI_VERSION"
  else
    pf_add A "claude" ERRO "CLI nao encontrada no PATH"
  fi
  pf_add A "jq" OK "$(jq --version 2>/dev/null)"
  # `bc` sustenta a soma de custo em acumular(). Nunca foi verificado: sem ele
  # o custo acumulado quebra em silencio e o loop segue com numeros errados.
  if command -v bc >/dev/null; then
    pf_add A "bc" OK "presente"
  else
    pf_add A "bc" ERRO "ausente - o custo acumulado quebraria em silencio"
  fi
  command -v column >/dev/null \
    && pf_add A "column" OK "presente" \
    || pf_add A "column" AVISO "ausente - bloco de evidencias sai sem alinhamento"

  for c in "${REQUIRE_CMDS[@]:-}"; do
    [[ -z "$c" ]] && continue
    command -v "$c" >/dev/null \
      && pf_add G "cmd:$c" OK "presente" \
      || pf_add G "cmd:$c" ERRO "exigido por --require-cmd e ausente no PATH"
  done

  # --- B. Instalacao do specifica-br ----------------------------------------
  # Sem o comando instalado, "/executar-task <path>" e enviado como TEXTO
  # LITERAL: a task roda, gasta tokens e nao implementa nada. E a falha mais
  # cara e mais silenciosa possivel, e custa um teste de arquivo detectar.
  CMD_ENCONTRADO=""
  for d in ".claude/commands" "$HOME/.claude/commands"; do
    [[ -f "$d/executar-task.md" ]] && { CMD_ENCONTRADO="$d"; break; }
  done
  if [[ -n "$CMD_ENCONTRADO" ]]; then
    pf_add B "comando executar-task" OK "$CMD_ENCONTRADO"
  else
    pf_add B "comando executar-task" ERRO \
      "nao encontrado em .claude/commands nem ~/.claude/commands - o prompt viraria texto literal"
  fi

  if [[ $CONTEXT_PACK -eq 1 ]]; then
    [[ -f "$PACK_PROMPT" && -f "$PACK_TEMPLATE" ]] \
      && pf_add B "context-pack" OK "prompt e template presentes" \
      || pf_add B "context-pack" AVISO "$PACK_DIR incompleto - seguira sem Contexto de Execucao"
  fi

  # --- C. Permissoes e configuracao -----------------------------------------
  if [[ -z "$EFFECTIVE_PERMISSION_MODE" ]]; then
    pf_add C "permissoes" ERRO "nenhuma - toda escrita e todo Bash seriam negados. Use --auto-approve"
  elif [[ "$EFFECTIVE_PERMISSION_MODE" == "bypassPermissions" ]]; then
    pf_add C "permissoes" OK "bypassPermissions (Read/Write/Bash/Skill/MCP)"
  else
    pf_add C "permissoes" AVISO \
      "$EFFECTIVE_PERMISSION_MODE nao cobre Bash, Skill nem MCP - negacoes sao provaveis"
  fi

  # Settings malformado e SILENCIOSAMENTE IGNORADO em modo -p: permissoes e
  # hooks desaparecem sem nenhum aviso da CLI.
  for f in ".claude/settings.json" ".claude/settings.local.json"; do
    [[ -f "$f" ]] || continue
    if jq -e . "$f" >/dev/null 2>&1; then
      pf_add C "$f" OK "JSON valido"
      while IFS= read -r h; do
        [[ -z "$h" ]] && continue
        hp="${h//\$CLAUDE_PROJECT_DIR/$PWD}"; hp="${hp%% *}"
        [[ -x "$hp" ]] \
          && pf_add C "hook $(basename "$hp")" OK "executavel" \
          || pf_add C "hook $(basename "$hp")" AVISO "nao existe ou nao e executavel: $hp"
      done < <(jq -r '(.hooks // {})|to_entries[]|.value[]?|.hooks[]?|select(.type=="command")|.command' "$f" 2>/dev/null)
    else
      pf_add C "$f" ERRO "JSON invalido - a CLI ignora em silencio em modo -p"
    fi
  done

  # --- D. Artefatos da feature ----------------------------------------------
  [[ -w "$LOG_DIR" ]] \
    && pf_add D "logs" OK "$LOG_DIR gravavel" \
    || pf_add D "logs" ERRO "$LOG_DIR sem permissao de escrita"

  local nao_grav=()
  for t in "${TASKS[@]}"; do
    [[ -r "$FEATURE_DIR/$t" && -w "$FEATURE_DIR/$t" ]] || nao_grav+=("$t")
  done
  if [[ ${#nao_grav[@]} -eq 0 ]]; then
    pf_add D "tasks selecionadas" OK "${#TASKS[@]} legivel(is) e gravavel(is)"
  else
    # Sem escrita no arquivo da task, o PASSO 5 nao marca o Status e o loop
    # reexecuta a mesma task para sempre.
    pf_add D "tasks selecionadas" ERRO "sem escrita: ${nao_grav[*]} - o Status nunca seria marcado DONE"
  fi

  if [[ -f "$FEATURE_DIR/tasks.md" ]]; then
    [[ -w "$FEATURE_DIR/tasks.md" ]] \
      && pf_add D "tasks.md" OK "gravavel" \
      || pf_add D "tasks.md" ERRO "existe mas nao e gravavel"
  else
    pf_add D "tasks.md" AVISO "ausente - o comando manda atualiza-lo"
  fi

  for f in "${PACK_SOURCES[@]}"; do
    [[ -r "$f" ]] \
      && pf_add D "$(basename "$f")" OK "legivel" \
      || pf_add D "$(basename "$f")" AVISO "ausente ou ilegivel: $f"
  done

  # --- E. Skills e MCPs declarados nas tasks SELECIONADAS -------------------
  local skills=() mcps=()
  for t in "${TASKS[@]}"; do
    while IFS= read -r n; do [[ -n "$n" ]] && skills+=("$n"); done < <(pf_secao9 "$FEATURE_DIR/$t" SKILL)
    while IFS= read -r n; do [[ -n "$n" ]] && mcps+=("$n"); done < <(pf_secao9 "$FEATURE_DIR/$t" MCP)
  done

  if [[ ${#skills[@]} -gt 0 ]]; then
    for sk in $(printf '%s\n' "${skills[@]}" | sort -u); do
      if [[ -d "$HOME/.claude/skills/$sk" ]]; then
        # Skill GLOBAL vive fora do projeto: sem --add-dir os arquivos de
        # referencia dela sao ilegiveis, que foi a causa da negacao de Read.
        if [[ $SKILL_DIRS -eq 1 ]]; then
          pf_add E "skill:$sk" OK "global, diretorio liberado"
        else
          pf_add E "skill:$sk" ERRO "global, mas --no-skill-dirs impede a leitura das referencias"
        fi
      elif [[ -d ".claude/skills/$sk" ]]; then
        pf_add E "skill:$sk" OK "projeto"
      else
        pf_add E "skill:$sk" AVISO "declarada e nao encontrada - a task prosseguira sem ela"
      fi
    done
  fi

  if [[ ${#mcps[@]} -gt 0 && $MCP_CHECK -eq 0 ]]; then
    for m in $(printf '%s\n' "${mcps[@]}" | sort -u); do
      pf_add E "mcp:$m" AVISO "verificacao desligada (--no-mcp-check)"
    done
  elif [[ ${#mcps[@]} -gt 0 ]]; then
    # Uma unica chamada, reaproveitada para todos os MCPs declarados.
    #
    # BLINDAGEM (bug real: preflight travou 15+ minutos apesar do `timeout`):
    #  1. Saida vai para ARQUIVO, nunca para `$(...)`. Numa substituicao de
    #     comando o shell bloqueia ate o pipe FECHAR, e servidores MCP lancados
    #     via `npx` deixam processos-neto que herdam esse pipe. O `timeout`
    #     matava o `claude` e o shell continuava esperando os netos, para
    #     sempre.
    #  2. `</dev/null`: sem isso `claude mcp list` pode ficar aguardando algo
    #     no stdin do terminal, sem nada visivel na tela.
    #  3. `-k`: SIGKILL depois do SIGTERM, para o caso de o processo ignorar o
    #     primeiro sinal.
    local mcp_out="" mcp_tmp mcp_rc=0
    echo "  ... verificando ${#mcps[@]} MCP(s), ate ${MCP_TIMEOUT}s (--no-mcp-check desliga)"
    mcp_tmp="$(mktemp 2>/dev/null || echo "/tmp/loop-tasks-mcp.$$")"
    if command -v timeout >/dev/null; then
      timeout -k 5 "$MCP_TIMEOUT" claude mcp list >"$mcp_tmp" 2>/dev/null </dev/null || mcp_rc=$?
    else
      claude mcp list >"$mcp_tmp" 2>/dev/null </dev/null || mcp_rc=$?
    fi
    # Saida PARCIAL nao vale: um timeout no meio do health check deixa no
    # arquivo so o cabecalho "Checking MCP server health...", e tratar isso como
    # resposta faria todo MCP aparecer como "nao configurado" - diagnostico
    # errado e pior que nenhum. Timeout invalida a leitura inteira.
    if [[ $mcp_rc -eq 0 && -s "$mcp_tmp" ]]; then
      mcp_out="$(cat "$mcp_tmp")"
    fi
    rm -f "$mcp_tmp"

    for m in $(printf '%s\n' "${mcps[@]}" | sort -u); do
      if [[ -z "$mcp_out" ]]; then
        if [[ $mcp_rc -eq 124 || $mcp_rc -eq 137 ]]; then
          pf_add E "mcp:$m" AVISO "nao foi possivel verificar: 'claude mcp list' estourou ${MCP_TIMEOUT}s"
        else
          pf_add E "mcp:$m" AVISO "nao foi possivel verificar ('claude mcp list' falhou, rc=$mcp_rc)"
        fi
      elif grep -qiE "^${m}:.*(Connected|✔)" <<<"$mcp_out"; then
        pf_add E "mcp:$m" OK "conectado"
      elif grep -qiE "^${m}:" <<<"$mcp_out"; then
        pf_add E "mcp:$m" AVISO "configurado mas nao conectado"
      else
        pf_add E "mcp:$m" AVISO "declarado e nao configurado neste projeto"
      fi
    done
  fi

  # --- F. Alvos de escrita fora do projeto ----------------------------------
  local fora=()
  for t in "${TASKS[@]}"; do
    while IFS= read -r alvo; do
      [[ "$alvo" =~ ^(/|~) ]] && fora+=("$alvo")
    done < <(sed -n '/5.2 Arquivos Permitidos/,/^---/p' "$FEATURE_DIR/$t" 2>/dev/null \
             | sed -nE 's/^- `([^`]+)`.*/\1/p')
  done
  if [[ ${#fora[@]} -gt 0 ]]; then
    pf_add F "alvos de escrita" AVISO "fora do projeto (exigiriam --add-dir): $(printf '%s ' "${fora[@]}" | sort -u | tr '\n' ' ')"
  else
    pf_add F "alvos de escrita" OK "todos dentro do projeto"
  fi

  # --- Relatorio ------------------------------------------------------------
  [[ $PF_ERROS -eq 0 && $PF_AVISOS -eq 0 && $PREFLIGHT_ONLY -eq 0 ]] && echo "  todos os itens OK"
  echo
  echo "  $PF_AVISOS aviso(s), $PF_ERROS erro(s)"

  log "$(jq -nc --arg ts "$(date -Is)" \
    --argjson erros "$PF_ERROS" --argjson avisos "$PF_AVISOS" \
    --argjson itens "$(printf '%s\n' "${PF_ITENS[@]}" | jq -sc .)" \
    '{event:"preflight",ts:$ts,erros:$erros,avisos:$avisos,itens:$itens}')"
}

# --- Marcadores de execucao (ferramenta / modelo / cache / contexto) ---------
echo "Feature      : $FEATURE_DIR"
echo "Ferramenta   : $TOOL ($CLI_VERSION)"
echo "Modelo       : $MODEL   Effort: $EFFORT   Fallback: ${FALLBACK_MODEL:-nenhum}"
if [[ "$EFFECTIVE_PERMISSION_MODE" == "bypassPermissions" ]]; then
  echo "Permissoes   : ACESSO TOTAL (bypassPermissions) - Read/Write/Bash/Skill/MCP"
elif [[ -n "$EFFECTIVE_PERMISSION_MODE" ]]; then
  echo "Permissoes   : $EFFECTIVE_PERMISSION_MODE"
else
  echo "Permissoes   : nenhuma (as tasks vao travar nos prompts - use --auto-approve)"
fi
SKILL_DIRS_TXT="nenhum"
[[ ${#EXTRA_DIRS[@]} -gt 0 ]] && SKILL_DIRS_TXT="$(printf '%s ' "${EXTRA_DIRS[@]}" | sed 's/--add-dir //g')"
echo "Dirs extras  : $SKILL_DIRS_TXT"
echo "Cache tuning : $CACHE_TUNING"
if [[ $CONTEXT_PACK -eq 1 ]]; then
  echo "Contexto Exec: on   construcao: $PACK_MODEL/$PACK_EFFORT   teto: $(fmt_int "$PACK_MAX_TOKENS") tokens"
else
  echo "Contexto Exec: off"
fi
echo "Orcamentos   : task=\$${MAX_BUDGET_USD}   janela=$(fmt_int "$WINDOW_BUDGET_TOKENS") tokens"
if [[ -n "$TASK_SELECTION" ]]; then
  echo "Tasks        : ${#TASKS[@]} de ${#TODAS_TASKS[@]} selecionadas ($TASK_SELECTION)"
else
  echo "Tasks        : ${#TASKS[@]}"
fi
echo "Log          : $LOG"
echo

log "$(jq -nc \
  --arg ts "$(date -Is)" \
  --arg feature "$FEATURE_DIR" \
  --arg tool "$TOOL" \
  --arg cli_version "$CLI_VERSION" \
  --arg model "$MODEL" \
  --arg effort "$EFFORT" \
  --arg fallback_model "$FALLBACK_MODEL" \
  --argjson total_tasks "${#TASKS[@]}" \
  --argjson total_tasks_feature "${#TODAS_TASKS[@]}" \
  --arg task_selection "$TASK_SELECTION" \
  --argjson tasks_selecionadas "$(printf '%s\n' "${TASKS_SELECIONADAS[@]:-}" | jq -Rsc 'split("\n")|map(select(length>0)|tonumber)')" \
  --argjson window_budget_tokens "$WINDOW_BUDGET_TOKENS" \
  --arg max_budget_usd "$MAX_BUDGET_USD" \
  --argjson auto_approve "$AUTO_APPROVE" \
  --arg permission_mode "$EFFECTIVE_PERMISSION_MODE" \
  --arg extra_dirs "$SKILL_DIRS_TXT" \
  --argjson cache_tuning "$CACHE_TUNING" \
  --argjson context_pack "$CONTEXT_PACK" \
  --arg pack_model "$PACK_MODEL" --arg pack_effort "$PACK_EFFORT" \
  --argjson pack_max_tokens "$PACK_MAX_TOKENS" \
  --argjson dry_run "$DRY_RUN" \
  '{event:"run_start",ts:$ts,feature:$feature,tool:$tool,cli_version:$cli_version,
    model:$model,effort:$effort,fallback_model:$fallback_model,total_tasks:$total_tasks,
    total_tasks_feature:$total_tasks_feature,
    task_selection:(if $task_selection=="" then null else $task_selection end),
    tasks_selecionadas:$tasks_selecionadas,
    window_budget_tokens:$window_budget_tokens,max_budget_usd:$max_budget_usd,
    auto_approve:$auto_approve,
    permission_mode:(if $permission_mode=="" then null else $permission_mode end),
    extra_dirs:$extra_dirs,
    cache_tuning:$cache_tuning,context_pack:$context_pack,
    pack_model:$pack_model,pack_effort:$pack_effort,pack_max_tokens:$pack_max_tokens,
    dry_run:$dry_run}')"

# --- Guarda: tasks que rodaram sem erro mas nunca foram certificadas --------
# Assinatura vista em producao (run_20260826_181922): cinco tasks terminaram com
# subtype "success", escreveram 21 arquivos e nenhuma marcou DONE, porque o
# `dotnet build` estava bloqueado por permissao e o protocolo corretamente
# proibe certificar sem evidencia de compilacao.
#
# Este aviso NAO pula nada, de proposito: aquele run provou que "success" da CLI
# nao significa trabalho validado. Pular com base no log reintroduziria o erro
# que estamos tentando tornar visivel. Quem certifica e o DONE; o log so avisa.
SUSPEITAS=()
if compgen -G "$LOG_DIR/run_*.jsonl" >/dev/null; then
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    [[ -f "$FEATURE_DIR/$t" ]] || continue
    grep -qiE '^\|\s*\*\*Status\*\*\s*\|\s*DONE' "$FEATURE_DIR/$t" || SUSPEITAS+=("$t")
  done < <(
    jq -r 'select(.event=="end" and .is_error==false and (.dry_run|not)) | .task' \
      "$LOG_DIR"/run_*.jsonl 2>/dev/null | sort -u
  )
fi

if [[ ${#SUSPEITAS[@]} -gt 0 ]]; then
  # Distingue as que esta execucao vai de fato refazer das que ficaram de fora
  # da selecao: dizer "serao reexecutadas" sobre uma task que nao esta na lista
  # seria falso, e um aviso que mente vale menos que aviso nenhum.
  NESTA_EXEC=(); FORA_DA_EXEC=()
  for t in "${SUSPEITAS[@]}"; do
    dentro=0
    for a in "${TASKS[@]}"; do [[ "$a" == "$t" ]] && { dentro=1; break; }; done
    if [[ $dentro -eq 1 ]]; then NESTA_EXEC+=("$t"); else FORA_DA_EXEC+=("$t"); fi
  done

  echo "!! ATENCAO: ${#SUSPEITAS[@]} task(s) concluiram sem erro em execucoes anteriores mas NAO estao DONE:"
  echo "   ${SUSPEITAS[*]}"
  [[ ${#NESTA_EXEC[@]} -gt 0 ]] && echo "   Serao REEXECUTADAS agora: ${NESTA_EXEC[*]}"
  [[ ${#FORA_DA_EXEC[@]} -gt 0 ]] && echo "   Fora desta selecao (seguem sem certificacao): ${FORA_DA_EXEC[*]}"
  echo "   Causa tipica: permissao negada impediu a validacao"
  echo "   (veja permission_denials no log daquela execucao)."
  echo
  log "$(jq -nc --arg ts "$(date -Is)" \
    --argjson tasks "$(printf '%s\n' "${SUSPEITAS[@]}" | jq -Rsc 'split("\n")|map(select(length>0))')" \
    --argjson nesta_execucao "$(printf '%s\n' "${NESTA_EXEC[@]:-}" | jq -Rsc 'split("\n")|map(select(length>0))')" \
    '{event:"tasks_nao_certificadas",ts:$ts,tasks:$tasks,nesta_execucao:$nesta_execucao}')"
fi

# --- Execucao do preflight --------------------------------------------------
# Roda depois do run_start (para o relatorio cair no log) e ANTES do build_pack,
# que e a primeira chamada de IA e o primeiro gasto real de token.
PREFLIGHT_EXIT=0
if [[ $SKIP_PREFLIGHT -eq 1 ]]; then
  echo "== PREFLIGHT ignorado (--skip-preflight) =="
  echo
else
  preflight
  echo
  if [[ $PF_ERROS -gt 0 ]]; then
    PREFLIGHT_EXIT=1
    if [[ $PREFLIGHT_ONLY -eq 0 && $DRY_RUN -eq 0 ]]; then
      echo "ABORTADO antes de gastar tokens."
      echo "Corrija os itens acima ou use --skip-preflight (nao recomendado)."
      log "$(jq -nc --arg ts "$(date -Is)" --argjson erros "$PF_ERROS" \
        '{event:"run_end",ts:$ts,motivo:"preflight_reprovado",erros:$erros,
          tasks_executadas:0,tasks_com_erro:0,tokens_gastos_total:0,custo_total_usd:"0"}')"
      exit 1
    fi
    # Em --dry-run e --preflight o erro nao interrompe: os dois sao
    # diagnosticos, e ver a lista completa de problemas de uma vez vale mais
    # que parar no primeiro. O exit code no fim reflete o resultado.
    echo "(--dry-run/--preflight: seguindo mesmo com erro, para o diagnostico completo)"
    echo
  fi
fi

if [[ $PREFLIGHT_ONLY -eq 1 ]]; then
  echo "== Somente preflight (--preflight). Nada foi executado. =="
  exit $PREFLIGHT_EXIT
fi

# --- Otimizacao de cache entre processos ------------------------------------
# Cada task e um processo novo. O prefixo cacheado so e reaproveitado entre
# processos sequenciais se o system prompt for identico - e ele embute cwd,
# plataforma e o snapshot do git status, que MUDA a cada task que escreve
# arquivos. A flag abaixo move essas secoes para a primeira mensagem de
# usuario, mantendo o system prompt estavel entre as tasks.
CACHE_FLAGS=()
if [[ $CACHE_TUNING -eq 1 ]]; then
  CACHE_FLAGS+=(--exclude-dynamic-system-prompt-sections)
  export CLAUDE_CODE_PROMPT_CACHE_TTL="${CLAUDE_CODE_PROMPT_CACHE_TTL:-1h}"
fi

TOTAL_TOKENS=0
TOTAL_COST="0"
EXECUTED=0
FAILED=0
STOP_REASON="fim_da_lista"

# Extrai a contabilidade do result message.
# `usage` cobre apenas o loop principal; `modelUsage` inclui subagents.
# Somamos por modelUsage quando existe, e caimos para `usage` se nao.
PARSE_JQ='
  def n(x): (x // 0);
  . as $r
  | (($r.modelUsage // {}) | to_entries) as $mu
  | (if ($mu|length) > 0
      then { i: ([$mu[].value.inputTokens]|add),
             o: ([$mu[].value.outputTokens]|add),
             w: ([$mu[].value.cacheCreationInputTokens]|add),
             r: ([$mu[].value.cacheReadInputTokens]|add),
             m: ([$mu[].key]|join(",")) }
      else { i: n($r.usage.input_tokens),
             o: n($r.usage.output_tokens),
             w: n($r.usage.cache_creation_input_tokens),
             r: n($r.usage.cache_read_input_tokens),
             m: ($r.model // "?") }
    end) as $t
  | (($r.permission_denials // []) | map(.tool_name // .tool // "?")) as $d
  | [ ($r.session_id // "?"), ($r.subtype // "?"), (($r.is_error // false)|tostring),
      n($r.num_turns), n($r.duration_ms), n($r.duration_api_ms),
      n($r.total_cost_usd), n($t.i), n($t.o), n($t.w), n($t.r), ($t.m),
      ($d|length), (($d|unique|join(","))) ]
  | @tsv'

parse_result() {
  read -r SID SUBTYPE IS_ERROR NUM_TURNS DUR_MS DUR_API_MS COST_TASK \
          IN_TOK OUT_TOK CACHE_W CACHE_R MODELS DENIALS_N DENIALS < <(
    printf '%s' "$1" | jq -r "$PARSE_JQ" 2>/dev/null \
      || printf '?\tparse_error\ttrue\t0\t0\t0\t0\t0\t0\t0\t0\t?\t0\t\n'
  )
  DENIALS_N="${DENIALS_N:-0}"; DENIALS="${DENIALS:-}"
  TOKENS_LAST=$(( IN_TOK + OUT_TOK + CACHE_W + CACHE_R ))
}

acumular() {
  TOTAL_TOKENS=$(( TOTAL_TOKENS + TOKENS_LAST ))
  TOTAL_COST="$(printf '%s + %s\n' "$TOTAL_COST" "$COST_TASK" | bc -l)"
}

# --- Construcao do Contexto de Execucao -------------------------------------
# Le o prompt agnostico do disco e substitui os placeholders. A instrucao de
# geracao nao conhece a ferramenta; quem a executa e este script.
build_pack() {
  local motivo="$1" fonte_alterada="${2:-}"
  local ptxt

  ptxt="$(cat "$PACK_PROMPT")"
  ptxt="${ptxt//\{\{FEATURE_DIR\}\}/$FEATURE_DIR}"
  ptxt="${ptxt//\{\{TEMPLATE_PATH\}\}/$PACK_TEMPLATE}"

  echo ".. construindo Contexto de Execucao ($motivo${fonte_alterada:+: $fonte_alterada})"

  local out exit_code
  out="$(claude -p "$ptxt" --output-format json \
        --model "$PACK_MODEL" --effort "$PACK_EFFORT" \
        --permission-mode acceptEdits \
        "${CACHE_FLAGS[@]}" 2>>"$STDERR_LOG")"
  exit_code=$?

  parse_result "$out"

  if [[ $exit_code -ne 0 || "$IS_ERROR" == "true" || ! -f "$PACK_FILE" ]]; then
    echo "   !! falha ao construir o Contexto de Execucao - seguindo sem ele."
    log "$(jq -nc --arg ts "$(date -Is)" --arg motivo "$motivo" \
      --arg subtype "$SUBTYPE" --argjson exit_code "$exit_code" \
      --argjson tokens_gastos "$TOKENS_LAST" \
      '{event:"pack_build_failed",ts:$ts,motivo:$motivo,subtype:$subtype,
        exit_code:$exit_code,tokens_gastos:$tokens_gastos}')"
    acumular
    return 1
  fi

  local bytes est_tokens over
  bytes="$(wc -c <"$PACK_FILE")"
  # ~3,5 caracteres por token, apropriado para markdown em portugues.
  est_tokens=$(( bytes * 10 / 35 ))
  over=false
  acumular

  echo "   pacote=$PACK_FILE  bytes=$(fmt_int "$bytes") (~$(fmt_int "$est_tokens") tokens)"
  echo "   construcao: modelo=$PACK_MODEL effort=$PACK_EFFORT turnos=$NUM_TURNS tokens=$(fmt_int "$TOKENS_LAST") custo=\$$(fmt_usd "$COST_TASK")"

  # O teto e verificado AQUI, e nao confiado ao proprio gerador: na primeira
  # execucao real o modelo estourou o limite declarado no prompt sem registrar
  # o excesso. O pacote vai no system prompt de toda task, entao o excedente
  # e pago uma vez por task.
  if [[ "$PACK_MAX_TOKENS" -gt 0 && "$est_tokens" -gt "$PACK_MAX_TOKENS" ]]; then
    over=true
    echo "   !! pacote ACIMA DO TETO: ~$(fmt_int "$est_tokens") > $(fmt_int "$PACK_MAX_TOKENS") tokens."
    echo "      O excedente sera pago em cada uma das ${#TASKS[@]} tasks. Revise scripts/context-pack/prompt.md"
    echo "      ou eleve --pack-max-tokens se o tamanho for legitimo para esta feature."
  fi

  log "$(jq -nc \
    --arg ts "$(date -Is)" --arg motivo "$motivo" \
    --arg fonte_alterada "${fonte_alterada:-}" \
    --arg arquivo "$PACK_FILE" --arg session_id "$SID" \
    --arg model_solicitado "$MODEL" --arg modelos_reportados "$MODELS" \
    --arg pack_model "$PACK_MODEL" --arg pack_effort "$PACK_EFFORT" \
    --argjson num_turns "$NUM_TURNS" --argjson bytes_pack "$bytes" \
    --argjson est_tokens_pack "$est_tokens" --argjson pack_over_ceiling "$over" \
    --argjson pack_max_tokens "$PACK_MAX_TOKENS" \
    --argjson input_tokens "$IN_TOK" --argjson output_tokens "$OUT_TOK" \
    --argjson cache_creation_input_tokens "$CACHE_W" \
    --argjson cache_read_input_tokens "$CACHE_R" \
    --argjson tokens_gastos "$TOKENS_LAST" \
    --argjson tokens_gastos_acumulado_depois "$TOTAL_TOKENS" \
    --arg custo_usd "$COST_TASK" \
    '{event:"pack_build",ts:$ts,motivo:$motivo,
      fonte_alterada:(if $fonte_alterada=="" then null else $fonte_alterada end),
      arquivo:$arquivo,session_id:$session_id,model_solicitado:$model_solicitado,
      modelos_reportados:$modelos_reportados,pack_model:$pack_model,pack_effort:$pack_effort,
      num_turns:$num_turns,bytes_pack:$bytes_pack,est_tokens_pack:$est_tokens_pack,
      pack_max_tokens:$pack_max_tokens,pack_over_ceiling:$pack_over_ceiling,
      input_tokens:$input_tokens,output_tokens:$output_tokens,
      cache_creation_input_tokens:$cache_creation_input_tokens,
      cache_read_input_tokens:$cache_read_input_tokens,
      tokens_gastos:$tokens_gastos,
      tokens_gastos_acumulado_depois:$tokens_gastos_acumulado_depois,
      custo_usd:$custo_usd}')"
  return 0
}

# Devolve o primeiro documento-fonte mais novo que o pacote, ou vazio.
pack_fonte_desatualizada() {
  local src
  [[ -f "$PACK_FILE" ]] || { printf '%s' "${PACK_SOURCES[0]}"; return; }
  for src in "${PACK_SOURCES[@]}"; do
    if [[ -f "$src" && "$src" -nt "$PACK_FILE" ]]; then
      printf '%s' "$src"; return
    fi
  done
  printf ''
}

if [[ $CONTEXT_PACK -eq 1 && $DRY_RUN -eq 0 ]]; then
  # Ao retomar uma execucao interrompida, reconstruir um pacote que continua
  # valido e dinheiro jogado fora. So reconstroi se faltar ou se uma fonte
  # mudou desde a ultima geracao.
  FONTE_NOVA="$(pack_fonte_desatualizada)"
  if [[ -z "$FONTE_NOVA" ]]; then
    echo ".. Contexto de Execucao ja existe e esta em dia: $PACK_FILE"
    log "$(jq -nc --arg ts "$(date -Is)" --arg arquivo "$PACK_FILE" \
      '{event:"pack_reused",ts:$ts,arquivo:$arquivo}')"
  else
    build_pack "inicial" "$FONTE_NOVA" || true
  fi
  echo
elif [[ $CONTEXT_PACK -eq 1 && $DRY_RUN -eq 1 ]]; then
  echo "   [dry-run] construiria o Contexto de Execucao em $PACK_FILE"
  echo
fi

for TASK in "${TASKS[@]}"; do
  TASK_PATH="$FEATURE_DIR/$TASK"

  # Pula tasks ja concluidas (linha "| **Status** | DONE" no arquivo da task).
  if grep -qiE '^\|\s*\*\*Status\*\*\s*\|\s*DONE' "$TASK_PATH"; then
    echo "  skip (DONE): $TASK"
    SELECIONADA="$(foi_selecionada "$TASK")"
    # DONE vence a selecao: selecionar e filtrar, nunca autorizar a refazer.
    # O aviso existe para que a ausencia de execucao nao seja confundida com
    # execucao quando o usuario pediu a task pelo nome.
    if [[ "$SELECIONADA" == "true" ]]; then
      echo "  !! $(task_num "$TASK") foi SELECIONADA mas ja esta DONE - nao foi executada."
      echo "     Para reexecutar de proposito, altere o Status no arquivo da task."
    fi
    log "$(jq -nc --arg ts "$(date -Is)" --arg task "$TASK" \
      --argjson selecionada "$SELECIONADA" \
      '{event:"skip",ts:$ts,task:$task,motivo:"DONE",selecionada:$selecionada}')"
    continue
  fi

  # Deriva: um documento-fonte mudou desde a construcao do pacote (tipicamente
  # a task de sincronizacao CORE, que edita architecture.md no meio do run).
  if [[ $CONTEXT_PACK -eq 1 && $DRY_RUN -eq 0 && -f "$PACK_FILE" ]]; then
    FONTE_NOVA="$(pack_fonte_desatualizada)"
    if [[ -n "$FONTE_NOVA" ]]; then
      build_pack "deriva" "$FONTE_NOVA" || true
    fi
  fi

  # Trava de orcamento da janela: nao inicia task que ja estourou o teto.
  if [[ "$WINDOW_BUDGET_TOKENS" -gt 0 && "$TOTAL_TOKENS" -ge "$WINDOW_BUDGET_TOKENS" ]]; then
    echo "!! ORCAMENTO DA JANELA ESGOTADO antes de $TASK"
    echo "   gastos=$(fmt_int "$TOTAL_TOKENS") tokens / teto=$(fmt_int "$WINDOW_BUDGET_TOKENS")"
    log "$(jq -nc --arg ts "$(date -Is)" --arg task "$TASK" \
      --argjson gastos "$TOTAL_TOKENS" --argjson teto "$WINDOW_BUDGET_TOKENS" \
      '{event:"budget_exhausted",ts:$ts,proxima_task:$task,
        tokens_gastos_acumulado:$gastos,window_budget_tokens:$teto}')"
    STOP_REASON="orcamento_da_janela"
    break
  fi

  if [[ "$WINDOW_BUDGET_TOKENS" -gt 0 ]]; then
    DISP_ANTES_JSON=$(( WINDOW_BUDGET_TOKENS - TOTAL_TOKENS ))
  else
    DISP_ANTES_JSON="null"
  fi

  USOU_PACK=false
  [[ $CONTEXT_PACK -eq 1 && -f "$PACK_FILE" ]] && USOU_PACK=true

  TS_START="$(date -Is)"
  T0=$(date +%s)
  echo ">> START $TASK  ($TS_START)"
  echo "   modelo=$MODEL  ferramenta=$TOOL  effort=$EFFORT  contexto_execucao=$USOU_PACK"
  echo "   tokens gastos ate aqui=$(fmt_int "$TOTAL_TOKENS")  disponiveis na janela=$(fmt_disp "$DISP_ANTES_JSON")"

  log "$(jq -nc \
    --arg ts "$TS_START" --arg task "$TASK" --arg tool "$TOOL" \
    --arg model "$MODEL" --arg effort "$EFFORT" \
    --argjson usou_contexto_execucao "$USOU_PACK" \
    --argjson tokens_gastos_acumulado_antes "$TOTAL_TOKENS" \
    --argjson tokens_disponiveis_antes "$DISP_ANTES_JSON" \
    '{event:"start",ts:$ts,task:$task,tool:$tool,model:$model,effort:$effort,
      usou_contexto_execucao:$usou_contexto_execucao,
      tokens_gastos_acumulado_antes:$tokens_gastos_acumulado_antes,
      tokens_disponiveis_antes:$tokens_disponiveis_antes}')"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "   [dry-run] executaria: claude -p \"/executar-task $TASK_PATH\" --model $MODEL --effort $EFFORT"
    log "$(jq -nc --arg ts "$(date -Is)" --arg task "$TASK" \
      '{event:"end",ts:$ts,task:$task,session_id:"DRY",dry_run:true}')"
    continue
  fi

  PROMPT="/executar-task $TASK_PATH"

  ARGS=(-p "$PROMPT" --output-format json --model "$MODEL" --effort "$EFFORT")
  [[ -n "$EFFECTIVE_PERMISSION_MODE" ]] && ARGS+=(--permission-mode "$EFFECTIVE_PERMISSION_MODE")
  [[ ${#EXTRA_DIRS[@]} -gt 0 ]] && ARGS+=("${EXTRA_DIRS[@]}")
  [[ -n "$FALLBACK_MODEL" ]] && ARGS+=(--fallback-model "$FALLBACK_MODEL")
  [[ ${#ALLOWED_TOOLS[@]} -gt 0 ]] && ARGS+=(--allowedTools "${ALLOWED_TOOLS[@]}")
  [[ "$MAX_BUDGET_USD" != "0" ]] && ARGS+=(--max-budget-usd "$MAX_BUDGET_USD")
  # O pacote entra no system prompt. Com --exclude-dynamic-system-prompt-sections,
  # o prefixo fica [preset estatico][pacote] - IDENTICO entre todas as tasks do
  # run, que e a condicao para o cache ser reaproveitado entre processos.
  [[ "$USOU_PACK" == "true" ]] && ARGS+=(--append-system-prompt-file "$PACK_FILE")
  ARGS+=("${CACHE_FLAGS[@]}")

  OUT="$(claude "${ARGS[@]}" 2>>"$STDERR_LOG")"
  EXIT_CODE=$?

  TS_END="$(date -Is)"
  T1=$(date +%s)
  WALL=$(( T1 - T0 ))

  parse_result "$OUT"
  acumular

  if [[ "$WINDOW_BUDGET_TOKENS" -gt 0 ]]; then
    DISP_DEPOIS_JSON=$(( WINDOW_BUDGET_TOKENS - TOTAL_TOKENS ))
    (( DISP_DEPOIS_JSON < 0 )) && DISP_DEPOIS_JSON=0
  else
    DISP_DEPOIS_JSON="null"
  fi

  echo "<< END   $TASK  ($TS_END)  exit=$EXIT_CODE  subtype=$SUBTYPE"
  echo "   session_id=${SID}  turnos=$NUM_TURNS  wall=${WALL}s  api=$(fmt_seg "$DUR_API_MS")"
  echo "   modelo(s) reportado(s)=$MODELS"
  echo "   tokens da task=$(fmt_int "$TOKENS_LAST")  (in=$(fmt_int "$IN_TOK") out=$(fmt_int "$OUT_TOK") cache_write=$(fmt_int "$CACHE_W") cache_read=$(fmt_int "$CACHE_R"))"
  echo "   custo da task=\$$(fmt_usd "$COST_TASK")   acumulado=\$$(fmt_usd "$TOTAL_COST")"
  echo "   tokens gastos acumulado=$(fmt_int "$TOTAL_TOKENS")  disponiveis na janela=$(fmt_disp "$DISP_DEPOIS_JSON")"

  # Negacao de permissao nao gera erro em modo -p: a CLI devolve a recusa ao
  # agente e a execucao continua. Sem este aviso, uma task inteira roda,
  # escreve codigo, nunca consegue compilar e nao marca DONE - em silencio.
  # `--permission-mode acceptEdits` NAO cobre comandos de shell: `dotnet build`,
  # `npm test` e afins exigem regra em permissions.allow ou --allow.
  if [[ "${DENIALS_N:-0}" -gt 0 ]]; then
    echo "   !! $DENIALS_N PERMISSAO(OES) NEGADA(S): ${DENIALS}"
    echo "      A task pode ter escrito codigo sem conseguir valida-lo."
    echo "      Libere com --allow 'Bash(dotnet build:*)' ou em .claude/settings.json."
  fi

  # Certificacao da PROPRIA execucao. `exit=0` + `success` NAO e evidencia de
  # que a task fez trabalho: um agente que encerra sem implementar - porque o
  # escopo estava vazio, ou porque fez uma pergunta que ninguem responde em modo
  # -p - devolve sucesso com pouquissimos turnos. Nas metricas de token isso
  # aparece como uma melhoria espetacular, e e o contrario: nada foi feito.
  # Sem esta marca, um A/B pode ser vencido por um no-op.
  SEM_CERT=false
  if [[ "$IS_ERROR" != "true" && $EXIT_CODE -eq 0 ]] \
     && ! grep -qiE '^\|\s*\*\*Status\*\*\s*\|\s*DONE' "$TASK_PATH"; then
    SEM_CERT=true
    echo "   !! NAO CERTIFICADA: terminou com sucesso mas a task nao esta DONE."
    echo "      Turnos=$NUM_TURNS. Trate os numeros desta task como INVALIDOS para medicao."
    echo "      Causas tipicas: escopo vazio (checkboxes ja [x]), pergunta feita em modo -p,"
    echo "      ou validacao impedida por permissao."
  fi

  log "$(jq -nc \
    --arg ts "$TS_END" --arg task "$TASK" --arg tool "$TOOL" \
    --arg model_solicitado "$MODEL" --arg modelos_reportados "$MODELS" \
    --arg effort "$EFFORT" --arg session_id "$SID" --arg subtype "$SUBTYPE" \
    --argjson is_error "$IS_ERROR" --argjson exit_code "$EXIT_CODE" \
    --argjson usou_contexto_execucao "$USOU_PACK" \
    --argjson permission_denials "${DENIALS_N:-0}" \
    --arg ferramentas_negadas "${DENIALS:-}" \
    --argjson num_turns "$NUM_TURNS" --argjson duration_ms "$DUR_MS" \
    --argjson duration_api_ms "$DUR_API_MS" --argjson wall_seconds "$WALL" \
    --argjson input_tokens "$IN_TOK" --argjson output_tokens "$OUT_TOK" \
    --argjson cache_creation_input_tokens "$CACHE_W" \
    --argjson cache_read_input_tokens "$CACHE_R" \
    --argjson sem_certificacao "$SEM_CERT" \
    --argjson tokens_gastos_task "$TOKENS_LAST" \
    --argjson tokens_gastos_acumulado_depois "$TOTAL_TOKENS" \
    --argjson tokens_disponiveis_depois "$DISP_DEPOIS_JSON" \
    --arg custo_task_usd "$COST_TASK" \
    --arg custo_acumulado_usd "$(printf '%.6f' "$TOTAL_COST")" \
    '{event:"end",ts:$ts,task:$task,tool:$tool,model_solicitado:$model_solicitado,
      modelos_reportados:$modelos_reportados,effort:$effort,session_id:$session_id,
      subtype:$subtype,is_error:$is_error,exit_code:$exit_code,
      usou_contexto_execucao:$usou_contexto_execucao,
      permission_denials:$permission_denials,
      ferramentas_negadas:(if $ferramentas_negadas=="" then null else $ferramentas_negadas end),
      num_turns:$num_turns,
      duration_ms:$duration_ms,duration_api_ms:$duration_api_ms,wall_seconds:$wall_seconds,
      input_tokens:$input_tokens,output_tokens:$output_tokens,
      cache_creation_input_tokens:$cache_creation_input_tokens,
      cache_read_input_tokens:$cache_read_input_tokens,
      sem_certificacao:$sem_certificacao,
      tokens_gastos_task:$tokens_gastos_task,
      tokens_gastos_acumulado_depois:$tokens_gastos_acumulado_depois,
      tokens_disponiveis_depois:$tokens_disponiveis_depois,
      custo_task_usd:$custo_task_usd,custo_acumulado_usd:$custo_acumulado_usd}')"

  EXECUTED=$(( EXECUTED + 1 ))

  if [[ "$IS_ERROR" == "true" || $EXIT_CODE -ne 0 ]]; then
    FAILED=$(( FAILED + 1 ))
    echo "   !! task terminou com erro (subtype=$SUBTYPE)"
    # Limite de uso do plano: continuar so queima o resto da janela.
    if printf '%s' "$OUT" | grep -qiE 'usage limit|rate.?limit|weekly limit|session limit'; then
      echo "!! LIMITE DE USO ATINGIDO - interrompendo o loop."
      log "$(jq -nc --arg ts "$(date -Is)" --arg task "$TASK" \
        '{event:"rate_limited",ts:$ts,task:$task}')"
      STOP_REASON="limite_de_uso"
      break
    fi
    if [[ $STOP_ON_FAILURE -eq 1 ]]; then
      STOP_REASON="falha_na_task"
      break
    fi
  fi

  [[ "$SLEEP_BETWEEN" -gt 0 ]] && sleep "$SLEEP_BETWEEN"
  echo
done

log "$(jq -nc \
  --arg ts "$(date -Is)" --arg motivo "$STOP_REASON" \
  --argjson tasks_executadas "$EXECUTED" --argjson tasks_com_erro "$FAILED" \
  --argjson tokens_gastos_total "$TOTAL_TOKENS" \
  --arg custo_total_usd "$(printf '%.6f' "$TOTAL_COST")" \
  '{event:"run_end",ts:$ts,motivo:$motivo,tasks_executadas:$tasks_executadas,
    tasks_com_erro:$tasks_com_erro,tokens_gastos_total:$tokens_gastos_total,
    custo_total_usd:$custo_total_usd}')"

echo
echo "== Resumo da execucao =="
echo "Motivo do fim : $STOP_REASON"
echo "Tasks         : $EXECUTED executadas, $FAILED com erro"
echo "Tokens        : $(fmt_int "$TOTAL_TOKENS")  (inclui a construcao do Contexto de Execucao)"
echo "Custo estimado: \$$(fmt_usd "$TOTAL_COST")  (estimativa client-side)"
if [[ "$WINDOW_BUDGET_TOKENS" -gt 0 ]]; then
  RESTANTE=$(( WINDOW_BUDGET_TOKENS - TOTAL_TOKENS )); (( RESTANTE < 0 )) && RESTANTE=0
  echo "Orcamento     : $(fmt_int "$TOTAL_TOKENS") de $(fmt_int "$WINDOW_BUDGET_TOKENS") usados, $(fmt_int "$RESTANTE") restantes"
fi
echo
echo "== Evidencia: um session_id distinto por task =="
# `tostring | gsub` insere o separador de milhar da direita para a esquerda:
# 3036001 -> 3,036,001. Sem isso a coluna vira uma parede de digitos.
jq -r '
  def milhar: tostring | [scan(".")] | reverse
    | to_entries | map(if (.key > 0 and .key % 3 == 0) then .value + "," else .value end)
    | reverse | join("");
  select(.event=="end" and (.dry_run|not))
  | [ .task,
      "session=\(.session_id)",
      "tokens=\((.tokens_gastos_task // 0)|milhar)",
      "turnos=\(.num_turns // 0)",
      "negadas=\(.permission_denials // 0)",
      "pack=\(.usou_contexto_execucao)" ]
  | @tsv' "$LOG" | column -t -s $'\t' 2>/dev/null \
  || jq -r 'select(.event=="end")|"\(.task)\t\(.session_id)"' "$LOG"

# Exit 1 quando o preflight reprovou (relevante em --dry-run e em CI).
exit $PREFLIGHT_EXIT
