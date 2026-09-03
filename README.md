<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/brand/readme-header-light.png">
  <img src="docs/assets/brand/readme-header-dark.png" alt="specifica-br — orquestrador CLI SDD pt-BR" width="600">
</picture>

[![Versão no npm](https://img.shields.io/npm/v/specifica-br?style=flat-square&label=npm&color=5FC9D6&labelColor=0B2E33)](https://www.npmjs.com/package/specifica-br)
[![Node.js](https://img.shields.io/node/v/specifica-br?style=flat-square&label=node&color=5FC9D6&labelColor=0B2E33)](https://nodejs.org)
[![Licença MIT](https://img.shields.io/npm/l/specifica-br?style=flat-square&label=licen%C3%A7a&color=5FC9D6&labelColor=0B2E33)](LICENSE)
[![Documentação](https://img.shields.io/badge/documenta%C3%A7%C3%A3o-github-5FC9D6?style=flat-square&labelColor=0B2E33)](https://github.com/everfranca/specifica-br#readme)

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
6. **Execução de Tarefas:** Implementa cada tarefa seguindo a especificação — individual (`/executar-task`) ou em lote (`specifica-br executar-tasks`)
7. **Code Review:** Realiza code review do código implementado

**Ferramentas de IA suportadas:**
- OpenCode
- ClaudeCode
- Cursor
- Gemini CLI
- Kiro

### `specifica-br executar-tasks`

Executa **em lote** todos os arquivos `task-*.md` de uma feature, invocando a CLI da ferramenta de IA uma vez por task, na ordem numérica, pulando as que já estão `DONE`.

```bash
specifica-br executar-tasks <diretório-da-feature> [opções]
```

O comando roda **a partir de qualquer diretório de qualquer projeto** e **não copia nenhum arquivo** para dentro do projeto. O único arquivo criado dentro do repositório é `contexto-execucao.md`, escrito pela própria ferramenta de IA; os arquivos de task nunca são modificados.

**Opções (todas com o valor padrão):**

| Opção | Padrão | Descrição |
|:---|:---|:---|
| `--tool <slug>` | detectado | Ferramenta de IA: `claudecode`, `cursor`, `gemini-cli`, `kiro`, `opencode` (sem distinção de caixa). Atualiza o registro do projeto. |
| `--model <modelo>` | `opus` | Modelo da ferramenta. |
| `--effort <nível>` | `medium` | `low`, `medium`, `high`, `xhigh`, `max`. |
| `--fallback-model <modelo>` | `''` | Modelo de fallback. |
| `--auto-approve` | `false` | Concede acesso total, sem prompts de permissão. |
| `--permission-mode <modo>` | `''` | `acceptEdits`, `auto`, `dontAsk`, `manual`, `bypassPermissions`. |
| `--no-skill-dirs` | dirs ligados | Não adiciona os diretórios de skills como `--add-dir`. |
| `--max-budget-usd <n>` | `0` | Teto de custo em USD (`0` desliga). Além do teto nativo por task, quando a ferramenta o oferece, o próprio comando verifica o custo acumulado entre as tasks, para qualquer ferramenta que reporte custo, e encerra o lote antes de iniciar a task que ultrapassaria o teto. |
| `--window-budget-tokens <n>` | `0` | Teto de tokens da janela de execução (`0` desliga). |
| `--stop-on-failure` | `false` | Interrompe o lote na primeira task com erro. |
| `--sleep <segundos>` | `0` | Pausa entre tasks. |
| `--no-cache-tuning` | ligado | Desliga a otimização de cache do prompt. |
| `--no-context-pack` | ligado | Não constrói nem injeta o Contexto de Execução. |
| `--context-injection <forma>` | `prompt` | Forma de injeção do Contexto de Execução: `prompt` concatena o destilado ao prompt da task; `instructions` declara o caminho do destilado na definição do agente de execução. Só tem efeito no OpenCode. |
| `--pack-model <modelo>` | `opus` | Modelo da construção do Contexto de Execução. |
| `--pack-effort <nível>` | `low` | Esforço da construção do Contexto de Execução. |
| `--pack-max-tokens <n>` | `8000` | Teto de tamanho do Contexto de Execução (`0` desliga o teto). |
| `--tasks <seleção>` | `''` | Seleção de tasks, ex.: `1-3,7`. |
| `--allow <regra>` | `[]` | Regra adicional de `--allowedTools` (repetível). |
| `--preflight` | `false` | Executa apenas as verificações prévias e encerra. |
| `--skip-preflight` | `false` | Pula as verificações prévias. |
| `--require-cmd <cmd>` | `[]` | Comando que deve existir no PATH (repetível). |
| `--mcp-timeout <seg>` | `15` | Timeout da verificação de MCPs. |
| `--no-mcp-check` | ligado | Não verifica os MCPs declarados no preflight. |
| `--dry-run` | `false` | Mostra o que seria executado sem invocar a CLI. Nenhuma chamada é feita — nem para as tasks, nem para construir o Contexto de Execução. Zero tokens gastos. |

**Onde ficam os registros:** em `~/.specifica-br/logs/<projeto>/`, com um arquivo de eventos (`run_<ID>.jsonl`) e um de erro (`run_<ID>.stderr`) por execução. **Nada é gravado dentro do projeto.**

**Identificação do projeto** (chaveia o registro da ferramenta e o diretório de logs), nesta ordem: (1) nome do repositório remoto `origin` do git; (2) nome do diretório raiz do repositório git; (3) nome do diretório de trabalho atual. O nome é sanitizado para `[A-Za-z0-9._-]` e truncado em 64 caracteres. Dois projetos de mesmo nome compartilham o diretório de registros.

**Layouts** (preferência por máquina, escolhida em `specifica-br config`):

| Layout | Descrição |
|:---|:---|
| `coluna` | Uma linha por task; o indicador de andamento vira o rótulo de estado ao terminar. É o padrão. |
| `moldura` | Cada task dentro de uma moldura, com os campos de início e de consumo destacados. |
| `regua` | Uma régua horizontal separando as tasks, com os mesmos campos de `coluna`. |
| `lote` | Visão condensada do lote inteiro. **Sem terminal interativo cai para `coluna`.** |

**Dependências externas obrigatórias:** a CLI da ferramenta de IA no PATH e o comando `/executar-task` instalado para ela (`specifica-br init`). **Nenhum utilitário de shell** — interpretador de comandos, processador de JSON, calculadora ou formatador de colunas — é exigido, em nenhum sistema operacional.

**Ferramentas com contrato de execução validado:** **ClaudeCode** e **OpenCode**. `cursor`, `gemini-cli` e `kiro` são reconhecidas e **recusadas com mensagem explícita** até que seus contratos sejam preenchidos em versões futuras.

**Como a ferramenta é resolvida**, nesta ordem: (1) `--tool`; (2) ferramenta registrada para o projeto; (3) detecção automática pelos diretórios do projeto; (4) escolha interativa. A ferramenta resolvida é gravada no registro do projeto. Para o OpenCode, a detecção reconhece tanto o diretório atual de comandos `.opencode/command/` quanto o diretório legado `.opencode/commands/`, criado por versões anteriores do `init`: um projeto no layout legado é detectado sem exigir migração, renomeação ou uso de `--tool`, e conta uma única vez ainda que os dois diretórios existam.

**Toda a saída nomeia a ferramenta efetivamente resolvida** — cabeçalho, avisos, erros, resumo e registros —, incluindo a versão da CLI dessa ferramenta. Nenhum texto fixo referente a uma ferramenta aparece quando outra está em uso.

**Capacidades por ferramenta:**

| Capacidade | ClaudeCode | OpenCode |
|:---|:---:|:---:|
| Execução não interativa | sim | sim |
| Modo sem prompt de permissão | sim | sim |
| Saída estruturada com contagem de tokens | sim | sim |
| Identificador de sessão | sim | sim |
| Injeção de contexto no system prompt | sim | sim |
| Liberação de diretórios de leitura | sim | não |
| Consulta aos MCPs | sim | sim |
| Relato de custo em USD | sim | sim |
| Teto de custo nativo | sim | não |
| Modelo de fallback | sim | não |
| Otimização de cache do prompt | sim | não |
| Relato de permissões negadas | sim | não |
| Forma de injeção selecionável | não | sim |

**Opções que dependem de capacidade ausente são recusadas com aviso nominal, e o lote prossegue** — nunca são ignoradas em silêncio e nunca causam aborto. Com OpenCode, `--no-skill-dirs`, `--fallback-model` e `--no-cache-tuning` produzem um aviso cada e as funcionalidades correspondentes ficam desativadas para a execução; nenhuma configuração de cache específica de outra ferramenta é repassada ao OpenCode. `--permission-mode` com modo sem equivalente também é recusado com aviso. Do outro lado, `--context-injection` informada para o ClaudeCode é recusada com aviso.

**Permissão durante o lote com OpenCode:** o lote opera com **permissão total**, sobrepondo deliberadamente as regras de permissão configuradas no projeto, inclusive negações explícitas. Sem isso, um projeto que negue a edição de arquivos faria todas as tasks falharem em escrever código. A sobreposição é **relatada nas verificações prévias**, nunca aplicada em silêncio, e vale apenas enquanto o lote executa: **nenhum arquivo é escrito dentro do projeto**, porque a permissão é entregue por um arquivo de apoio mantido em `~/.specifica-br/opencode/` e removido ao final. Regras adicionais informadas por `--allow` são traduzidas para o OpenCode quando têm equivalente, sempre como liberação e nunca como negação; a forma sem equivalente, como as regras de MCP, é recusada com aviso. Sobre `--permission-mode`: `bypassPermissions` é o comportamento padrão do lote e `acceptEdits` é tratado como permissão total sem aviso, porque em lote não há quem responda a uma pergunta. Não informar modo algum nem `--auto-approve` continua sendo ERRO no preflight.

**Teto de custo:** `--max-budget-usd` é verificado pelo próprio comando, antes de iniciar cada task, para **qualquer ferramenta que reporte custo**. Se o custo acumulado do lote já tiver ultrapassado o teto, a próxima task não é iniciada e o lote encerra com o motivo registrado como orçamento de custo. No ClaudeCode a trava nativa por task continua valendo, e essa verificação atua como rede de segurança adicional. Se a ferramenta reportar custo zero durante todo o lote, o resumo avisa uma única vez que o teto não teve efeito.

**Contexto de Execução no OpenCode:** a construção, o reaproveitamento, o teto de tamanho e `--no-context-pack` são os mesmos de qualquer ferramenta. Muda apenas a forma de entrega, escolhida por `--context-injection`: `prompt`, o padrão, concatena o destilado ao prompt da task e é funcionalmente garantida; `instructions` declara o caminho do destilado na definição do agente de execução e tende a preservar a economia de cache, reduzindo o custo por task. As duas entregam o mesmo conteúdo — a diferença observável está nos contadores de cache e no custo registrados, o que permite compará-las com a própria contabilidade da execução. A forma efetivamente usada aparece no cabeçalho. Com `--no-context-pack`, a opção não tem efeito e o cabeçalho exibe o Contexto de Execução como desligado.

**Tokens de raciocínio e permissões negadas no resumo:** o resumo traz um campo de tokens de raciocínio, somado ao total de tokens da execução; para ferramentas que não relatam esse dado, como o ClaudeCode, o campo aparece como `nao reportado`, nunca como zero. A mesma regra vale para permissões negadas: com OpenCode o campo aparece como `n/d`, e o comando nunca afirma que houve zero negações nem estima o número a partir de mensagens de erro.

**Contabilidade parcial:** se parte da saída estruturada de uma task for ilegível, a task é contabilizada com o que pôde ser lido e o comando avisa que a contabilidade pode estar subestimada, em vez de descartar a task ou zerar seus números.

### `specifica-br config`

Exibe e altera duas preferências gravadas em `~/.specifica-br/config.json`: o **layout** (preferência única por máquina, vale para todos os projetos) e a **ferramenta de IA** (registrada **por projeto**). O padrão de layout é `coluna`.

```bash
specifica-br config                       # exibe a configuração e abre a seleção de layout com pré-visualização dos quatro
specifica-br config layout <nome>         # grava o layout, sem interação
specifica-br config ferramenta <slug>     # grava a ferramenta do projeto atual, sem interação
```

Sem terminal interativo, `specifica-br config` sem argumentos apenas exibe a configuração vigente e encerra. **Não há configuração dentro do repositório do usuário**, nem opção de linha de comando para trocar o layout numa execução isolada.

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

O comando também cruza automaticamente as decisões registradas no PRD e na Tech Spec com os documentos CORE do projeto, antes do checkpoint de aprovação do plano de tarefas e sem exigir flag ou argumento adicional. São inspecionados quatro alvos: `specs/core/product_vision.md`, `specs/core/architecture.md`, `README.md` e o guia de agentes da raiz (`AGENTS.md` ou, quando ausente, `CLAUDE.md`). Cada diferença encontrada vira uma divergência identificada por `DIV-XXX`, com documento alvo, seção afetada, evidência citando o trecho de origem no PRD ou na Tech Spec e categoria. As divergências são classificadas em **EVOLUÇÃO**, quando o documento apenas omite a decisão, e **CONFLITO**, quando o documento afirma explicitamente algo incompatível com ela; os conflitos aparecem em destaque, no topo da lista. A aprovação é explícita e item a item, no mesmo checkpoint em que o plano de tarefas é submetido ao "DE ACORDO": divergência não aprovada não gera trabalho e nenhum documento é alterado durante a geração de tarefas. Havendo divergências aprovadas, é gerada uma única task de sincronização, acrescentada ao final da lista de tarefas, com uma sub-tarefa por documento impactado; sua execução edita apenas as seções divergentes e atualiza a linha **Data** dos documentos que possuem tabela de metadata. Projetos que não possuem documentos CORE seguem o fluxo sem etapa adicional, sem pergunta e sem erro.

### 6. Execução de Tarefas

```bash
/executar-task [caminho da task]
```

Implementa cada tarefa individualmente seguindo a especificação.

Para rodar todas as tasks de uma feature de uma vez, sem invocar a ferramenta de IA task a task manualmente, use a forma em lote:

```bash
specifica-br executar-tasks [diretório da feature]
```

Ela percorre os `task-*.md` na ordem numérica, pula os que já estão `DONE`, grava os registros em `~/.specifica-br/logs/<projeto>/` e não escreve nada dentro do projeto. Ver `specifica-br executar-tasks` em **Comandos Básicos** para todas as opções.

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
- `executar-tasks`: `--tool`, `--model` (`opus`), `--effort` (`medium`), `--fallback-model`, `--auto-approve`, `--permission-mode`, `--no-skill-dirs`, `--max-budget-usd` (`0`), `--window-budget-tokens` (`0`), `--stop-on-failure`, `--sleep` (`0`), `--no-cache-tuning`, `--no-context-pack`, `--context-injection` (`prompt`), `--pack-model` (`opus`), `--pack-effort` (`low`), `--pack-max-tokens` (`8000`), `--tasks`, `--allow`, `--preflight`, `--skip-preflight`, `--require-cmd`, `--mcp-timeout` (`15`), `--no-mcp-check`, `--dry-run` — ver a tabela completa em **Comandos Básicos**
- `config [chave] [valor]`: sem argumentos exibe a configuração e abre a seleção de layout; `config layout <nome>` e `config ferramenta <slug>` gravam sem interação

## Desenvolvimento

### Requisitos

- Node.js 18 ou superior
- npm 8 ou superior
- Git

### Setup

```bash
git clone https://github.com/everfranca/specifica-br.git
cd specifica-br
npm install
```

### Scripts npm

| Script | O que faz |
|:---|:---|
| `npm run build` | Compila o TypeScript para `dist/`, copia os assets e adiciona o shebang ao ponto de entrada |
| `npm run dev` | Compila e executa a CLI a partir de `dist/` |
| `npm start` | Executa a CLI já compilada |
| `npm run build:tests` | Compila o projeto e a suíte de testes (`tsconfig.test.json`) |
| `npm test` | Compila e roda os testes no runner nativo do Node, com cobertura |
| `npm run test:watch` | Roda os testes em modo watch |
| `npm run copy:assets` | Copia `src/assets/` para `dist/` |
| `npm run add:shebang` | Insere o shebang em `dist/index.js` |

### Testes

A suíte usa o runner nativo do Node (`node --test`), sem framework externo. Os arquivos ficam em `tests/`, espelhando a estrutura de `src/`.

```bash
npm test

# Um arquivo específico
node --test tests/utils/nome-do-servico.test.js

# Filtrando por nome do teste
node --test --test-name-pattern="descrição do teste" "tests/**/*.test.js"
```

### Estrutura de `src/`

```
src/
├── commands/          # Comandos da CLI
├── utils/             # Funções e serviços utilitários
│   ├── terminal/      # Primitivas de terminal (cor, glifo, banner, spinner)
│   ├── layouts/       # Estratégias dos layouts de exibição
│   └── tool-adapters/ # Adapters de capacidades por ferramenta de IA
├── types/             # Definições de tipos TypeScript
├── assets/            # Arquivos estáticos incluídos no pacote (templates, boilerplate, JSON)
└── index.ts           # Ponto de entrada principal
```

Arquivos estáticos precisam ser acessados por caminho relativo ao pacote instalado (`__dirname`, `path.resolve()`), nunca por caminhos que só existem no ambiente de desenvolvimento. As demais diretrizes de estilo, nomenclatura e idioma estão em [AGENTS.md](AGENTS.md).

## Publicação

### Os dois READMEs

O repositório mantém dois READMEs versionados, para dois públicos diferentes:

| Arquivo | Público | Conteúdo |
|:---|:---|:---|
| `README.md` (raiz) | GitHub | Documentação completa: workflow, todos os comandos e opções, arquitetura, desenvolvimento e publicação |
| `docs/README.npm.md` | npm | Versão enxuta: pitch, instalação, quick start, comandos resumidos e link para o GitHub |

O npm sempre publica o `README.md` da raiz do pacote, ignora o campo `files` para esse arquivo e renderiza apenas ele na página do registry — não há como apontar o npm para outro arquivo. Por isso os dois são trocados automaticamente durante o empacotamento.

**O README exibido na página do npm é gerado a partir de `docs/README.npm.md`.** Alterações destinadas ao registry devem ser feitas nesse arquivo; editar o `README.md` da raiz não muda a página do npm.

### O mecanismo de swap

O script [`scripts/swap-readme.js`](scripts/swap-readme.js) é Node puro, sem dependências e sem chamadas de shell, portanto funciona igual em Windows, Linux e macOS. Ele tem dois modos:

```bash
node scripts/swap-readme.js --npm       # guarda o README do GitHub em .readme-github.bak.md e aplica o do npm
node scripts/swap-readme.js --restore   # restaura o README do GitHub e remove o backup
```

Os dois modos estão ancorados no ciclo de vida do npm:

```json
"prepack": "node scripts/swap-readme.js --npm",
"postpack": "node scripts/swap-readme.js --restore"
```

`prepack` e `postpack` são o par correto porque cobrem os dois comandos que geram tarball:

- `npm publish` executa `prepublishOnly`, `prepack`, `prepare`, `postpack`, `publish`, `postpublish`
- `npm pack` executa `prepack`, `prepare`, `postpack`

`prepublishOnly` não serve para restaurar, por não rodar no `npm pack`, e `prepare` também roda em `npm install` local, o que dispararia o swap fora de hora. Como o `postpack` roda depois do tarball já estar montado e antes do envio, o pacote publicado leva a versão npm do README e o repositório volta ao estado original.

O backup `.readme-github.bak.md` é ignorado pelo Git.

### Recuperação de swap travado

Se o empacotamento falhar entre `prepack` e `postpack`, o `postpack` não roda e o `README.md` da raiz fica com a versão do npm, com o backup ainda presente. O script detecta esse estado: uma nova execução de `--npm` é recusada, para não sobrescrever o backup legítimo com o README errado.

Para sair desse estado:

```bash
node scripts/swap-readme.js --restore
git status
```

Se o backup tiver sido perdido e o `README.md` da raiz estiver com a versão do npm, recupere pelo Git:

```bash
git checkout -- README.md
rm -f .readme-github.bak.md
```

### Verificando antes de publicar

```bash
npm pack
tar -tf specifica-br-<versão>.tgz
```

O tarball deve conter apenas `dist/**/*`, `package.json`, `README.md` e `LICENSE` — sem `scripts/`, sem `docs/` e sem o backup. Após o `npm pack`, `git status` precisa ficar limpo.

## Licença

MIT

## Suporte

Para mais informações, use:

```bash
specifica-br help --completo
```
