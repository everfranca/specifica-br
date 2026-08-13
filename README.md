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

## Comandos Básicos

### `specifica-br init`

Instala os comandos e skills SDD no **diretório global** da ferramenta de IA e cria os templates no projeto atual.

```bash
specifica-br init            # instalação global (padrão)
specifica-br init --local    # instala tudo dentro do projeto atual
```

**O que faz:**
- Permite selecionar **uma ou mais** ferramentas de IA (OpenCode, ClaudeCode, Cursor, Gemini CLI, Kiro)
- Instala os 7 comandos e as 2 skills no diretório global de cada ferramenta — basta rodar uma vez por máquina, e eles ficam disponíveis em todos os projetos
- Cria os 7 templates em `specs/templates/` **no projeto**, por serem artefatos versionáveis do SDD
- Detecta instalações antigas dentro do projeto (`.claude/commands/`, `.opencode/command/`, `.agents/skills/`, etc.) e oferece removê-las, evitando comandos duplicados
- Exibe informações sobre o workflow SDD

**Opções:**

| Opção | Descrição |
|:---|:---|
| `--local` | Instala comandos e skills dentro do projeto atual, em vez do diretório global. Reproduz o comportamento das versões anteriores. |

**Exemplo de uso:**
```bash
$ specifica-br init
Inicializando estrutura Spec Driven Development...

Selecione as ferramentas de IA (espaço para marcar, enter para confirmar):
◉   ClaudeCode
◯   Cursor
◯   Gemini CLI
◯   Kiro
◯   OpenCode

ℹ Instalação global — os seguintes diretórios serão criados:

  Comandos:
    • ~/.claude/commands/ (ClaudeCode)
  Skills:
    • ~/.claude/skills/ (ClaudeCode)
  Templates:
    • specs/templates (ClaudeCode)

  Os templates continuam no projeto, em specs/templates/.

[?] Deseja continuar? Yes

ℹ Instalação antiga do specifica-br encontrada neste projeto:

  .claude/commands (7 item(ns))

[?] Remover a instalação antiga do projeto? Yes

✓ Estrutura SDD criada com sucesso!
```

> Ao marcar Gemini CLI e OpenCode juntos, as skills são gravadas uma única vez: as duas
> ferramentas compartilham `~/.agents/skills/`.

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
- Mostra o fluxo completo de SDD em 7 passos
- Explica cada etapa do workflow
- Lista as ferramentas de IA suportadas
- Lista os benefícios do SDD

**Workflow SDD:**

1. **Inicialização:** Cria estrutura de diretórios e templates
2. **Definição do Contexto:** Escolha baseada no tipo de projeto
   - **Projeto Novo (Green Field):** Use `/gerar-visao` - Define Fundação (Contexto + Stack) - Role: Product Manager + Tech Lead - Foco: Visão macro
   - **Projeto em Desenvolvimento (Brown Field):** Use `/gerar-contexto` - Analisa código e INFERE (Contexto + Stack) - Role: Engenheiro Senior + Arquiteto - Foco: Análise automática
3. **Geração de PRD:** Define requisitos funcionais e regras de negócio
4. **Geração de Tech Spec:** Define arquitetura técnica e plano de implementação
5. **Geração de Tarefas:** Decompõe o plano técnico em tarefas executáveis
6. **Execução de Tarefas:** Implementa cada tarefa seguindo a especificação
7. **Code Review:** Realiza code review do código implementado

**Ferramentas de IA suportadas:**
- OpenCode
- ClaudeCode
- Cursor
- Gemini CLI
- Kiro

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

O workflow completo de Spec Driven Development é composto por 7 etapas:

### 1. Inicialização

```bash
specifica-br init
```

Instala os comandos e skills no diretório global da ferramenta de IA (uma vez por máquina)
e cria os templates em `specs/templates/` no projeto. Use `--local` para instalar tudo
dentro do projeto atual.

### 2. Definição do Contexto

Escolha o comando baseado no tipo do seu projeto:

**Projeto Novo (Green Field):**
```bash
/gerar-visao [sua ideia]
```

Define a Fundação do projeto (Contexto + Stack Tecnológica).
- **Role:** Product Manager + Tech Lead
- **Foco:** Visão macro e estratégica
- **Resultado:** `specs/core/product_vision.md` (visão de negócio) e `specs/core/architecture.md` (arquitetura técnica)

**Projeto em Desenvolvimento (Brown Field):**
```bash
/gerar-contexto
```

Analisa o código existente e INFERE o contexto.
- **Role:** Engenheiro Senior + Arquiteto
- **Foco:** Análise automática do código base
- **Resultado:** `specs/core/product_vision.md` (inferida do código) e `specs/core/architecture.md` (com níveis de confiança)

### 3. Geração de PRD

```bash
/gerar-prd [sua ideia]
```

Define requisitos funcionais e regras de negócio da feature.

### 4. Geração de Tech Spec

```bash
/gerar-techspec [caminho do prd]
```

Define arquitetura técnica, componentes e plano de implementação.

Antes da entrevista técnica, o comando levanta o inventário de skills e MCPs disponíveis nos escopos de projeto e global, carrega os itens pertinentes e os utiliza na elaboração do documento. A Tech Spec gerada contém a seção `9. Skills e MCPs Utilizados`, que registra nome, tipo (SKILL ou MCP), origem (PROJETO ou GLOBAL), situação e quais seções ou decisões cada item embasou. Quando nenhum item é aplicável, a seção registra a ausência com justificativa.

### 5. Geração de Tarefas

```bash
/gerar-tasks [caminho do prd] [caminho do tech spec]
```

Decompõe o plano técnico em tarefas executáveis.

O comando executa sua própria varredura de skills e MCPs, independente da Tech Spec, e seleciona por relevância os itens pertinentes a cada task. Cada arquivo de task gerado contém a seção `9. Skills e MCPs`, com os itens rastreáveis por checkbox e cinco campos obrigatórios por item: nome, tipo (SKILL ou MCP), origem (PROJETO ou GLOBAL), motivo da seleção e passos do plano de execução em que o item deve ser aplicado. Quando nenhum item é aplicável à task, a seção registra a ausência com justificativa.

### 6. Execução de Tarefas

```bash
/executar-task [caminho da task]
```

Implementa cada tarefa individualmente seguindo a especificação.

Antes de qualquer implementação, o comando carrega as skills e verifica os MCPs declarados na seção 9 da task. Um item indisponível não interrompe a execução: o comando informa a indisponibilidade, registra o fato e prossegue. Ao final, as Notas de Execução da task recebem a evidência de uso, com cada item declarado classificado em uma de três situações: CARREGADO E UTILIZADO, CARREGADO E NAO UTILIZADO (com justificativa) ou INDISPONIVEL. O registro completo é condição para marcar a task como concluída.

### 7. Code Review

```bash
/realizar-codereview
```

Realiza code review do código implementado.

## Estrutura do Projeto

A partir da versão 1.6, comandos e skills ficam no **diretório global do usuário** — instalados uma única vez por máquina — e apenas os templates ficam no projeto.

**Estrutura do projeto após `specifica-br init`:**

```
seu-projeto/
└── specs/
    └── templates/
        ├── prd-template.md
        ├── techspec-template.md
        ├── task-template.md
        ├── tasks-template.md
        ├── architecture-template.md
        ├── product_vision-template.md
        └── codereview-template.md
```

**Diretórios globais por ferramenta e sistema operacional:**

| Ferramenta | Comandos (Linux/macOS) | Comandos (Windows) | Skills (Linux/macOS) | Skills (Windows) |
|:---|:---|:---|:---|:---|
| ClaudeCode | `~/.claude/commands/` | `%USERPROFILE%\.claude\commands\` | `~/.claude/skills/` | `%USERPROFILE%\.claude\skills\` |
| Cursor | `~/.cursor/commands/` | `%USERPROFILE%\.cursor\commands\` | `~/.cursor/skills/` | `%USERPROFILE%\.cursor\skills\` |
| Gemini CLI | `~/.gemini/commands/` | `%USERPROFILE%\.gemini\commands\` | `~/.agents/skills/` | `%USERPROFILE%\.agents\skills\` |
| Kiro | `~/.kiro/commands/` | `%USERPROFILE%\.kiro\commands\` | `~/.kiro/skills/` | `%USERPROFILE%\.kiro\skills\` |
| OpenCode | `$XDG_CONFIG_HOME/opencode/command/` (padrão `~/.config/opencode/command/`) | `%APPDATA%\opencode\command\` | `~/.agents/skills/` | `%USERPROFILE%\.agents\skills\` |

`~` e `%USERPROFILE%` correspondem a `/home/usuario` (Linux), `/Users/usuario` (macOS) e `C:\Users\usuario` (Windows 10/11).

**Estrutura no projeto com `--local`:**

Com `specifica-br init --local`, comandos e skills voltam para dentro do projeto, nos diretórios relativos equivalentes:

```
seu-projeto/
├── .opencode/
│   └── command/
│       ├── gerar-prd.md
│       ├── gerar-techspec.md
│       ├── gerar-tasks.md
│       ├── executar-task.md
│       ├── gerar-contexto.md
│       ├── gerar-visao.md
│       └── realizar-codereview.md
├── .agents/
│   └── skills/
│       ├── product-manager/
│       │   └── SKILL.md
│       └── techspec-generator/
│           └── SKILL.md
└── specs/
    └── templates/
```

**Comandos disponíveis (7):**
1. `/gerar-prd` - Gera Product Requirements Document
2. `/gerar-techspec` - Gera Especificação Técnica
3. `/gerar-tasks` - Gera lista de tarefas
4. `/executar-task` - Executa uma tarefa específica
5. `/gerar-contexto` - Gera contexto do projeto
6. `/gerar-visao` - Gera visão estratégica
7. `/realizar-codereview` - Realiza code review

**Skills disponíveis (2):**
1. `product-manager` - Skill especializada para criar PRDs, definindo requisitos funcionais, regras de negócio e critérios de aceitação
2. `techspec-generator` - Skill especializada para criar Tech Specs, definindo arquitetura técnica, componentes e plano de implementação

**Templates disponíveis (7):**
1. `prd-template.md` - Template de PRD
2. `techspec-template.md` - Template de Tech Spec
3. `task-template.md` - Template de Task
4. `tasks-template.md` - Template de Tasks
5. `architecture-template.md` - Template de Arquitetura/Contexto
6. `product_vision-template.md` - Template de Visão de Produto
7. `codereview-template.md` - Template de Code Review

## Opções Globais

- `-V, --version`: Exibe o número da versão
- `-h, --help`: Exibe ajuda para o comando

## Opções por Comando

- `init --local`: Instala comandos e skills no projeto atual em vez do diretório global

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
