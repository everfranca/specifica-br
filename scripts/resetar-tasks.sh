#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Devolve as tasks de uma feature ao estado de partida, para um A/B limpo.
#
#   scripts/resetar-tasks.sh <dir-da-feature> [n[,n|n-n]...]
#   scripts/resetar-tasks.sh specs/features/00001-credencial 1
#
# Resetar so a linha `Status` NAO basta, e o modo de falha e traicoeiro: o
# PASSO 1 do /executar-task define o escopo pelos checkboxes `[ ]`, entao uma
# task com Status=TODO e todos os itens `[x]` tem escopo VAZIO. O agente encerra
# sem implementar, com exit=0 e poucos turnos - e nas metricas de token isso
# parece uma melhoria espetacular. Um no-op vence qualquer otimizacao real.
#
# Reseta, portanto: Status, todos os checkboxes, a secao 8 (que guarda evidencia
# da execucao anterior) e a linha correspondente em tasks.md.
# Grava .bak de tudo que altera.
# ---------------------------------------------------------------------------
set -uo pipefail
DIR="${1:-}"; SEL="${2:-}"
[[ -d "$DIR" ]] || { echo "uso: $0 <dir-da-feature> [selecao]"; exit 64; }

mapfile -t FILES < <(find "$DIR" -maxdepth 1 -name 'task-*.md' \
  | sed -E 's/.*task-0*([0-9]+).*/\1\t&/' | sort -n | cut -f2)
[[ ${#FILES[@]} -gt 0 ]] || { echo "nenhuma task-*.md em $DIR" >&2; exit 1; }

if [[ -n "$SEL" ]]; then
  NUMS=" $(tr ',' ' ' <<<"$SEL" | tr ' ' '\n' | while read -r p; do
    [[ "$p" =~ ^([0-9]+)-([0-9]+)$ ]] && seq "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" || echo "$p"
  done | tr '\n' ' ') "
  ALVOS=(); for f in "${FILES[@]}"; do
    n="$(sed -E 's/.*task-0*([0-9]+).*/\1/' <<<"$(basename "$f")")"
    [[ "$NUMS" == *" $n "* ]] && ALVOS+=("$f")
  done
else ALVOS=("${FILES[@]}"); fi
[[ ${#ALVOS[@]} -gt 0 ]] || { echo "selecao nao casou com nenhuma task" >&2; exit 1; }

for f in "${ALVOS[@]}"; do
  cp "$f" "$f.bak"
  python3 - "$f" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
marcados = len(re.findall(r'(?m)^(\s*)- \[x\]', s))
s = re.sub(r'(?m)^(\s*)- \[[xX]\]', r'\1- [ ]', s)
s = re.sub(r'(?m)^(\|\s*\*\*Status\*\*\s*\|\s*)(DONE|IN_PROGRESS)(\s*\|)', r'\1TODO\3', s)
# Secao 8 carrega a evidencia da execucao anterior; mantida, o agente lê como
# se o trabalho ja tivesse sido feito.
m = re.search(r'(?m)^## 8\..*?$', s)
if m:
    resto = s[m.end():]
    prox = re.search(r'(?m)^(---\s*\n)?^## ', resto)
    corpo = "\n[Uso para decisões técnicas relevantes. Não repetir informações já documentadas]\n\n"
    s = s[:m.end()] + corpo + (resto[prox.start():] if prox else "")
open(p, 'w').write(s)
print(f"  {p}: {marcados} checkbox(es) reabertos, Status=TODO, secao 8 limpa")
PY
done

TM="$DIR/tasks.md"
if [[ -f "$TM" ]]; then
  cp "$TM" "$TM.bak"
  if [[ -z "$SEL" ]]; then
    sed -i -E 's/^(\s*)- \[[xX]\]/\1- [ ]/' "$TM"; echo "  $TM: todos os itens reabertos"
  else
    for f in "${ALVOS[@]}"; do
      n="$(sed -E 's/.*task-0*([0-9]+).*/\1/' <<<"$(basename "$f")")"
      sed -i -E "s/^(\s*)- \[[xX]\](.*[Tt]ask[- ]0*${n}([^0-9]|\$).*)/\1- [ ]\2/" "$TM"
    done
    echo "  $TM: itens das tasks selecionadas reabertos"
  fi
fi
echo
echo "Backups em *.bak. Confira antes de rodar:"
echo "  grep -c '^\\s*- \\[ \\]' ${ALVOS[0]}"
