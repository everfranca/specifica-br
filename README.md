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

### `specifica-br init`

Inicializa a estrutura SDD no projeto atual.

```bash
specifica-br init
```

**O que faz:**
- Permite selecionar a convenção de diretórios (OpenCode ou Specifica-BR)
- Cria os diretórios de comandos e templates baseados na seleção
- Se OpenCode for selecionado, guia na escolha da ferramenta e modelo de IA
- Copia os arquivos de templates necessários
- Exibe informações sobre o workflow SDD

**Exemplo de uso:**
```bash
$ specifica-br init
Inicializando estrutura Spec Driven Development...

Selecione a convenção de diretórios para comandos:
❯ Recomendado (OpenCode)
  Agnóstico (Specifica-BR)

Selecione a ferramenta de IA:
❯ OpenCode

Selecione o modelo de IA:
❯ GLM 4.7

✓ Estrutura SDD criada com sucesso!
```

### `specifica-br help`

Exibe ajuda simplificada dos comandos disponíveis.

```bash
specifica-br help
```

**O que faz:**
- Lista todos os comandos disponíveis
- Mostra opções globais
- Sugere uso de `help --completo` para mais detalhes

### `specifica-br help --completo`

Exibe ajuda detalhada com o workflow completo de SDD.

```bash
specifica-br help --completo
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

### `specifica-br upgrade`

Atualiza a CLI para a versão mais recente do NPM.

```bash
specifica-br upgrade
```

#### Requisitos

- **npm instalado:** O comando npm deve estar disponível no sistema
- **Permissões:** Dependendo do sistema operacional, pode ser necessário executar com permissões elevadas

#### Instruções por Plataforma

**Windows:**

- Execute o comando normalmente
- Se receber erro de permissão, clique com botão direito no terminal/CMD e selecione "Executar como administrador"
- Alternativamente, abra PowerShell como administrador e execute o comando

**Linux:**

- Execute o comando normalmente
- Se receber erro de permissão, use `sudo`:
  ```bash
  sudo specifica-br upgrade
  ```

**MacOS:**

- Execute o comando normalmente
- Se receber erro de permissão, use `sudo`:
  ```bash
  sudo specifica-br upgrade
  ```

#### Exemplos

**Atualização bem-sucedida:**

```bash
$ specifica-br upgrade

Verificando instalação do npm...

✓ npm encontrado.

Atualizando specifica-br para a versão mais recente...
Executando: npm i -g specifica-br@latest

[output do npm]

✓ specifica-br atualizado com sucesso!
```

**Erro de permissão no Windows:**

```bash
$ specifica-br upgrade

✗ Permissão negada.
Execute como administrador (clique com botão direito > Executar como administrador)
```

**Erro de permissão no Linux/MacOS:**

```bash
$ specifica-br upgrade

✗ Permissão negada.
Execute: sudo specifica-br upgrade
```

**npm não encontrado:**

```bash
$ specifica-br upgrade

✗ npm não encontrado.
Instale Node.js e npm em: https://nodejs.org
```

#### Logs

Em caso de erro, um log detalhado será gerado no diretório `/logs` do pacote, com formato `log_yyyy_MM_dd_hh_mm_ss.txt`. O caminho completo do log será exibido na mensagem de erro.

**Caminhos de Log por Plataforma:**

- **Windows:** `C:\Users\[usuario]\AppData\Roaming\npm\node_modules\specifica-br\logs\log_2026_02_18_14_30_15.txt`
- **Linux/MacOS:** `/usr/local/lib/node_modules/specifica-br/logs/log_2026_02_18_14_30_15.txt` (ou caminho semelhante, dependendo da instalação)

## Sistema de Notificações de Atualização

A CLI `specifica-br` verifica automaticamente se há atualizações disponíveis no NPM durante a execução dos comandos habilitados.

### Como Funciona

1. Ao executar um comando habilitado (ex: `init`, `help`, `upgrade`), a CLI verifica se existe uma versão mais recente no NPM
2. A verificação é assíncrona e não afeta o tempo de execução do comando
3. Se uma nova versão estiver disponível, uma notificação será exibida ao final do output
4. Funciona em Windows, Linux e MacOS

### Notificação de Atualização

Quando uma nova versão estiver disponível, você verá uma mensagem como esta:

```
 Update disponível 

1.0.0 → 1.1.0

Run specifica-br upgrade (em algum projeto)
Run npm i -g specifica-br para atualizar
```

### Comandos que Exibem Notificações

Por padrão, os seguintes comandos verificam atualizações:
- `init` - Inicializa estrutura SDD
- `help` - Exibe informações de ajuda
- `upgrade` - Atualiza a CLI

**Nota:** A lista de comandos pode ser configurada editando o arquivo `settings.json`.

### Configuração de Comandos Habilitados

Você pode configurar quais comandos da CLI devem verificar atualizações editando o arquivo de configuração.

#### Arquivo de Configuração

O arquivo `settings.json` está localizado no diretório `assets` do pacote.

**Caminho por Plataforma:**

- **Desenvolvimento:** `src/assets/settings.json` (no diretório do projeto)
- **Instalação Global:**
  - **Windows:** `C:\Users\[usuario]\AppData\Roaming\npm\node_modules\specifica-br\dist\assets\settings.json`
  - **Linux:** `/usr/local/lib/node_modules/specifica-br/dist/assets/settings.json`
  - **MacOS:** `/usr/local/lib/node_modules/specifica-br/dist/assets/settings.json`

#### Estrutura do Arquivo

```json
{
  "enabledUpgradeCommands": ["init", "help", "upgrade"]
}
```

#### Modificando a Configuração

**Para habilitar verificação em um comando:**

Adicione o nome do comando ao array `enabledUpgradeCommands`:

```json
{
  "enabledUpgradeCommands": ["init", "help", "upgrade", "generate"]
}
```

**Para desabilitar verificação em um comando:**

Remova o nome do comando do array `enabledUpgradeCommands`:

```json
{
  "enabledUpgradeCommands": ["init", "help"]
}
```

**Para desabilitar todas as verificações:**

Use um array vazio:

```json
{
  "enabledUpgradeCommands": []
}
```

#### Editando o Arquivo de Configuração

**Windows (PowerShell):**
```powershell
notepad "C:\Users\[usuario]\AppData\Roaming\npm\node_modules\specifica-br\dist\assets\settings.json"
```

**Windows (CMD):**
```cmd
notepad "C:\Users\[usuario]\AppData\Roaming\npm\node_modules\specifica-br\dist\assets\settings.json"
```

**Linux/MacOS (Nano):**
```bash
nano /usr/local/lib/node_modules/specifica-br/dist/assets/settings.json
```

**Linux/MacOS (Vim):**
```bash
vi /usr/local/lib/node_modules/specifica-br/dist/assets/settings.json
```

**Nota:** Dependendo de como o npm está configurado, o caminho de instalação pode variar. Execute `npm root -g` para verificar o caminho global de node_modules no seu sistema.

#### Fallback

Se o arquivo `settings.json` não for encontrado ou estiver inválido, a CLI usará a configuração padrão:
```json
{
  "enabledUpgradeCommands": ["init", "help", "upgrade"]
}
```

### Compatibilidade

Este sistema funciona nativamente em todos os sistemas operacionais:
- ✅ Windows (10, 11)
- ✅ Linux (Ubuntu, Debian, Fedora, etc.)
- ✅ MacOS (todas as versões suportadas pelo Node.js)

## Workflow SDD Completo

O workflow completo de Spec Driven Development é composto por 5 etapas:

### 1. Inicialização

```bash
specifica-br init
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

Após executar `specifica-br init`, a estrutura do projeto depende da convenção selecionada:

**Se opção 1 (OpenCode) for selecionada:**

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

**Se opção 2 (Specifica-BR) for selecionada:**

```
seu-projeto/
├── specifica-br/
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

MIT

## Suporte

Para mais informações, use:

```bash
specifica-br help --completo
```
