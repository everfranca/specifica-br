---
description: Analisa um repositório existente (brownfield) e infere a visão de produto e a arquitetura técnica com níveis de confiança por evidência, gerando specs/core/architecture.md e specs/core/product_vision.md com validação iterativa e o mínimo de perguntas.
argument-hint: "[caminho do projeto]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-contexto` (por meio da ferramenta de skills da sessão ou lendo seu arquivo SKILL.md) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-contexto` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
