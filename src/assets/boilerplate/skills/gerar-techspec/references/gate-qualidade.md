# Gate de Qualidade Canônico (Passo 5)

## Sumário

1. [Consistência interna](#1-consistência-interna)
2. [Ambiguidades técnicas](#2-ambiguidades-técnicas)
3. [Checklist de completude](#3-checklist-de-completude)
4. [Severidade e ação](#4-severidade-e-ação)

## 1. Consistência interna

Verifique cruzamentos e sinalize divergências:

| Verificação | Exemplo de problema |
|:---|:---|
| PRD × Invariantes | PRD "síncrono" mas projeto "event-driven" |
| PRD × Código | PRD assume `UserService` que não existe |
| Clarificação × Padrões | Resposta "EF Core" mas projeto usa Dapper |
| RF × RF | RF-001 "email obrigatório" × RF-005 "email opcional" |
| Contrato × Contrato | response de CT-001 diverge do payload de CT-010 |
| Contrato × Database | payload envia campo inexistente na tabela |
| Contrato × Environment | integração sem env var (CT Stripe sem STRIPE_SECRET_KEY) |

## 2. Ambiguidades técnicas

Troque termos vagos por valores precisos: "banco SQL" → "PostgreSQL 14+"; "resposta rápida" → "p95 < 200ms"; "logar erros" → "ERROR com userId, correlationId, errorCode".

## 3. Checklist de completude

Este é o Gate de Qualidade canônico da skill — Passos 3 e 6 apenas referenciam esta checklist:

```
[ ] ARQUITETURA: componentes definidos; camadas e direção de dependências respeitadas
[ ] DADOS: schemas completos (tipos específicos); relacionamentos; índices/constraints; migrations
[ ] CONTRATOS (todas as fronteiras da varredura do Passo 2.5):
    [ ] Client-Backend: endpoints com ID, schema, status codes, headers (+ CORS se aplicável)
    [ ] Backend-Database: operações com input/output/constraints/erros
    [ ] Backend-Message Broker: eventos publish e subscribe com payload + correlationId
    [ ] Backend-Cache: keys, TTL, invalidação (se aplicável)
    [ ] Backend-External Services: outbound e inbound com auth, rate limit, retry (se aplicável)
    [ ] Backend-Storage: operações, formatos, tamanho, acesso (se aplicável)
    [ ] Backend-Search: schemas de índice e query (se aplicável)
    [ ] Application-Environment: variáveis backend, frontend e secrets
    [ ] Toda fronteira tocada tem contrato; nenhum contrato sem origem (DESCOBERTO/SOLICITADO/PROPOSTO)
    [ ] Nenhum serviço de terceiros sem contrato; schemas consistentes entre fronteiras
[ ] LÓGICA: fluxo principal passo a passo; casos extremos; validações; tratamento de erros
[ ] SEGURANÇA: autenticação/autorização; dados sensíveis; criptografia; inputs sanitizados
[ ] OBSERVABILIDADE: logging (sem dados sensíveis, com correlationId); métricas; config
[ ] SKILLS/MCPS (Passo 3.5): descoberta nos dois escopos; escopo vazio declarado; itens pertinentes carregados; seção 9 preenchida; nenhuma credencial transcrita
[ ] NOVIDADES: cada lib/padrão novo justificado (por que os existentes não servem) + trade-offs
[ ] IMPLEMENTAÇÃO: plano modular; passos independentes viram tasks; ordem e dependências claras
[ ] IMPLEMENTABILIDADE: dev júnior implementa sem perguntas; artefatos concretos (arquivos, classes)
```

## 4. Severidade e ação

- **ALTA** (inconsistência lógica, violação de padrão fundamental, incompletude de arquitetura/dados/contratos, novidade não justificada, terceiro sem contrato, contrato sem origem): NÃO gerar; listar numerado e apresentar opções ao usuário.
- **MÉDIA** (ambiguidade, incompletude não-crítica): NÃO gerar ainda; oferecer auto-correção com aprovação.
- **BAIXA** (formatação, organização): auto-corrigir, documentar como Nota de Decisão, prosseguir.
- **ZERO problemas:** seguir para o Passo 6.
