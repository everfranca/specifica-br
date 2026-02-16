# Specifica-BR CLI

Um utilitário de linha de comando para inicializar o fluxo de trabalho de *Spec Driven Development* (SDD) focado em IA em seus projetos.

## O que é?
O `Specifica-BR CLI` automatiza a criação de toda a estrutura de diretórios e arquivos de configuração (templates e comandos) necessários para orquestrar agentes de IA (como OpenCode e GLM 4.7) na geração de documentação de produto, especificações técnicas e tarefas isoladas.

## Instalação

``` bash
npm install -g specifica-br-cli
```

## Como usar
Navegue até o diretório raiz do seu projeto e execute:

``` bash
specifica init

```

O comando irá gerar automaticamente a seguinte estrutura em seu repositório:

 - `.opencode/commands/`: Contém as instruções para a IA gerar os artefatos.
 - `specs/templates/`: Contém os modelos base para o PRD, Tech Spec e Tarefas.

## Fluxo de Trabalho (OpenCode)
Após inicializar o projeto, ative o OpenCode e utilize os seguintes comandos sequencialmente em seu terminal:

1. `/gerar-prd [sua ideia]`
2. `/gerar-techspec [caminho do prd]`
3. `/gerar-tasks [caminho do prd] [caminho do tech spec]`
4. `/executar-task [caminho da task] [prd] [tech spec]`

## Contribuição
Focado em desenvolvedores brasileiros. Comentários, issues e Pull Requests são bem-vindos!