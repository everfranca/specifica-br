# Validação por Camadas (Produto e Arquitetura)

## Sumário

1. [Visão de produto: Zero-Code Check](#1-visão-de-produto-zero-code-check)
2. [Arquitetura: Zero-Business Check](#2-arquitetura-zero-business-check)
3. [Ação baseada em severidade](#3-ação-baseada-em-severidade)
4. [Matriz de decisão de separação estrita](#4-matriz-de-decisão-de-separação-estrita)

## 1. Visão de produto: Zero-Code Check

Execute as três camadas ANTES de apresentar o arquivo ao usuário.

### CAMADA 1: SEPARAÇÃO ESTRITA

Verifique se há contaminação técnica:

| Flag de Contaminação | Correção Obrigatória |
|:---|:---|
| Menção a frameworks/bibliotecas | Remover técnica, focar no "porquê" |
| Menção a banco de dados/APIs | Remover implementação, focar no "o quê" |
| Menção a cloud/deploy/infra | Remover infraestrutura, focar em resultado |
| Termos técnicos não traduzíveis | Explicar em linguagem de negócio |

### CAMADA 2: COMPLETUDE DE NEGÓCIO

Verifique se peças essenciais existem:

```
[ ] PROBLEMA CLARO
   - [ ] Situação observável descrita
   - [ ] Impacto no negócio definido
   - [ ] Causa raiz hipotetizada

[ ] PERSONAS DEFINIDAS
   - [ ] Perfis de usuários descritos
   - [ ] Dores e necessidades mapeadas

[ ] MÉTRICAS DE SUCESSO
   - [ ] Pelo menos 2 KPIs de negócio
   - [ ] Métricas são mensuráveis

[ ] ESCOPO DELIMITADO
   - [ ] IN-SCOPE claro
   - [ ] OUT-OF-SCOPE explícito
   - [ ] Fronteiras definidas

[ ] PROPOSTA DE VALOR
   - [ ] Benefício central identificado
   - [ ] Diferenciais competitivos claros
```

### CAMADA 3: CONSISTÊNCIA INTERNA

| Verificação | O que validar | Exemplo de Problema |
|:---|:---|:---|
| Persona <-> Escopo | Escopo cobre necessidades das personas? | Persona X precisa de Y mas Y é Out-of-Scope |
| Problema <-> Métrica | Métrica mede o problema? | Problema é "lento" mas métrica é "receita" |
| Proposta <-> Persona | Proposta resolve dores das personas? | Promete "fácil" mas persona é técnica |

## 2. Arquitetura: Zero-Business Check

Execute as três camadas ANTES de apresentar o arquivo ao usuário.

### CAMADA 1: SEPARAÇÃO ESTRITA

Verifique se há contaminação de negócio:

| Flag de Contaminação | Correção Obrigatória |
|:---|:---|
| Menção a funcionalidades específicas | Remover feature específica, focar em padrão |
| Menção a personas/usuários | Remover referências a personas |
| Menção a regras de negócio | Remover lógica de negócio, focar em técnica |
| Métricas de negócio (receita, conversão) | Substituir por métricas técnicas (latência, throughput) |

### CAMADA 2: ESPECIFICIDADE TÉCNICA

Verifique se termos são específicos:

| Flag de Vagueza | Correção Obrigatória |
|:---|:---|
| ".NET" (sem versão) | ".NET 8" ou versão específica |
| "PostgreSQL" (sem versão) | "PostgreSQL 15.x" |
| "banco SQL" | "PostgreSQL" ou "SQL Server" (específico) |
| "rápido" | "< 200ms p95" ou métrica técnica |

### CAMADA 3: CONSISTÊNCIA INTERNA

| Verificação | O que validar | Exemplo de Problema |
|:---|:---|:---|
| Paradigma <-> Stack | Stack é adequada ao paradigma? | Paradigma DDD mas anêmico, sem domínio rico |
| Backend <-> Frontend | Integração é viável? | Backend REST mas frontend GraphQL (sem adapter) |
| Database <-> Stack | ORM suporta DB escolhido? | Prisma mas SQL Server (suporte limitado) |
| Cloud <-> Stack | Stack roda na cloud escolhida? | .NET 8 mas AWS Lambda (suporte limitado) |

## 3. Ação baseada em severidade

**SE encontrar problemas de ALTA SEVERIDADE:**
- Listar problemas numerados com [TIPO]
- NÃO apresentar arquivo ao usuário ainda
- Perguntar como resolver

Exemplo:

```
[PROBLEMA ALTA] Detectado na validação:

1. [CONTAMINAÇÃO TÉCNICA] Seção 5 menciona "API REST"
   Impacto: Visão de produto não deve conter detalhes de implementação.
   Sugestão: Substituir por "Integração com sistemas externos" se for relevante para negócio.

Como proceder?
```

Exemplo técnico:

```
[PROBLEMA ALTA] Detectado na validação:

1. [INCONSISTÊNCIA] Paradigma escolhido é "Clean Architecture"
   mas stack inclui "Active Record" (viola separação de camadas).

   Impacto: Paradigma e padrão são conflitantes.

   Opções:
   A) Manter Clean Arch, remover Active Record
   B) Manter Active Record, mudar paradigma para "MVC tradicional"

   Como proceder?
```

**SE encontrar problemas de BAIXA SEVERIDADE:**
- Corrigir automaticamente
- Documentar como "Nota de Decisão" no final do arquivo
- Prosseguir para apresentação

**SE TUDO OK:**
- Prosseguir para apresentação e solicitação de aprovação

## 4. Matriz de decisão de separação estrita

| Pergunta | Fase de Produto | Fase Técnica |
|:---|:---|:---|
| "Quem são os usuários?" | SIM | NÃO |
| "Qual framework usar?" | NÃO | SIM |
| "Como medir sucesso?" | SIM (receita, retenção) | SIM (latência, uptime) |
| "Onde hospedar?" | NÃO | SIM |
| "Quais funcionalidades?" | SIM (escopo IN) | NÃO |
| "Como estruturar código?" | NÃO | SIM |

**Sinais de alerta:**
- Técnica na Fase de Produto (frameworks, bancos, APIs, cloud, containers, deploy) -> PARE e redirecione.
- Negócio na Fase Técnica (funcionalidades específicas, personas, métricas de receita) -> PARE e verifique se deve estar em product_vision.md (funcionalidades) ou substitua por métricas técnicas (latência).
