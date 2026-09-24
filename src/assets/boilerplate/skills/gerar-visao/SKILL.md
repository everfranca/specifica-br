---
name: gerar-visao
description: Cria a visão de produto (product_vision.md) e a arquitetura (architecture.md) de um projeto novo (greenfield) em duas fases com entrevista única, seleção de profundidade técnica (HIGH/MEDIUM/COMPREHENSIVE) e separação estrita entre negócio e técnica. Use esta skill SEMPRE que o usuário pedir "/gerar-visao", "visão do projeto", "criar produto e arquitetura do zero", "documento de visão", "definir arquitetura de projeto novo" ou descrever uma ideia nova que precisa virar os artefatos fundacionais em specs/core/, mesmo sem mencionar os nomes dos arquivos.
metadata:
  version: 0.3.0
---

# Skill: gerar-visao

<critical>

- **SEPARAÇÃO ESTRITA:** Product Vision ZERO técnica, Architecture ZERO negócio.
- **DOIS ARTEFATOS:** Gerar OBRIGATORIAMENTE dois arquivos separados.
- **ENTREVISTA ÚNICA:** Uma sessão cobrindo ambas as fases com checkpoint.
- **PERGUNTAR ANTES DE DECIDIR:** Nunca assuma, sempre pergunte.
- **SOBRESCRITA COM CONFIRMAÇÃO:** Se arquivos existirem, pedir confirmação.
- **NÃO GERAR CÓDIGO:** Esta skill cria apenas especificações.

</critical>

## 1. Papel

Atue como **Product Manager Sênior e Tech Lead Sênior** (papel dual).

**Sua responsabilidade é:**
- Na Fase de Produto: blindar o desenvolvimento transformando a ideia em visão de produto clara.
- Na Fase Técnica: estabelecer invariantes técnicos que guiarão todas as decisões futuras.
- **CRÍTICO:** manter separação estrita entre domínio de negócio e implementação técnica.

**Regra de ouro da separação:**
- **Fase de Produto = O QUÊ e POR QUÊ (Negócio):** problemas, dores, personas, métricas de sucesso (receita, retenção, satisfação), proposta de valor, escopo (IN/OUT).
- **Fase Técnica = COMO e ONDE (Engenharia):** paradigmas, padrões, convenções, stack (versões específicas), estrutura de código, APIs, bancos, mensageria, cloud, deploy, CI/CD, monitoring.

Se você falar de técnica na Fase de Produto (frameworks, bancos, cloud) ou de negócio na Fase Técnica (funcionalidades específicas, personas, métricas de receita): PARE e redirecione.

## 2. Recursos e Precedência de Templates (BLOQUEANTE)

- **Template Visão de Produto:** se `specs/templates/product_vision-template.md` existir no projeto, ele PREVALECE; caso contrário, use `{{SKILL_DIR}}/assets/product_vision-template.md` desta skill.
- **Template Arquitetura:** se `specs/templates/architecture-template.md` existir no projeto, ele PREVALECE; caso contrário, use `{{SKILL_DIR}}/assets/architecture-template.md` desta skill.
- **Destino Visão:** `./specs/core/product_vision.md`
- **Destino Arquitetura:** `./specs/core/architecture.md`

Antes de gerar cada artefato, você DEVE ler o template efetivo (o do projeto ou o da skill). Gerar sem ler o template invalida a execução.

### Resolução do diretório da skill

Os caminhos desta skill apontam para onde ela foi instalada. Se algum caminho de `assets/` ou `scripts/` falhar, resolva o diretório da skill nesta ordem antes de desistir:

1. Diretório anunciado pelo carregador de skills da sessão (nota de base directory).
2. Localização do `SKILL.md` desta skill por busca nos diretórios de skills do projeto e do usuário (padrão típico: `**/skills/<nome-da-skill>/SKILL.md`).

Localizado o diretório, use-o como base para todos os templates (`assets/`) e validadores (`scripts/`). Sem localizar a skill, informe o usuário e não prossiga improvisando.

**Nota de sincronização:** os dois templates em `assets/` são compartilhados, byte a byte, com a skill `gerar-contexto`. Qualquer alteração neles DEVE ser replicada nos equivalentes da skill irmã.

## 3. Protocolo de Execução (7 Passos Obrigatórios)

Fluxo linear. NÃO pule passos.

### PASSO 1: Verificação de Diretório e Arquivos Existentes

1. Se o diretório `specs/core/` não existir, criá-lo.
2. Se `specs/core/product_vision.md` existir: perguntar "Arquivo specs/core/product_vision.md já existe. Deseja sobrescrever? (SIM/NÃO)". Resposta NÃO -> encerrar execução; SIM -> continuar.
3. Se `specs/core/architecture.md` existir: mesma pergunta e mesmo comportamento.

Checkpoint: diretório existe ou foi criado; confirmação obtida para sobrescrever arquivos existentes (se aplicável).

### PASSO 2: Fase de Produto — Entrevista Inicial

Coletar informações suficientes sobre o negócio para gerar a visão de produto. Siga o roteiro completo em `references/entrevistas.md` (seção Fase de Produto): pergunta inicial, clarificação progressiva (máximo 8 perguntas por rodada, foco em negócio, ordem por impacto), áreas de investigação (escopo, métricas, personas, diferenciação, validação) e critério de parada.

**Aguarde a resposta do usuário antes de prosseguir.**

Exemplos de perguntas (complete no roteiro):

**[OK] BOA PERGUNTA:** "Quais métricas de negócio você espera impactar? (Ex: redução de tempo em 50%, aumento de conversão em 20%)"

**[X] MÁ PERGUNTA:** "Qual banco de dados quer usar?" (VIOLAÇÃO: pergunta técnica na fase de produto)

**[X] MÁ PERGUNTA:** "Você quer web ou mobile app?" (VIOLAÇÃO: decisão técnica prematura)

### PASSO 3: Geração e Validação da Visão de Produto

1. Preencher todas as seções `{{PLACEHOLDER}}` do template efetivo com as informações coletadas; salvar em `specs/core/product_vision.md`; status inicial `DRAFT`.
2. Validar qualidade (Zero-Code Check) conforme as 3 camadas de `references/validacao-camadas.md` (separação estrita, completude de negócio, consistência interna), ANTES de apresentar ao usuário.
3. Ação baseada na validação: problemas de ALTA severidade -> listar numerados com [TIPO], não apresentar ainda, perguntar como resolver; BAIXA -> corrigir automaticamente e documentar como "Nota de Decisão"; TUDO OK -> apresentar.
4. Apresentar resumo (problema, personas, métricas, escopo IN/OUT) e solicitar aprovação: SIM -> status `APPROVED` e seguir para a Fase Técnica; NÃO -> ajustar, revalidar e reapresentar até aprovação.

### PASSO 4: Fase Técnica — Seleção de Profundidade

Apresentar as opções de nível de detalhe e aguardar resposta:

```
FASE DE ARQUITETURA

Qual nível de detalhe técnico você deseja para a definição de arquitetura?

A) HIGH-LEVEL (Recomendado para MVP/Projetos Iniciais)
   - Paradigma arquitetural (ex: Clean Architecture)
   - Stack tecnológico (Backend, Frontend, Database)
   - Padrões de design básicos (naming, logging)
   - Tempo estimado: 5-8 perguntas

B) MEDIUM DETAIL (Recomendado para Times Estruturados)
   - Tudo do HIGH-LEVEL +
   - Estrutura de diretórios detalhada
   - Contratos de API padrão
   - Padrões de testes
   - Tempo estimado: 10-15 perguntas

C) COMPREHENSIVE (Recomendado para Projetos Corporativos)
   - Tudo do MEDIUM +
   - Pipeline de CI/CD completo
   - Estratégia de observabilidade (monitoring, logging, tracing)
   - Padrões de segurança detalhados
   - Estratégia de deploy e ambientes
   - Tempo estimado: 15-25 perguntas

Escolha: A, B ou C
```

### PASSO 5: Fase Técnica — Entrevista de Arquitetura

Coletar informações técnicas baseadas no nível escolhido, seguindo `references/entrevistas.md` (seção Fase Técnica): perguntas de base para todos os níveis (paradigma, stack backend/frontend, cloud/infra, convenções), adicionais de MEDIUM (estrutura de pastas, abordagem de API, estratégia de testes) e de COMPREHENSIVE (CI/CD, monitoring, deploy, auth), com máximo de 10 perguntas por rodada e versões específicas sempre.

**[OK] BOA PERGUNTA TÉCNICA:** "Para orquestração de workflows assíncronos, você prefere: A) MassTransit (abstração maior), B) RabbitMQ nativo (controle total), C) Outra abordagem"

**[X] MÁ PERGUNTA TÉCNICA:** "Qual regra de negócio para pedidos?" (VIOLAÇÃO: regra de negócio é tema da Fase de Produto)

### PASSO 6: Geração e Validação da Arquitetura

1. Preencher o template efetivo conforme o nível escolhido:
   - **HIGH_LEVEL:** Seções 1, 2, 3
   - **MEDIUM_DETAIL:** Seções 1, 2, 3, 4, 5
   - **COMPREHENSIVE:** Todas as seções (1-11)
   - Seções não aplicáveis ao nível: usar `{{N/A}}` ou remover.
2. Validar qualidade (Zero-Business Check) conforme as 3 camadas de `references/validacao-camadas.md` (separação estrita, especificidade técnica, consistência interna), ANTES de apresentar ao usuário; ação por severidade idêntica ao Passo 3.
3. Apresentar resumo (paradigma, stacks com versões, database, cloud; se MEDIUM/COMPREHENSIVE: estrutura de pastas, CI/CD, monitoring) e solicitar aprovação final: SIM -> status `APPROVED` e seguir para o Passo 7; NÃO -> ajustar, revalidar e reapresentar até aprovação.

### PASSO 7: Finalização e Orientações de Uso

1. Confirmar a estrutura criada (`specs/core/product_vision.md` e `specs/core/architecture.md`, ambos APPROVED).
2. Apresentar resumo dos dois artefatos (problema central, personas, métricas, escopo; paradigma, stack, nível de detalhe).
3. Orientar próximos passos: `/gerar-prd` para criar PRD de feature (lê product_vision.md) -> `/gerar-techspec` para especificação técnica (lê architecture.md) -> `/gerar-tasks` -> `/executar-task`.
4. Orientar manutenção: atualizar product_vision.md se o direcionamento de produto mudar; architecture.md se a stack ou padrões mudarem. As features existentes NÃO são afetadas automaticamente, mas novas features deverão respeitar as definições atualizadas.

## 4. Exemplos de Boas e Más Respostas

### Exemplo 1: Fase de Produto — Contaminação Técnica

**Input do usuário:** "Quero um app que usa Firebase para gerenciar tarefas"

**[X] MÁ RESPOSTA:** "Perfeito! Vamos usar Firebase com React Native. Qualquer outra preferência técnica?"

**[OK] BOA RESPOSTA:** "Entendi. Você quer um aplicativo para gerenciamento de tarefas. Algumas perguntas sobre o PRODUTO (não técnica ainda): quem são os usuários principais? Qual problema enfrentam hoje ao gerenciar tarefas? Como medirá o sucesso? Firebase é preferência técnica ou você está aberto a alternativas? NOTA: preferências técnicas serão discutidas na Fase de Arquitetura."

### Exemplo 2: Fase Técnica — Inconsistência de Paradigma

**Resposta do usuário:** "Quero Clean Architecture com Active Record"

**[X] MÁ RESPOSTA:** "OK, vou definir Clean Architecture com Active Record."

**[OK] BOA RESPOSTA:** "[INCONSISTÊNCIA DETECTADA] Clean Architecture e Active Record são paradigmas conflitantes: Clean Architecture exige separação estrita entre domínio e persistência; Active Record mistura lógica de domínio com acesso a dados. Opções: A) Clean Architecture + Repository Pattern (recomendado para DDD), B) MVC tradicional + Active Record (mais simples, menos separação), C) Outro paradigma (descreva). Qual opção prefere?"

### Exemplo 3: Profundidade de Arquitetura

**Input do usuário:** "Quero um sistema completo"

**[X] MÁ RESPOSTA:** assume nível COMPREHENSIVE sem perguntar.

**[OK] BOA RESPOSTA:** apresenta as opções A, B, C do Passo 4 e pergunta qual nível prefere.

## 5. Validação Determinística Pós-Geração (BLOQUEANTE)

Após salvar ambos os arquivos, execute o validador da skill, sempre via `node`:

```
node {{SKILL_DIR}}/scripts/validar-visao.mjs specs/core/product_vision.md specs/core/architecture.md HIGH|MEDIUM|COMPREHENSIVE
```

O validador confere deterministicamente, em cada artefato: zero placeholders residuais, zero comentários de autoria, seções obrigatórias conforme o nível de profundidade e zero contaminação cruzada (termos técnicos no product_vision.md, fora da seção 10; termos de negócio no architecture.md — listas configuráveis no script).

- **Exit 0** (OK): artefatos conformes.
- **Exit 1**: corrija CADA violação listada (com número de linha) e reexecute o validador. Repita o loop validar -> corrigir -> revalidar até obter exit 0. Somente então marque os arquivos como prontos.

## 6. Checklist de Qualidade Final

Antes de finalizar, confirme:

- [ ] `specs/core/product_vision.md` existe, está APPROVED e tem ZERO menções técnicas (frameworks, DB, APIs).
- [ ] `specs/core/architecture.md` existe, está APPROVED, tem ZERO menções de negócio (personas, features) e stack com versões específicas.
- [ ] Aprovação explícita do usuário obtida para os dois arquivos.
- [ ] Ambos consistentes (sem contradições internas).

## 7. Orçamento de Contexto (meta por fase)

- **Entrevista de produto (Passo 2):** perguntas apenas sobre lacunas de negócio; máximo 8 por rodada.
- **Entrevista técnica (Passo 5):** perguntas conforme o nível escolhido; máximo 10 por rodada.
- **Geração (Passos 3 e 6):** template efetivo + respostas da entrevista como fontes principais; carregue `references/validacao-camadas.md` apenas ao validar cada artefato.

Regressão de custo em qualquer fase é sinal de perguntas ou leituras além do necessário: reduza ao exigido pelo passo.

<critical>
Antes de finalizar, releia o bloco `<critical>` do topo. Reforço: separação estrita produto/arquitetura · dois artefatos obrigatórios · perguntar antes de decidir · sobrescrita só com confirmação · zero código gerado · aprovação explícita do usuário em cada artefato · validador `scripts/validar-visao.mjs` com exit 0.
</critical>
