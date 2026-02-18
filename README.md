# Specifica-BR

Ferramenta de automação para desenvolvimento guiado por especificações (SDD) com IA. Otimizado para o ecossistema brasileiro.

## Sobre

O **Specifica-BR** é uma ferramenta de linha de comando (CLI) que automatiza o setup do workflow de Spec Driven Development (SDD), reduzindo o tempo de inicialização de minutos/horas para segundos.

## O que é Spec Driven Development (SDD)?

Spec Driven Development é uma metodologia de desenvolvimento que prioriza a documentação e especificação antes da escrita de código. Essa abordagem traz benefícios como:

- Documentação antes do código
- Redução de retrabalho
- Comunicação alinhada entre times
- Maior qualidade e manutenibilidade

## Instalação

Para instalar o Specifica-BR como uma ferramenta CLI global:

```bash
npm install -g specifica-br
```

Para usar como uma ferramenta local no projeto:

```bash
npm install --save-dev specifica-br
```

## Comandos Básicos

### `specifica init`

Inicializa a estrutura SDD no projeto atual.

```bash
specifica init
```

**O que faz:**
- Cria os diretórios `.opencode/commands` e `specs/templates`
- Copia os arquivos de templates necessários
- Guia você na seleção da ferramenta e modelo de IA
- Exibe informações sobre o workflow SDD

**Exemplo de uso:**
```bash
$ specifica init
Inicializando estrutura Spec Driven Development...

Selecione a ferramenta de IA:
❯ OpenCode

Selecione o modelo de IA:
❯ GLM 4.7

✓ Estrutura SDD criada com sucesso!
```

### `specifica help`

Exibe ajuda simplificada dos comandos disponíveis.

```bash
specifica help
```

**O que faz:**
- Lista todos os comandos disponíveis
- Mostra opções globais
- Sugere uso de `help --completo` para mais detalhes

### `specifica help --completo`

Exibe ajuda detalhada com o workflow completo de SDD.

```bash
specifica help --completo
```

**O que faz:**
- Mostra o fluxo completo de SDD em 5 passos
- Explica cada etapa do workflow
- Lista os benefícios do SDD

**Workflow SDD:**

1. **Inicialização:** Cria estrutura de diretórios e templates
2. **Geração de PRD:** Define requisitos funcionais e regras de negócio
3. **Geração de Tech Spec:** Define arquitetura técnica e plano de implementação
4. **Geração de Tarefas:** Decompõe o plano técnico em tarefas executáveis
5. **Execução de Tarefas:** Implementa cada tarefa seguindo a especificação

### `specifica upgrade`

Atualiza templates e comandos (em breve).

```bash
specifica upgrade
```

**Nota:** Este comando está em desenvolvimento e estará disponível em uma versão futura.

## Workflow SDD Completo

O workflow completo de Spec Driven Development é composto por 5 etapas:

### 1. Inicialização

```bash
specifica init
```

Cria a estrutura de diretórios e templates no projeto.

### 2. Geração de PRD

```bash
/gerar-prd [sua ideia]
```

Define requisitos funcionais e regras de negócio da feature.

### 3. Geração de Tech Spec

```bash
/gerar-techspec [caminho do prd]
```

Define arquitetura técnica, componentes e plano de implementação.

### 4. Geração de Tarefas

```bash
/gerar-tasks [caminho do prd] [caminho do tech spec]
```

Decompõe o plano técnico em tarefas executáveis.

### 5. Execução de Tarefas

```bash
/executar-task [caminho da task] [prd] [tech spec]
```

Implementa cada tarefa individualmente seguindo a especificação.

## Estrutura do Projeto

Após executar `specifica init`, a estrutura do projeto será:

```
seu-projeto/
├── .opencode/
│   └── commands/
│       ├── gerar-prd.md
│       ├── gerar-techspec.md
│       ├── gerar-tasks.md
│       └── executar-task.md
└── specs/
    └── templates/
        ├── prd-template.md
        ├── techspec-template.md
        ├── task-template.md
        └── tasks-template.md
```

## Opções Globais

- `-V, --version`: Exibe o número da versão
- `-h, --help`: Exibe ajuda para o comando

## Desenvolvimento

Para contribuir com o projeto:

```bash
# Instalar dependências
npm install

# Compilar o projeto
npm run build

# Executar em modo de desenvolvimento
npm run dev

# Executar o projeto
npm start
```

## Licença

ISC

## Suporte

Para mais informações, use:

```bash
specifica help --completo
```
