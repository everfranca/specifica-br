---
description: Gera a lista de tasks de implementação a partir do PRD e da Tech Spec, com atomicidade (uma camada tecnológica por task), rastreabilidade total de contratos CT/ENV/SEC-XXX, cruzamento com documentos CORE, task de sincronização de divergências DIV-XXX e checkpoint com DE ACORDO.
argument-hint: "[caminho do prd.md] [caminho do techspec.md]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-tasks` (por meio da ferramenta de skills da sessão ou lendo seu arquivo SKILL.md) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-tasks` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
