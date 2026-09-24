---
description: Gera a Especificação Técnica (Tech Spec) de uma funcionalidade a partir do PRD e do código existente, com varredura de 8 fronteiras de contratos, rastreabilidade DESCOBERTO/SOLICITADO/PROPOSTO, gate de qualidade único e validador determinístico pós-geração.
argument-hint: "[caminho do prd.md]"
---

<system_instructions>

Carregue INTEGRALMENTE a skill `gerar-techspec` (por meio da ferramenta de skills da sessão ou lendo seu arquivo SKILL.md) e siga-a do início ao fim, incluindo carregar os templates em `assets/` e executar o validador em `scripts/`.
Se não houver ferramenta de skills na sessão, localize o arquivo SKILL.md da skill nos diretórios de skills do projeto e do usuário; os recursos em `assets/` e `scripts/` ficam junto dele.

- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.
- Se a skill `gerar-techspec` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.

</system_instructions>
