# Checklist Final e Exemplos de Inferências

## Sumário

1. [Checklist de qualidade final](#1-checklist-de-qualidade-final)
2. [Exemplos de boas e más inferências](#2-exemplos-de-boas-e-más-inferências)
3. [Notas de implementação](#3-notas-de-implementação)

## 1. Checklist de qualidade final

Antes de finalizar, confirme:

### Artefatos gerados
- [ ] `./specs/core/architecture.md` existe e está APPROVED
- [ ] `./specs/core/product_vision.md` existe e está DRAFT
- [ ] Diretório `specs/core/` criado (se não existia)

### Qualidade das inferências
- [ ] Todas as tecnologias detectadas têm nível de confiança
- [ ] Itens com confiança < 70% foram marcados [REVISAR]
- [ ] Itens [REVISAR] foram questionados no Passo 6 (se existirem)
- [ ] Paradigma arquitetural identificado com justificativa
- [ ] Bounded contexts mapeados (se aplicável)
- [ ] Integrações externas catalogadas
- [ ] Maturidade de testes avaliada

### Mapeamento técnico -> negócio
- [ ] Personas inferidas de aggregates/controllers
- [ ] Problema inferido de events/webhooks/errors
- [ ] Casos de uso inferidos de endpoints
- [ ] Métricas inferidas de monitoring/logging
- [ ] Escopo delimitado por bounded contexts
- [ ] Seção "Inferências do Código Legado" preenchida

### Validação de usuário
- [ ] architecture.md apresentado para aprovação rápida (2 min)
- [ ] Perguntas limitadas a itens baixa confiança (máx 6)
- [ ] Respostas incorporadas nas inferências finais
- [ ] Usuário informado sobre próximos passos

## 2. Exemplos de boas e más inferências

### Exemplo 1: Inferência de paradigma arquitetural

**Detectado no código:**

```
/src
  /Domain
    /Entities
      User.cs
      Order.cs
  /Application
    /Commands
      CreateOrderCommand.cs
  /Infrastructure
    /Persistence
      SqlUserRepository.cs
  /API
    /Controllers
      UsersController.cs (com método CalculateDiscount())
```

**[X] MÁ INFERÊNCIA:** "Paradigma: Clean Architecture perfeitamente implementado."

**[OK] BOA INFERÊNCIA:** "Paradigma: Clean Architecture (Confiança: 65%) — indicadores favoráveis: Domain/Application/Infrastructure separados; violações detectadas: UsersController.CalculateDiscount() (lógica em UI); conclusão: estrutura segue Clean Arch mas há violações locais (debt técnico)."

### Exemplo 2: Inferência de domínio de negócio

**Detectado no código:**

```
Stripe webhook em /api/webhooks/stripe
PaymentFailed event em background jobs
Retry logic em PaymentService
```

**[X] MÁ INFERÊNCIA:** "O sistema processa pagamentos."

**[OK] BOA INFERÊNCIA:** "Problema Central: Gestão de pedidos com pagamentos assíncronos (Confiança: 88%) — fontes: Stripe webhooks, PaymentFailed events, Retry logic; inferência: o sistema lida com processamento assíncrono, falhas de pagamento e reprocessamento, o que indica complexidade de consistência distribuída."

### Exemplo 3: Inferência de persona

**Detectado no código:**

```
UsersController (create, update, delete)
AdminsController (banUser, viewReports)
```

**[X] MÁ INFERÊNCIA:** "Usuários do sistema."

**[OK] BOA INFERÊNCIA:** "Personas: 1. Cliente Final (Confiança: 95%; fonte: UsersController com CRUD completo; ações: cria conta, gerencia perfil, faz pedidos). 2. Administrador (Confiança: 90%; fonte: AdminsController com métodos de ban/report; ações: gerencia usuários, visualiza relatórios, configura sistema)."

## 3. Notas de implementação

### Sistema de confiança
- Sempre atribuir % de confiança baseado em evidências concretas.
- 90-100%: evidência explícita (imports, configs, migrations).
- 60-89%: evidência indireta (estrutura, padrões).
- < 60%: inferência fraca (convenções, ausência de contradições).

### Abordagem iterativa
- **CRÍTICO:** gerar architecture.md PRIMEIRO, validar, depois product_vision.md.
- Não pular a validação rápida (2 min).
- Usuário pode interromper a qualquer momento.

### Máximo de perguntas
- **MÁXIMO 2 perguntas por categoria** (Domínio, Arquitetura, Stack).
- Total máximo: 6 perguntas.
- Apenas itens com confiança < 70%.
- Apenas itens com ALTO ou MÉDIO impacto.

### Separação de artefatos
- architecture.md: ZERO menções a funcionalidades de negócio.
- product_vision.md: ZERO menções a frameworks/bancos (exceto na seção 10 "Inferências do Código Legado", que é a ponte controlada com fonte técnica e confiança).
