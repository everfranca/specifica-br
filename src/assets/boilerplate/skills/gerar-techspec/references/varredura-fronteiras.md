# Varredura de Fronteiras e Tabela de Contratos (Passo 2.5)

## Sumário

1. [Objetivo e definição de contrato](#1-objetivo-e-definição-de-contrato)
2. [Classificação de origem](#2-classificação-de-origem)
3. [As 8 fronteiras obrigatórias](#3-as-8-fronteiras-obrigatórias)
4. [Context7 e contratos de terceiros](#4-context7-e-contratos-de-terceiros)
5. [Tabela de resultado](#5-tabela-de-resultado)

## 1. Objetivo e definição de contrato

**Objetivo:** identificar TODO contrato que a feature toca, não importa se a outra ponta está neste repositório ou é um serviço de terceiros.

**O que é um contrato (uma frase):** o combinado das duas pontas — quem manda sabe o que enviar; quem recebe sabe o que chega e o que devolve. Formalmente: **fronteira + operação + schema de entrada + schema de saída + erros + origem**. Nada disso depende de saber qual biblioteca está instalada.

## 2. Classificação de origem

Obrigatória por contrato:

- **DESCOBERTO** — definição já existe no código/docs (com fonte `arquivo:linha`).
- **SOLICITADO** — não encontrada; usuário forneceu (Passo 4.4).
- **PROPOSTO** — proposta com base no PRD + padrões (justificada).

## 3. As 8 fronteiras obrigatórias

Rede de segurança contra omissão: para CADA fronteira abaixo, responda explicitamente *"esta feature toca? Evidência (`arquivo:linha`) ou `N/A`"*. Use os lembretes em linguagem simples para reconhecer cada uma:

| Fronteira | "É basicamente..." |
|:---|:---|
| **Client-Backend** | o JSON que o front manda no body de um `POST /pedidos` e a resposta que a API devolve (inclui CORS quando origens diferem) |
| **Backend-Database** | o `INSERT` que grava o pedido na tabela `orders` |
| **Backend-Message Broker** | o evento `PedidoCriado` que um serviço publica e outro fica escutando |
| **Backend-Cache** | guardar o catálogo no Redis por 5 min pra não bater no banco toda hora |
| **Backend-External Services** | chamar a API do Stripe pra cobrar — e o webhook que o Stripe manda de volta |
| **Backend-Storage** | subir a foto de perfil e receber de volta a URL do arquivo |
| **Backend-Search** | indexar o produto no buscador e a busca que devolve a lista de resultados |
| **Application-Environment** | a variável `DATABASE_URL` que o app precisa ter pra conseguir subir |

## 4. Context7 e contratos de terceiros

**Context7 (obrigatório quando disponível):** para todo serviço de terceiros e framework/lib envolvido, valide e enriqueça o contrato com a documentação oficial antes de escrever os schemas.

## 5. Tabela de resultado

Manter internamente ao longo da execução:

| ID | Fronteira | Contrato | Status | Origem |
|:---|:---|:---|:---|:---|
| CT-001 | Client-Backend | POST /api/v1/orders | Novo | PROPOSTO |
| CT-002 | Client-Backend | GET /api/v1/orders/{id} | Existente | DESCOBERTO (openapi.yml:42) |
| CT-004 | Backend-External | Stripe Payment Intent | Ausente | SOLICITADO |
| ENV-001 | App-Environment | STRIPE_SECRET_KEY | Ausente | SOLICITADO |
