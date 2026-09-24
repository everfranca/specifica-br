---
description: Gera a Especificação Técnica (Tech Spec) de uma funcionalidade a partir do PRD e do código existente, com varredura de 8 fronteiras de contratos, rastreabilidade DESCOBERTO/SOLICITADO/PROPOSTO, gate de qualidade único e validador determinístico pós-geração.
argument-hint: "[caminho do prd.md]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-techspec` pela ferramenta de skills da sessão (quando existir) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

Sem ferramenta de skills na sessão, leia o SKILL.md da skill no primeiro destes caminhos que existir, nesta ordem:

1. `.agents/skills/gerar-techspec/SKILL.md` (projeto)
2. `.claude/skills/gerar-techspec/SKILL.md` (projeto)
3. `.cursor/skills/gerar-techspec/SKILL.md` (projeto)
4. `.kiro/skills/gerar-techspec/SKILL.md` (projeto)
5. `~/.agents/skills/gerar-techspec/SKILL.md` (usuário)
6. `~/.claude/skills/gerar-techspec/SKILL.md` (usuário)
7. `~/.cursor/skills/gerar-techspec/SKILL.md` (usuário)
8. `~/.kiro/skills/gerar-techspec/SKILL.md` (usuário)

Os recursos em `assets/`, `references/` e `scripts/` ficam junto do SKILL.md lido.
É PROIBIDO procurar a skill com busca ou glob pelo sistema de arquivos: use a ferramenta de skills da sessão ou apenas os caminhos listados acima.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-techspec` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
