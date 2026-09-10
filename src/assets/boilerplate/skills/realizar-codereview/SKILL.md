---
name: realizar-codereview
description: Faz code review de uma branch, arquivo, fluxo completo ou codebase inteiro e gera relatório estruturado com findings classificados por severidade, evidência obrigatória (arquivo:linha) e veredito derivado dos findings, sem alterar nenhuma linha de código. Use esta skill SEMPRE que o usuário pedir "/realizar-codereview", "code review", "revisar código", "revisar branch", "revisar PR", "auditoria de código" ou analysis técnica de código antes de um merge, mesmo sem usar o termo "code review".
metadata:
  version: 0.3.0
---

# Skill: realizar-codereview

<critical>

- **ZERO-ALTERAÇÃO**: NÃO ESCREVA, MODIFIQUE OU CRIE NENHUM CÓDIGO.
- **ANÁLISE INDEPENDENTE**: Não aceite comentários ou documentação como verdade absoluta. Verifique o código real.
- **EVIDÊNCIA OBRIGATÓRIA**: Todo finding DEVE ter localização precisa (arquivo:linha) e código de exemplo.
- **SEVERIDADE EXPLÍCITA**: Cada problema DEVE ser classificado como CRITICAL, HIGH, MEDIUM ou LOW com justificativa.
- **VEREDITO BASEADO EM FATOS**: O status final (APROVADO/RESSALVAS/REPROVADO) DEVE ser derivado dos findings, não de opinião.
- **TEMPLATE OBRIGATÓRIO**: Use ESTRITAMENTE o template do relatório (precedência na Seção 2). NÃO altere sua estrutura.
- **PORTUGUÊS**: Todo output em português. Sem emojis.

</critical>

## 1. Definição de Papel

Atue como um **Tech Lead Sênior e Code Reviewer Especialista**. Sua responsabilidade é analisar código de forma rigorosa e evidence-based, identificando problemas de funcionalidade, arquitetura, segurança, performance, testes e documentação, sugerir melhorias com opções de correção e fornecer veredito claro com pré-condições acionáveis.

## 2. Recursos e Precedência de Template (BLOQUEANTE)

- **Template do Relatório**: se `specs/templates/codereview-template.md` existir no projeto, ele PREVALECE; caso contrário, use `assets/codereview-template.md` desta skill.
- **Contexto do Projeto**: `AGENTS.md` (para validar padrões).
- **Especificações (opcional)**: PRD e TechSpec da feature, se disponíveis.
- **Código a Analisar**: definido pelo escopo (branch, arquivo, flow, all).
- **Context7**: use para documentação de frameworks/bibliotecas quando necessário.

Antes de gerar o relatório, você DEVE ler o template efetivo (o do projeto ou o da skill). Gerar sem ler o template invalida a execução.

## 3. Protocolo de Execução (Passos Obrigatórios)

### PASSO 1: Identificação do Escopo

#### 1.1 Detecção do Modo
Analise o input do usuário para identificar automaticamente o modo de operação:

- **Branch completa**: `git diff main...HEAD` (PR review)
- **Arquivo/Diretório**: caminho específico informado
- **Fluxo completo**: PRD + TechSpec + código (validação de feature)
- **Aplicação inteira**: todo o codebase (auditoria)

#### 1.2 Confirmação do Escopo (INTERATIVO)

**NOTIFIQUE o usuário sobre o escopo detectado** e confirme usando a ferramenta de perguntas da sessão (por exemplo, `question`):

```
Pergunta: "Escopo detectado: [MODO]. Confirma ou deseja alterar?"
Cabecalho: "Confirmação de Escopo"
Opções:
- "Sim, prosseguir" - Continuar análise com o escopo detectado: [MODO]
- "Branch completa" - Revisão completa da branch atual (git diff main...HEAD)
- "Arquivo/Diretório" - Revisão específica de um arquivo ou diretório
- "Fluxo completo" - Validação completa de feature (PRD + TechSpec + código)
- "Aplicação inteira" - Auditoria técnica de todo o codebase
Escolha única.
```

**PROCESSAMENTO DA ESCOLHA**:

- Se o usuário escolher "Sim, prosseguir": continue com o escopo detectado inicialmente.
- Se o usuário escolher outra opção:
  - "Branch completa" ou "Aplicação inteira": prossiga diretamente com esse escopo.
  - "Arquivo/Diretório": SOLICITE ao usuário que digite o caminho do arquivo ou diretório.
  - "Fluxo completo": SOLICITE ao usuário que digite o nome da feature (para localizar PRD + TechSpec + código).

APENAS após confirmação explícita do usuário, prossiga para:

#### 1.3 Detalhamento do Escopo
Para o escopo confirmado:
1. Liste todos os arquivos que serão analisados.
2. Identifique especificações aplicáveis (PRD, TechSpec).
3. Defina fronteiras (o que está dentro/fora do escopo).

### PASSO 2: Análise Sistemática por Dimensão
Para cada uma das 6 dimensões, analise TODO o código do escopo:

**A. Funcionalidade e Lógica**
- Atende aos requisitos (PRD/User Story)? Se não há PRD, verifica lógica coerente.
- Trata casos de borda? (null, empty, limits, edge cases)
- Trata erros adequadamente? (try/catch, logs úteis)

**B. Arquitetura e Qualidade**
- Legível? (nomes semânticos, estrutura clara)
- Segue princípios? (DRY, SRP, não reinventar a roda)
- Simples? (poderia ser mais direto)

**C. Segurança**
- Vulnerabilidades? (SQL injection, XSS, autenticação)
- Valida input? (sanitize, validate)
- Expõe credenciais? (API keys, passwords hardcoded)

**D. Performance**
- Ineficiente? (loops desnecessários, algoritmo pesado)
- Otimiza queries? (N+1, missing indexes)
- Gerencia recursos? (memory leaks, connections abertas)

**E. Testes e Confiabilidade**
- Presença de testes? (unitários, integração, e2e)
- Eficácia? (cobrem cenários críticos, não apenas caminho feliz)

**F. Documentação e Governança**
- Comentários úteis? (explicam porquê, não o quê)
- Atualiza docs? (README, API docs, env vars)

### PASSO 3: Estruturação dos Findings
Para cada problema encontrado:

1. **Localizar com precisão**: `arquivo.ext:linhas`
2. **Classificar severidade**:
   - **CRITICAL**: Bloqueia merge (segurança, crash, dado corrompido)
   - **HIGH**: Deve corrigir (bugs, performance severa)
   - **MEDIUM**: Boa prática (code smell, antipattern)
   - **LOW**: Sugestão (estilo, micro-otimização)

3. **Gerar finding no formato compacto**:
   ```markdown
   ### [F-XXX] Título curto
   `arquivo.ext:linhas` | **SEVERIDADE** | Dimensão

   **Problema**: 1-2 frases sobre impacto e consequências

   **Código atual**:
   ```linguagem
   // 3-6 linhas do código problemático
   ```

   **Correção recomendada**:
   ```linguagem
   // Código corrigido
   ```
   *Por que*: Benefício principal em 1 frase

   **Alternativas**:
   - Opção 2: breve descrição - quando usar
   - Opção 3: breve descrição - quando usar
   ```

4. **Documentar pontos positivos**: liste boas práticas encontradas.

### PASSO 4: Determinação do Veredito
Baseado nos findings, determine o status:

**CRITÉRIOS PARA REPROVADO**:
- 1+ findings CRITICAL
- Ausência total de testes em feature complexa
- Vulnerabilidade de segurança não tratada

**CRITÉRIOS PARA APROVADO COM RESSALVAS**:
- 0 CRITICAL
- 1-3 findings HIGH (devem ser documentados)
- Testes parciais (cobrem caminho feliz mas não edge cases)
- Documentação aceitável mas não completa

**CRITÉRIOS PARA APROVADO**:
- 0 CRITICAL, 0-2 HIGH
- Testes adequados ao escopo
- Documentação suficiente
- Segurança adequada

O veredito DEVE incluir:
- Justificativa baseada nos findings (não opinião)
- Pré-condições específicas para merge (checkbox)
- Recomendações gerais (não técnica)

### PASSO 5: Geração do Relatório
1. Carregue o template efetivo (precedência na Seção 2).
2. Para cada seção {{PLACEHOLDER}}:
   - Substitua pelo resultado da análise correspondente.
   - Siga ESTRITAMENTE a estrutura do template.
   - NÃO altere a ordem ou nome das seções.
   - NÃO omita seções obrigatórias.

3. Valide antes de finalizar:
   - [ ] Todos os {{PLACEHOLDERS}} foram preenchidos
   - [ ] Findings seguem formato compacto
   - [ ] Cada finding tem localização (arquivo:linha)
   - [ ] Cada finding tem código atual + correção recomendada
   - [ ] Veredito tem justificativa clara
   - [ ] Pré-condições são acionáveis (checkbox)
   - [ ] Zero emojis, texto em português

### PASSO 6: Validação Determinística e Apresentação

Após gerar o relatório, execute o validador da skill, sempre via `node`:

```
node scripts/validar-codereview.mjs <caminho-do-relatorio>
```

O validador confere deterministicamente: zero placeholders residuais, todas as seções do template presentes, todo finding [F-XXX] com localização arquivo:linha e severidade rotulada, e veredito com status + justificativa + pré-condições.

- **Exit 0** (OK): apresente o relatório completo ao usuário.
- **Exit 1**: corrija CADA violação listada e reexecute. Repita o loop validar -> corrigir -> revalidar até obter exit 0 antes de apresentar.

Na apresentação:
- Destaque findings CRITICAL e HIGH.
- Clarifique pré-condições para merge.

## 4. Exemplos de Boas e Más Práticas

### Exemplo 1: Finding Bom
```markdown
### [F-001] SQL Injection em busca de usuários
`src/repositories/UserRepository.ts:78` | **CRITICAL** | Segurança

**Problema**: Concatenação de input permite injeção de SQL malicioso, expondo dados do banco.

**Código atual**:
```typescript
const query = `SELECT * FROM users WHERE name LIKE '%${name}%'`;
return this.db.query(query);
```

**Correção recomendada**:
```typescript
const query = `SELECT * FROM users WHERE name LIKE $1`;
return this.db.query(query, [`%${name}%`]);
```
*Por que*: Parametrização previne injeção independente do input

**Alternativas**:
- Query Builder: Para queries complexas e dinâmicas
- ORM TypeORM: Se já usa ORM no projeto, prefira sintaxe ORM
```

### Exemplo 2: Finding Ruim
```markdown
### Problema de SQL Injection
O código tem SQL injection. Arrumar usando prepared statements.
```
Falta: localização, código, exemplo de correção, severidade.

### Exemplo 3: Veredito Bom
```markdown
**Status**: APROVADO COM RESSALVAS

**Justificativa**:
1 finding crítico (SQL injection) bloqueia o merge. Os 3 findings altos podem ser tratados em follow-up, mas F-002 (tratamento de erro) é recomendável corrigir antes. Código está bem estruturado e segue padrões do projeto.

**Pré-condições para merge**:
- [ ] **Obrigatório**: Corrigir F-001 (SQL injection) - bloqueador de segurança
- [ ] **Recomendado**: Corrigir F-002 (tratamento de erro) - risco de crash em produção
- [ ] **Recomendado**: Otimizar F-003 (N+1 queries) - performance afeta UX
```

### Exemplo 4: Veredito Ruim
```markdown
O código precisa melhorar. Tem alguns problemas de segurança.
```
Falta: status específico, referência a findings, pré-condições claras.

## 5. Matriz de Escopos e Modos

| Modo | Input | Output | Quando Usar |
|:---|:---|:---|:---|
| **Branch** | `git diff main...HEAD` | Review de PR | Antes de merge |
| **Arquivo** | `path/to/file.ts` | Review específico | Revisão pontual |
| **Flow** | PRD + TechSpec + código | Validação completa | Pós-implementação |
| **All** | Todo codebase | Auditoria técnica | Health check |

<critical>
- **VERIFICAÇÃO FINAL**: Antes de finalizar, confirme:
- [ ] Template foi seguido ESTRITAMENTE
- [ ] Todos os findings têm evidências (código)
- [ ] Veredito é derivado dos findings, não opinião
- [ ] Pré-condições são acionáveis (não vagas)
- [ ] Validador da skill executado com exit 0
- [ ] Zero emojis em qualquer parte do relatório
- [ ] Zero alterações de código (análise somente leitura)
</critical>
