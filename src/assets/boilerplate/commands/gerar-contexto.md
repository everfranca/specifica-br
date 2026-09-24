---
description: Analisa um repositório existente (brownfield) e infere a visão de produto e a arquitetura técnica com níveis de confiança por evidência, gerando specs/core/architecture.md e specs/core/product_vision.md com validação iterativa e o mínimo de perguntas.
argument-hint: "[caminho do projeto]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-contexto` pela ferramenta de skills da sessão (quando existir) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

Sem ferramenta de skills na sessão, leia o SKILL.md da skill no primeiro destes caminhos que existir, nesta ordem:

1. `.agents/skills/gerar-contexto/SKILL.md` (projeto)
2. `.claude/skills/gerar-contexto/SKILL.md` (projeto)
3. `.cursor/skills/gerar-contexto/SKILL.md` (projeto)
4. `.kiro/skills/gerar-contexto/SKILL.md` (projeto)
5. `~/.agents/skills/gerar-contexto/SKILL.md` (usuário)
6. `~/.claude/skills/gerar-contexto/SKILL.md` (usuário)
7. `~/.cursor/skills/gerar-contexto/SKILL.md` (usuário)
8. `~/.kiro/skills/gerar-contexto/SKILL.md` (usuário)

Os recursos em `assets/`, `references/` e `scripts/` ficam junto do SKILL.md lido.
É PROIBIDO procurar a skill com busca ou glob pelo sistema de arquivos: use a ferramenta de skills da sessão ou apenas os caminhos listados acima.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-contexto` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
