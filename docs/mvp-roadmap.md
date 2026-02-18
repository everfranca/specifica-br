# Specifica-BR: MVP Roadmap

## Visão Geral

Este projeto tem como objetivo reduzir o tempo de setup de workflows de desenvolvimento guiados por IA através de um pacote npm global. O pacote permite inicializar projetos copiando arquivos necessários (comandos e templates) para os diretórios recomendados por cada ferramenta de IA.

## MVP 1: Scaffolding Básico (OpenCode + GLM 4.7)
- [x] Release Date: 2026-02-17

**Objetivo:**
Criar um pacote npm global que inicializa projetos focados em OpenCode e GLM 4.7 Coding Plan.

**Features:**
- Comando `specifica-br init` para inicializar um projeto
- Cópia dos arquivos de comandos para `.opencode/commands/`
- Criação do diretório `/specs/templates/` com templates `.md`
- Recursos básicos do pacote npm:
  - `help`: Exibe informações de uso
  - `upgrade`: Atualiza o pacote para última versão
  - `uninstall`: Remove o pacote globalmente
  - `version`: Exibe versão atual

**Requisitos:**
- Pacote instalável globalmente via `npm install -g specifica-br`
- Seguir recomendações de estrutura de diretórios do OpenCode
- Suportar projetos que utilizam GLM 4.7 Coding Plan

**Exemplo de uso:**
```bash
npm install -g specifica-br
specifica-br init
# Cria estrutura:
# .opencode/commands/
# specs/templates/
```

---

## MVP 2: Flexibilidade de Configuração (Custom Path)
- [ ] Release Date: -

**Objetivo:**
Adicionar flexibilidade para que o usuário possa personalizar o local onde os comandos serão instalados.

**Features:**
- Prompt interativo no comando `specifica-br init` com duas opções:
  - **Configuração Padrão (Boilerplate)**: Seguir estrutura recomendada (`.opencode/commands/` + `/specs/templates/`)
  - **Custom Path**: Informar caminho relativo para os comandos
- Quando custom path for escolhido:
  - Copiar arquivos de comandos para o diretório especificado pelo usuário
  - Criar `/specs/templates/` com templates `.md` (sempre no local padrão)

**Requisitos:**
- Validação do caminho relativo informado pelo usuário
- Mensagens claras indicando onde os arquivos foram criados
- Preservar opção padrão (boilerplate) para casos de uso simples

**Exemplo de uso:**
```bash
specifica-br init
# Prompt: Escolha o modo de configuração:
# [1] Padrão (Boilerplate)
# [2] Custom Path
#
# > 2
# Prompt: Informe o caminho relativo para os comandos:
# > .custom-ai/commands
#
# Cria estrutura:
# .custom-ai/commands/
# specs/templates/
```

---

## MVP 3: Suporte Multi-Ferramentas
- [ ] Release Date: -

**Objetivo:**
Expandir o suporte para diferentes ferramentas de IA (OpenCode, Gemini CLI, Cursor).

**Features:**
- Prompt interativo no comando `specifica-br init` para seleção de ferramenta
- Estrutura de diretórios adaptável conforme ferramenta escolhida:
  - OpenCode → `.opencode/commands/`
  - Cursor → `.cursor/commands/`
  - Gemini CLI → `.gemini/commands/` (exemplo)
- Suporte a custom path independente da ferramenta escolhida

**Requisitos:**
- Manter compatibilidade com features do MVP 2 (boilerplate vs custom path)
- Validar estrutura de diretórios para cada ferramenta
- Permitir extensão futura para novas ferramentas

**Exemplo de uso:**
```bash
specifica-br init
# Prompt: Selecione a ferramenta:
# [1] OpenCode
# [2] Gemini CLI
# [3] Cursor
#
# > 1
# Prompt: Escolha o modo de configuração:
# [1] Padrão (Boilerplate)
# [2] Custom Path
#
# > 1
#
# Cria estrutura:
# .opencode/commands/
# specs/templates/
```