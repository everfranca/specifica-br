<img src="https://raw.githubusercontent.com/everfranca/specifica-br/main/docs/assets/brand/readme-header-dark.png" alt="specifica-br — orquestrador CLI SDD pt-BR" width="600">

[![Versão no npm](https://img.shields.io/npm/v/specifica-br?style=flat-square&label=npm&color=5FC9D6&labelColor=0B2E33)](https://www.npmjs.com/package/specifica-br)
[![Node.js](https://img.shields.io/node/v/specifica-br?style=flat-square&label=node&color=5FC9D6&labelColor=0B2E33)](https://nodejs.org)
[![Licença MIT](https://img.shields.io/npm/l/specifica-br?style=flat-square&label=licen%C3%A7a&color=5FC9D6&labelColor=0B2E33)](https://github.com/everfranca/specifica-br/blob/main/LICENSE)
[![Documentação](https://img.shields.io/badge/documenta%C3%A7%C3%A3o-github-5FC9D6?style=flat-square&labelColor=0B2E33)](https://github.com/everfranca/specifica-br#readme)

# specifica-br

Ferramenta de linha de comando que automatiza o workflow de Spec Driven Development (SDD) com IA, do contexto do produto até a execução das tarefas. É para times e pessoas que desenvolvem com assistentes de IA e querem especificação antes de código, com todos os artefatos em português brasileiro.

O `specifica-br` instala os comandos e as skills SDD na sua ferramenta de IA — OpenCode, ClaudeCode, Cursor, Gemini CLI ou Kiro — e executa as tarefas geradas em lote.

## O que é SDD

Spec Driven Development é a metodologia que coloca a documentação antes da escrita de código: visão de produto e arquitetura definem a fundação, o PRD define os requisitos, a Tech Spec define o desenho técnico e as tasks decompõem o trabalho. O ganho é menos retrabalho, comunicação alinhada e um contexto estável para a IA implementar.

## Instalação

```bash
npm install -g specifica-br
```

## Quick start

```bash
specifica-br init
```

O `init` instala os comandos e as skills no diretório global da sua ferramenta de IA — uma vez por máquina — e cria os templates em `specs/templates/` no projeto atual.

Com isso, o workflow SDD tem sete passos:

| Passo | Comando | Resultado |
|:---|:---|:---|
| 1. Inicialização | `specifica-br init` | Comandos, skills e templates instalados |
| 2. Contexto | `/gerar-visao` (projeto novo) ou `/gerar-contexto` (projeto existente) | `specs/core/product_vision.md` e `specs/core/architecture.md` |
| 3. PRD | `/gerar-prd` | Requisitos funcionais e regras de negócio |
| 4. Tech Spec | `/gerar-techspec` | Arquitetura, componentes e plano técnico |
| 5. Tasks | `/gerar-tasks` | Tarefas executáveis a partir do plano |
| 6. Execução | `/executar-task` ou `specifica-br executar-tasks` | Implementação, individual ou em lote |
| 7. Code review | `/realizar-codereview` | Relatório de revisão do código implementado |

Saída real do `specifica-br help`:

```
Usage:
  specifica-br [options] [command]

Commands:
  init              Instala comandos e skills SDD no diretório global (--local para o projeto)
  executar-tasks    Executa em lote os task-*.md de uma feature
  config            Exibe e altera o layout e a ferramenta de IA
  help [command]    display help for command
  upgrade           Atualiza templates e comandos (em breve)
```

## Comandos da CLI

| Comando | Descrição |
|:---|:---|
| `specifica-br init` | Instala comandos e skills no diretório global da ferramenta de IA e cria os templates no projeto. `--local` instala tudo dentro do projeto. |
| `specifica-br executar-tasks <diretório>` | Executa em lote os `task-*.md` de uma feature, na ordem numérica, pulando as que já estão `DONE`. Possui mais de vinte opções de modelo, orçamento, permissão e contexto. |
| `specifica-br config` | Exibe e altera o layout de exibição e a ferramenta de IA registrada para o projeto. |
| `specifica-br upgrade` | Atualiza a CLI para a versão mais recente do npm. |
| `specifica-br help` | Ajuda simplificada. `--completo` exibe o workflow SDD detalhado. |

As opções completas de `executar-tasks`, incluindo tabelas de padrões, capacidades por ferramenta e regras de orçamento, estão no README do GitHub.

## Comandos de IA

Instalados pelo `init` e usados dentro da sua ferramenta de IA:

| Comando | Descrição |
|:---|:---|
| `/gerar-visao` | Cria a visão de produto e a arquitetura de um projeto novo |
| `/gerar-contexto` | Analisa um projeto existente e infere visão e arquitetura |
| `/gerar-prd` | Gera o PRD de uma funcionalidade |
| `/gerar-techspec` | Gera a Especificação Técnica a partir do PRD |
| `/gerar-tasks` | Gera a lista de tasks a partir do PRD e da Tech Spec |
| `/executar-task` | Executa uma task e atualiza o status |
| `/realizar-codereview` | Faz code review e gera relatório |

## Documentação completa

Instalação detalhada, todas as opções de cada comando, sistema de notificações de atualização, estrutura de diretórios, capacidades por ferramenta de IA e guia de contribuição:

https://github.com/everfranca/specifica-br#readme

## Requisitos

- Node.js 18 ou superior
- npm 8 ou superior
- A CLI da ferramenta de IA escolhida disponível no PATH

## Licença

MIT
