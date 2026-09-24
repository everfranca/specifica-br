---
description: Gera a lista de tasks de implementação a partir do PRD e da Tech Spec, com atomicidade (uma camada tecnológica por task), rastreabilidade total de contratos CT/ENV/SEC-XXX, cruzamento com documentos CORE, task de sincronização de divergências DIV-XXX e checkpoint com DE ACORDO.
argument-hint: "[caminho do prd.md] [caminho do techspec.md]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-tasks` pela ferramenta de skills da sessão (quando existir) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

Sem ferramenta de skills na sessão, leia o SKILL.md da skill no primeiro destes caminhos que existir, nesta ordem:

1. `.agents/skills/gerar-tasks/SKILL.md` (projeto)
2. `.claude/skills/gerar-tasks/SKILL.md` (projeto)
3. `.cursor/skills/gerar-tasks/SKILL.md` (projeto)
4. `.kiro/skills/gerar-tasks/SKILL.md` (projeto)
5. `~/.agents/skills/gerar-tasks/SKILL.md` (usuário)
6. `~/.claude/skills/gerar-tasks/SKILL.md` (usuário)
7. `~/.cursor/skills/gerar-tasks/SKILL.md` (usuário)
8. `~/.kiro/skills/gerar-tasks/SKILL.md` (usuário)

Os recursos em `assets/`, `references/` e `scripts/` ficam junto do SKILL.md lido.
É PROIBIDO procurar a skill com busca ou glob pelo sistema de arquivos: use a ferramenta de skills da sessão ou apenas os caminhos listados acima.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-tasks` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
