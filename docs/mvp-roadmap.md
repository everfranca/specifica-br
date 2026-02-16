# Specifica-BR: MVP Roadmap

## Parte 1: Specifica-BR CLI (NPM Package)

### MVP 1: Scaffolding Básico (Foco: OpenCode + GLM 4.7)
- **Objetivo:** Reduzir o tempo de setup do workflow.
- **Features:**
  - Comando `specifica init`.
  - Criação da estrutura de pastas `.opencode/commands` e `specs/templates`.
  - Cópia dos arquivos `.md` (templates e comandos) para os respectivos diretórios.
  - Otimizado exclusivamente para o OpenCode.
  - Comandos básicos: install, init, help, upgrade.
  - Melhorias (inclusões TODO) no `REAME.MD`

### MVP 2: Suporte Multi-Ferramentas e Multi-Modelos
- **Objetivo:** Flexibilidade de escolha para o desenvolvedor.
- **Features:**
  - Interatividade no comando `init` (perguntas no terminal).
  - Seleção da ferramenta alvo (OpenCode, Cursor, Gemini CLI).
  - Seleção do modelo alvo (GLM 4.7 Coding Plan, Gemini 3 Pro API, Gemini 2.5 Pro/Flash).
  - Adaptação dos diretórios de destino baseados na ferramenta escolhida (ex: `.cursor/rules` vs `.opencode/commands`).
