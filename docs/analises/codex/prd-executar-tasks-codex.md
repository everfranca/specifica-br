# Entrada de PRD — Integração Codex no `executar-tasks`

| Metadado | Valor |
|:---|:---|
| **Documento** | Levantamento de entrada para o PRD da feature |
| **Data** | 11/09/2026 |
| **Escopo** | Comando `specifica-br executar-tasks` com a ferramenta Codex |
| **Estado** | Decisões de produto registradas; PRD a ser redigido |
| **Documentos irmãos** | `docs/analises/codex/techspec-executar-tasks-codex.md` (embasamento técnico) |
| **Fontes** | `docs/integracoes/inventario-ferramentas.md`, documentação oficial do Codex CLI e código-fonte da CLI (via MCP `context7`) |

---

## 1. Contexto e problema

O `specifica-br` distribui artefatos de SDD para seis ferramentas, e o Codex já recebe
skills e templates desde as Fases 1 e 2 (`tools-mapping.json` tem entrada "Codex").
O comando `executar-tasks`, no entanto, só executa o lote de tasks com duas delas
(ClaudeCode e OpenCode). O usuário que escolhe Codex como harness vive uma experiência
incompleta: consegue gerar PRD, TechSpec e tasks, mas precisa executar cada `task-N.md`
manualmente, sem contabilidade de tokens, sem evidências de sessão, sem preflight e sem
o Contexto de Execução destilado.

**Causa raiz:** não existe um adapter Codex registrado no `tool-registry.ts` com contrato
de execução validado.

**Objetivo:** que `specifica-br executar-tasks --tool codex` execute o lote completo de
uma feature com paridade de experiência razoável em relação às duas ferramentas já
suportadas.

## 2. Motivações de negócio

1. **Fechar a lacuna fim-a-fim do SDD para usuários Codex.** Hoje o produto promete
   automação de Spec Driven Development, mas para o Codex entrega apenas a metade de
   geração de artefatos. A execução em lote é onde está o ganho de produtividade
   (múltiplas tasks sem supervisão), e é justamente ela que falta.
2. **Ampliar o alcance de mercado do comando mais valioso do produto.** De seis
   ferramentas mapeadas, duas têm contrato validado. Cada adapter novo multiplica o
   público endereçado sem novo esforço de aquisição.
3. **Aderência de perfil.** O modo não-interativo do Codex (`codex exec`) é desenhado
   para pipelines e CI — o mesmo público e o mesmo caso de uso do `executar-tasks`
   (lote, não-interativo, saída estruturada, evidências). A integração segue o caminho
   natural da ferramenta, não contra ele.
4. **Entrada com contrato parcial honesto.** A matriz de 13 capacidades já prevê
   degradação controlada por capacidade (`ajustarPorCapacidades`). O Codex entra com 8
   de 13 capacidades ligadas — o mecanismo de degradação existe e foi escrito para
   este cenário.
5. **Aproveitamento de investimento existente.** O padrão de agregação de NDJSON
   (necessário para ler a saída do Codex) já foi construído para o adapter OpenCode.
   O custo incremental por capacidade destravada é baixo.

## 3. Decisões de produto já tomadas

| # | Decisão | Registro |
|:---|:---|:---|
| D-01 | Codex terá prioridade de implementação sobre Gemini CLI | Inverte a ordem sugerida pela seção 7.1 do inventário de ferramentas |
| D-02 | Custo em USD não reportado pelo Codex: aceitar `n/d` | Sem emulação por tabela de preços; ver regra de negócio RN-01 |
| D-03 | Forma de entrega do prompt: preferir stdin (`codex exec -`) | A investigação confirmou três formas viáveis (posicional, stdin, skill `$nome`); a posicional é aceitável como fallback, mas tem limites operacionais documentados na TechSpec |

## 4. Regras de negócio derivadas

- **RN-01 — Orçamento em USD:** quando o usuário informar `--max-budget-usd` com
  `--tool codex`, o comando deve emitir aviso nominal explicando que a CLI não reporta
  custo em USD e que o teto não será aplicado — nunca silêncio, nunca erro. O relatório
  de custo acumulado exibe `n/d` por task e no total do lote.
- **RN-02 — Escrita de arquivos:** a execução de task exige permissão de escrita no
  workspace. Sem configuração explícita de sandbox, o Codex executa em modo somente
  leitura e a task não produz alterações. O comando deve mapear os modos de permissão
  existentes para os modos de sandbox do Codex de forma que o comportamento padrão
  preserve o que o usuário já conhece das outras ferramentas.
- **RN-03 — Projetos fora de Git:** o Codex exige repositório Git para executar. O
  preflight deve reprovar com mensagem clara antes de consumir tokens, em vez de deixar
  a primeira task falhar no meio do lote.

## 5. Escopo sugerido

### 5.1. Dentro do escopo

- Adapter Codex com contrato validado (`contratoValidado: true`) no `tool-registry`.
- Execução de task com saída JSONL, contabilidade de tokens e identificador de sessão.
- Contexto de Execução injetado por concatenação ao prompt.
- Preflight: versão da CLI, autenticação, repositório Git, MCPs declarados.
- Suporte a Windows, Linux e macOS.

### 5.2. Fora do escopo

- Emulação de custo em USD (tabela de preços por modelo).
- Teto de custo nativo, modelo de fallback e otimização de cache de prompt
  (capacidades não suportadas pela CLI).
- Retomada de sessão (`codex exec resume`) como fluxo do comando — o identificador é
  registrado nas evidências, mas a retomada manual fica por conta do usuário.

## 6. Riscos de negócio

| Risco | Impacto | Mitigação |
|:---|:---|:---|
| Relatórios de tokens parecem inflados (cached input dominante contado com peso integral) | Médio — expectativa do usuário | Documentar no guia; manter a régua igual às outras ferramentas |
| Usuários em Windows sem permissão de administrador podem não conseguir o sandbox mais forte | Médio — suporte degradado | Documentar modos de sandbox do Windows; preflight orientar |
| Teto de orçamento inoperante pode gerar surpresa de consumo em contas API-key | Médio | Aviso nominal RN-01 |
| Superfície de flags do `codex exec` em evolução rápida | Alto — manutenção | Fixar piso de versão da CLI e validar contrato contra a versão documentada |

## 7. Itens em aberto para o PRD

| ID | Questão | Impacto |
|:---|:---|:---|
| TBD-001 | Destino do quinto contador `reasoning_output_tokens` (soma em output, `n/d`, ou novo campo) — decisão compartilhada com a pendência equivalente do OpenCode | Médio |
| TBD-002 | Critério de auto-detecção de projeto Codex (sem diretório de commands exclusivo, a detecção colide com OpenCode/Gemini em `.agents/skills/`) | Médio |
| TBD-003 | Skills do Codex: confirmar se o diretório hoje mapeado (`.agents/skills/`) é lido pela CLI, ou se exige `~/.codex/skills` | Alto — pode indicar lacuna na distribuição atual das Fases 1/2 |
