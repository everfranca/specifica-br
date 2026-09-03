# Contexto de Execução — {{FEATURE_NAME}}

<!--
ARTEFATO DERIVADO. NÃO EDITE À MÃO.
Gerado a partir do PRD, da Tech Spec e do architecture.md.
A próxima execução do loop sobrescreve este arquivo.

Em caso de divergência entre este arquivo e um documento-fonte,
O DOCUMENTO-FONTE VENCE, sempre.
-->

## 0. Proveniência

| Fonte | Caminho | Data do arquivo na geração |
|:---|:---|:---|
| PRD | {{PRD_PATH}} | {{PRD_MTIME}} |
| Tech Spec | {{TECHSPEC_PATH}} | {{TECHSPEC_MTIME}} |
| Architecture | {{ARCHITECTURE_PATH}} | {{ARCHITECTURE_MTIME}} |

| Metadado | Valor |
|:---|:---|
| **Gerado em** | {{DATA_GERACAO}} |
| **Feature** | {{FEATURE_NAME}} |
| **Tamanho** | {{CONTRATOS_N}} contratos, alvo {{ALVO_TOKENS}} tokens, estimado {{EST_TOKENS}} tokens - {{DENTRO_OU_ACIMA}} |

<!--
A linha Tamanho e OBRIGATORIA. alvo = 3.500 + 1.200 por contrato da secao 1.1;
teto = alvo x 1,3. Declare ACIMA quando for o caso: quem executa o loop mede o
arquivo, e uma declaracao falsa e pior que nenhuma.
-->

---

## 1. Invariantes (VERBATIM)

<!--
Tudo nesta seção é COPIADO caractere a caractere da fonte.
É PROIBIDO parafrasear, reformular, traduzir, abreviar, "limpar" ou
normalizar qualquer valor aqui. Um regex reescrito em prosa vira bug.
Toda linha traz a referência de origem entre parênteses.
-->

### 1.1 Contratos e schemas

{{CONTRATOS}}

<!--
Uma entrada por contrato que a feature expõe ou consome. Formato:

#### CT-001 — Emissao de credencial de aplicacao (techspec.md secao 4.1)
- Entrada: `{ "client_id": string, "client_secret": string, "grant_type": string }`
- Saida: `{ "access_token": string, "expires_in": number, "token_type": "Bearer" }`
- Regra de formato: `client_id` casa `^[a-z0-9]{1,128}$`
- Status codes: 200, 400, 401, 429, 503

O QUE o codigo precisa satisfazer, nunca COMO chegar la. Passo a passo,
ordem de execucao e plano de trabalho pertencem a task, nao aqui.
Proibido numero de linha (`arquivo.ts:284-344`): envelhece no primeiro commit.
Cite arquivo e simbolo. Sem contrato de fronteira, escreva
`Nenhum contrato de fronteira.`
-->

### 1.2 Códigos de erro

{{CODIGOS_DE_ERRO}}

<!--
A lista FECHADA e COMPLETA, na grafia exata da fonte. Nunca "entre outros",
nunca reticências. Se a lista for longa, ela continua sendo copiada inteira:
uma enumeração incompleta é pior que ausente.
-->

### 1.3 Stack e versões

{{STACK}}

<!--
Linguagem, runtime, frameworks e bibliotecas com as VERSÕES EXATAS.
Inclui onde as versões são centralizadas, se houver.
-->

### 1.4 Regras de código proibitivas

{{REGRAS_PROIBITIVAS}}

<!--
O que o projeto PROÍBE, na formulação da fonte (AGENTS.md, architecture.md,
techspec.md). Ex.: proibido `var`; proibido comentário explicativo em produção;
proibido adicionar dependência nova; TreatWarningsAsErrors=true.
-->

### 1.5 Fronteiras de camada

{{FRONTEIRAS}}

<!--
Quem pode referenciar quem, e o que é proibido atravessar.
Ex.: Domain nao referencia Infrastructure; Application nao conhece HTTP.
-->

---

## 2. Mapa de consulta

<!--
Ponteiros para o que NÃO coube nas invariantes. O executor abre o arquivo
apenas quando a task exigir um assunto listado aqui.
-->

| Assunto | Onde está |
|:---|:---|
{{MAPA}}

<!--
Formato de linha:
| decisao de resiliencia e retry | architecture.md secao 11 |
| criterios de aceite do RF-004  | prd.md secao 5.2 |
-->

---

## 3. Lacunas conhecidas

<!--
O que o gerador NÃO conseguiu extrair, e por quê. O executor trata todo
assunto listado aqui como "abrir a fonte obrigatoriamente".
Se não houver lacuna, escrever exatamente: Nenhuma lacuna identificada.
-->

{{LACUNAS}}

---

Template Version: 0.1.0
