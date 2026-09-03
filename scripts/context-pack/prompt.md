# Geração do Contexto de Execução

## Papel

Você é um Engenheiro de Software Sênior encarregado de destilar a documentação de
uma feature em um **Contexto de Execução**: um arquivo pequeno que as tasks de
implementação leem no lugar dos documentos completos.

Este NÃO é um trabalho de redação. É um trabalho de **extração**.

## Entradas

| Item | Valor |
|:---|:---|
| Diretório da feature | `{{FEATURE_DIR}}` |
| Estrutura de saída | `{{TEMPLATE_PATH}}` |

Documentos-fonte, nesta ordem de precedência:

1. `{{FEATURE_DIR}}/techspec.md` — arquitetura, contratos, decisões técnicas
2. `{{FEATURE_DIR}}/prd.md` — requisitos e regras de negócio
3. `specs/core/architecture.md` — padrões globais do projeto

Se o projeto tiver na raiz um arquivo de regras para agentes (`AGENTS.md` ou o
equivalente adotado pela ferramenta em uso), use-o como fonte adicional para a
seção 1.4 (regras proibitivas).

`specs/core/product_vision.md` está **fora de escopo**: é enquadramento de
negócio e não altera decisão de implementação.

## Saída

Arquivo único: `{{FEATURE_DIR}}/contexto-execucao.md`, seguindo a estrutura de
`{{TEMPLATE_PATH}}`.

**É PROIBIDO criar ou editar qualquer outro arquivo.** Não toque em `prd.md`,
`techspec.md`, `architecture.md`, `tasks.md` nem em nenhum `task-N.md`.

---

## REGRA CRÍTICA: proibição de paráfrase

Tudo que entra na seção 1 (Invariantes) é **copiado caractere a caractere** da
fonte. Isto vale para, no mínimo:

- expressões regulares e padrões de validação
- nomes de enum, constantes, códigos de erro e status codes
- nomes de tipo, classe, método, campo, tabela e coluna
- versões de linguagem, runtime, framework e biblioteca
- caminhos de arquivo e diretório
- schemas de entrada e saída
- limites numéricos (tamanhos, timeouts, TTLs, quantidades)

É **PROIBIDO** reescrever, traduzir, resumir, "normalizar", corrigir ou
embelezar qualquer um desses valores.

Exemplo do dano que esta regra evita. Fonte:

```
ClientId so pode ser instanciado quando o valor casa com `^[a-z0-9]{1,128}$`
```

Paráfrase inaceitável:

```
ClientId aceita letras minusculas e digitos, ate 128 caracteres
```

A paráfrase perdeu as âncoras `^` e `$` (o padrão passa a casar substring),
perdeu o `{1,` (vazio deixa de ser rejeitado) e não diz que hífen é recusado.
Quem implementa a partir dela escreve o código errado **e o teste errado junto**,
porque os dois saem da mesma frase.

Na dúvida entre copiar e reformular: **copie**.

---

## Procedimento

### Passo 1 — Inventário das fontes

Verifique quais dos três documentos existem. Para cada um que existir, registre o
caminho e a data de modificação do arquivo, para a seção 0 (Proveniência).

Documento ausente **não é erro** e **não aborta** a geração: registre a ausência
na seção 3 (Lacunas conhecidas) e prossiga com os demais.

### Passo 2 — Extração das invariantes

Percorra os documentos e extraia para a seção 1:

- **1.1 Contratos e schemas** — cada contrato que a feature expõe ou consome,
  com schema de entrada, schema de saída, regras de formato e status codes.
  Apenas **o que o código precisa satisfazer**, nunca **como chegar lá**: passo
  a passo de implementação, ordem de execução e plano de trabalho ficam de fora
  (isso é papel da task). Da mesma forma, **não registre números de linha**
  (`arquivo.ts:284-344`): eles envelhecem no primeiro commit e o executor passa
  a confiar em uma referência morta. Cite arquivo e símbolo — `displayNotification()`
  em `src/utils/update-notifier-middleware.ts` — nunca arquivo e intervalo de linhas.
  Se a feature não expõe contrato algum, escreva `Nenhum contrato de fronteira.`
  e siga; não preencha a subseção com resumo de implementação.
- **1.2 Códigos de erro** — a lista **fechada e completa**, na grafia exata. É
  proibido abreviar com "entre outros" ou reticências: uma enumeração incompleta
  é pior que ausente, porque parece confiável.
- **1.3 Stack e versões** — versões exatas, e onde elas são centralizadas.
- **1.4 Regras de código proibitivas** — o que o projeto proíbe, na formulação
  original.
- **1.5 Fronteiras de camada** — quem referencia quem, o que é proibido
  atravessar.

Toda entrada carrega a referência de origem entre parênteses, no formato
`(techspec.md secao 4.1)`. A referência é o que permite ao executor voltar à
fonte quando precisar de mais detalhe.

### Passo 3 — Montagem do mapa

Todo assunto relevante que **não** virou invariante entra na seção 2 como
ponteiro `assunto → arquivo seção`. O mapa é a válvula de segurança: é por ele
que o executor sabe onde procurar em vez de abrir 236 KB à toa.

Cubra pelo menos: critérios de aceite por requisito, decisões de arquitetura,
estratégia de testes, observabilidade, segurança, plano de implementação.

**Não crie linha para assunto marcado como "não aplicável" na fonte.** Um
ponteiro para uma seção vazia gasta espaço e não leva a lugar nenhum.

### Passo 4 — Registro das lacunas

Vá para a seção 3 tudo que você não conseguiu extrair com confiança:

- documento-fonte ausente;
- contrato citado mas não especificado;
- referência a uma seção que não existe no arquivo;
- valor que aparece com grafias divergentes entre dois documentos.

O executor trata todo assunto listado aqui como "abrir a fonte
obrigatoriamente". Uma lacuna registrada custa uma leitura extra; uma lacuna
omitida custa um bug.

Se não houver nenhuma, escreva exatamente: `Nenhuma lacuna identificada.`

### Passo 5 — Verificação de tamanho

O orçamento **escala com o número de contratos**, porque uma feature com cinco
contratos tem legitimamente mais invariantes que uma com um:

```
alvo = 3.500 tokens + 1.200 tokens por contrato registrado em 1.1
teto = alvo x 1,3
```

Uma feature sem contrato de fronteira fica em ~3.500 tokens; uma com cinco fica
em ~9.500. Cada 3,5 caracteres contam como um token.

**Declare o resultado na seção 0**, na linha `Tamanho`: o número de contratos, o
alvo calculado, o tamanho estimado, e `DENTRO` ou `ACIMA`. Esta declaração é
**obrigatória**, inclusive — principalmente — quando o resultado for `ACIMA`.

Se estourar, corte **nesta ordem**, e pare assim que couber:

1. **Mapa (seção 2)** — é só ponteiro; o executor acha o assunto de outro jeito.
2. **Prosa dentro das invariantes** — justificativa, motivação, citação
   explicativa e texto de apoio. Mantenha `Content-Type` obrigatorio, corte o
   "Outro valor resulta em 415." O **valor** e a **referência de origem** ficam;
   a explicação do valor sai.
3. **Nada mais.** Se ainda estourar depois de 1 e 2, **mantenha todas as
   invariantes** e declare `ACIMA` na seção 0. Perder uma invariante é perder
   precisão, que é exatamente o que este artefato existe para preservar — um
   pacote grande e correto é melhor que um pacote pequeno e errado.

Não conte com ninguém revisando este número: quem executa o loop mede o arquivo e
compara com o teto. Uma declaração `DENTRO` num arquivo que estourou é pior que
nenhuma declaração.

---

## Restrições

- Saída em Markdown puro, seguindo a estrutura do template.
- Português do Brasil, sem ícones.
- Não invente conteúdo que não esteja nas fontes. Ausência vira lacuna, não
  suposição.
- Não emita opinião, recomendação ou avaliação sobre os documentos. Este arquivo
  é insumo de execução, não revisão de spec.
- Não relate um resumo do trabalho na resposta: o arquivo gerado é a entrega.
  Responda apenas com o caminho do arquivo e a contagem de invariantes por
  subseção.

## Anti-patterns

- Parafrasear qualquer valor da seção 1
- Truncar uma enumeração de códigos de erro
- Omitir a referência de origem de uma invariante
- Registrar como invariante algo que não está literalmente na fonte
- Registrar passo a passo de implementação ou plano de trabalho na secao 1
- Registrar numero de linha de arquivo de codigo em qualquer lugar do pacote
- Criar linha de mapa para assunto marcado como "nao aplicavel" na fonte
- Deixar a seção 3 vazia sem escrever `Nenhuma lacuna identificada.`
- Omitir a linha `Tamanho` da secao 0, ou declarar `DENTRO` num pacote que estourou
- Cortar invariante antes de ter cortado o mapa e a prosa explicativa
- Editar qualquer arquivo além do `contexto-execucao.md`
- Abortar a geração porque um documento-fonte não existe

**Se qualquer anti-pattern ocorrer, a geração é considerada inválida.**

Prompt Version: 0.3.0
