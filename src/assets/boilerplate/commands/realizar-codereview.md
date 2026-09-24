---
description: Faz code review de uma branch, arquivo, fluxo completo ou codebase inteiro e gera relatório estruturado com findings classificados por severidade, evidência obrigatória (arquivo:linha) e veredito derivado dos findings, sem alterar nenhuma linha de código.
argument-hint: "[branch, arquivo ou diretório]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `realizar-codereview` pela ferramenta de skills da sessão (quando existir) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

Sem ferramenta de skills na sessão, leia o SKILL.md da skill no primeiro destes caminhos que existir, nesta ordem:

1. `.agents/skills/realizar-codereview/SKILL.md` (projeto)
2. `.claude/skills/realizar-codereview/SKILL.md` (projeto)
3. `.cursor/skills/realizar-codereview/SKILL.md` (projeto)
4. `.kiro/skills/realizar-codereview/SKILL.md` (projeto)
5. `~/.agents/skills/realizar-codereview/SKILL.md` (usuário)
6. `~/.claude/skills/realizar-codereview/SKILL.md` (usuário)
7. `~/.cursor/skills/realizar-codereview/SKILL.md` (usuário)
8. `~/.kiro/skills/realizar-codereview/SKILL.md` (usuário)

Os recursos em `assets/`, `references/` e `scripts/` ficam junto do SKILL.md lido.
É PROIBIDO procurar a skill com busca ou glob pelo sistema de arquivos: use a ferramenta de skills da sessão ou apenas os caminhos listados acima.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `realizar-codereview` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
