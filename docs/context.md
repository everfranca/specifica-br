# Specifica-BR: Context and Ecosystem Document

## Visão Geral
O `Specifica-BR` é um conjunto de ferramentas projetado para padronizar, automatizar e facilitar o fluxo de trabalho de *Spec Driven Development* (SDD) focado no público brasileiro. Ele utiliza modelos de IA generativa (atualmente otimizado para OpenCode e GLM 4.7) para guiar o desenvolvimento desde a concepção da ideia até a execução do código.

## O Problema
Muitos desenvolvedores utilizam IAs de forma não estruturada ("zero-shot"), resultando em alucinações, perda de contexto e código que não atende aos requisitos de negócio. 

## A Solução (Workflow SDD)
O workflow baseia-se em etapas sequenciais, onde o output de uma etapa é o contexto obrigatório para a próxima:
1. **PRD (Product Requirement Document):** Define o negócio, o que será feito e o que NÃO será feito.
2. **Tech Spec:** Define a arquitetura, padrões, guidelines e o "como" será feito.
3. **Tasks:** Quebra o PRD e o Tech Spec em tarefas atômicas e isoladas (gerenciamento de janela de contexto).
4. **Execution:** Execução unitária de cada tarefa baseada nos documentos anteriores.

## Componentes do Ecossistema
1. **Specifica-BR CLI:** Um pacote NPM executado via terminal para fazer o scaffolding (setup inicial) da estrutura de diretórios e templates necessários para o workflow.
2. **Specifica-BR Editor Plugins (VS Code / JetBrains):** Ferramentas visuais que interpretam a estrutura de pastas do SDD, fazem o parse dos arquivos Markdown e orquestram a execução automatizada das tarefas comunicando-se com as ferramentas de IA subjacentes (como o OpenCode).

## Estrutura de Diretórios Padrão
O ecossistema depende e gerencia a seguinte estrutura dentro do projeto do usuário:
.opencode/commands/
  ├── gerar-prd.md
  ├── gerar-techspec.md
  ├── gerar-tasks.md
  └── executar-task.md
specs/templates/
  ├── prd.md
  ├── techspec.md
  ├── task.md
  └── tasks.md