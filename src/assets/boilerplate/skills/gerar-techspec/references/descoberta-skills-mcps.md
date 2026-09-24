<!-- INICIO BLOCO-DESC (CT-006): este bloco DEVE permanecer IDENTICO caractere a caractere em gerar-techspec.md e gerar-tasks.md. Qualquer alteracao aqui DEVE ser replicada no outro arquivo. -->

**Objetivo:** levantar o inventario de skills e MCPs disponiveis antes de produzir o artefato, de modo que capacidades ja instaladas deixem de ser ignoradas.

**Regra de dois escopos (obrigatoria):** a descoberta cobre obrigatoriamente PROJETO (raiz do repositorio atual) e GLOBAL (ambiente do usuario, fora do repositorio). Se um dos escopos nao produzir nenhum item, declare explicitamente "Escopo PROJETO vazio" ou "Escopo GLOBAL vazio" e prossiga.

**Escopo de projeto (relativo a raiz do repositorio, identico em todos os sistemas operacionais):**

| Ferramenta | Skills de projeto | Configuracao de MCP de projeto |
|:---|:---|:---|
| ClaudeCode | `.claude/skills/` | `.mcp.json`, `.claude/settings.json`, `.claude/settings.local.json` |
| Cursor | `.cursor/skills/` | `.cursor/mcp.json` |
| Gemini CLI | `.agents/skills/` | `.gemini/settings.json` |
| Kiro | `.kiro/skills/` | `.kiro/settings/mcp.json` |
| OpenCode | `.agents/skills/` | `opencode.json`, `opencode.jsonc` |
| Codex | `.agents/skills/` | `.codex/config.toml` |

**Escopo global (identifique o sistema operacional em execucao e use a coluna correspondente):**

| Ferramenta | Linux e macOS | Windows |
|:---|:---|:---|
| ClaudeCode | `~/.claude/skills/`, `~/.claude.json`, `~/.claude/settings.json` | `%USERPROFILE%\.claude\skills\`, `%USERPROFILE%\.claude.json`, `%USERPROFILE%\.claude\settings.json` |
| Cursor | `~/.cursor/skills/`, `~/.cursor/mcp.json` | `%USERPROFILE%\.cursor\skills\`, `%USERPROFILE%\.cursor\mcp.json` |
| Gemini CLI | `~/.agents/skills/`, `~/.gemini/settings.json` | `%USERPROFILE%\.agents\skills\`, `%USERPROFILE%\.gemini\settings.json` |
| Kiro | `~/.kiro/skills/`, `~/.kiro/settings/mcp.json` | `%USERPROFILE%\.kiro\skills\`, `%USERPROFILE%\.kiro\settings\mcp.json` |
| OpenCode | `~/.agents/skills/`, `$XDG_CONFIG_HOME/opencode/opencode.json` (padrao `~/.config/opencode/opencode.json`) | `%USERPROFILE%\.agents\skills\`, `%APPDATA%\opencode\opencode.json` |
| Codex | `~/.agents/skills/`, `~/.codex/config.toml` | `%USERPROFILE%\.agents\skills\`, `%USERPROFILE%\.codex\config.toml` |

**Ordem de fontes (obrigatoria):** a fonte PRIMARIA e o inventario de skills e de ferramentas MCP ja exposto a sessao pela ferramenta em uso (ex.: a listagem de skills disponiveis da sessao). Somente itens nao cobertos por ele sao buscados nos caminhos das tabelas acima; a busca em filesystem restringe-se EXATAMENTE a esses caminhos, consultados um a um, e e PROIBIDO varrer o sistema de arquivos ou executar glob a partir da raiz (`/` ou equivalente). Itens encontrados por ambas as fontes sao registrados uma unica vez.

**Campos obrigatorios por item encontrado:** nome, tipo (SKILL ou MCP), origem (PROJETO ou GLOBAL) e descricao/finalidade.

**Formato obrigatorio do inventario:**

| Nome | Tipo | Origem | Descricao |
|:---|:---|:---|:---|
| techspec-generator | SKILL | PROJETO | Gerador de especificacoes tecnicas |
| context7 | MCP | GLOBAL | Documentacao de bibliotecas e frameworks |

**Regras de deduplicacao e casos extremos:**
- Item presente em PROJETO e em GLOBAL: registrar uma unica linha com origem PROJETO e anotar a duplicidade na descricao.
- Item exposto a sessao sem caminho de filesystem correspondente: registrar com origem GLOBAL, salvo evidencia de que pertence ao repositorio atual.
- Se `HOME` ou `USERPROFILE` nao resolver, ou o diretorio nao existir: tratar como escopo global vazio e declara-lo explicitamente. Nao abortar.
- Ferramenta de IA sem capacidade de varredura de filesystem: a descoberta recai sobre o inventario exposto a sessao, e o escopo nao coberto e declarado vazio.

**Tratamento de erros (todos NAO bloqueantes):**
- CAMINHO_INEXISTENTE: o caminho da ferramenta nao existe no ambiente. Ignorar silenciosamente e prosseguir para o proximo caminho.
- ESCOPO_VAZIO: nenhum item encontrado em um dos escopos. Declarar explicitamente "Escopo PROJETO vazio" ou "Escopo GLOBAL vazio".
- INVENTARIO_INTEGRALMENTE_VAZIO: nenhum item em nenhum escopo. Prosseguir com a declaracao explicita de ausencia e justificativa no artefato gerado.

**PROIBIDO:** transcrever para qualquer artefato gerado credenciais, tokens, chaves de API ou valores de variaveis de ambiente encontrados nos arquivos de configuracao de MCP inspecionados. Registre exclusivamente o nome do servidor e sua finalidade.

**Neutralidade de ferramenta:** nenhuma etapa desta descoberta pode depender de uma unica ferramenta de IA. Os locais acima cobrem todas as ferramentas suportadas em pe de igualdade.

<!-- FIM BLOCO-DESC (CT-006) -->
