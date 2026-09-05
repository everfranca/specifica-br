# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui, da versão mais recente para a mais
antiga.

## 1.10.0

### Quebras de compatibilidade

Duas mudanças de linha de comando quebram invocações existentes do `executar-tasks`. Em versionamento
semântico estrito elas exigiriam uma versão maior; a escolha por versão menor foi tomada
deliberadamente, com essa informação na mesa.

**1. `--model` e `--effort` passam a ser obrigatórias.**

Antes elas tinham valor padrão embutido (`sonnet` e `medium`). Escolher com que modelo e com que
esforço um lote inteiro vai rodar é decisão de quem paga a conta, e um valor padrão embutido tomava
essa decisão em silêncio. A ausência de qualquer uma das duas agora é erro de validação, com
mensagem que traz o exemplo de invocação, antes de a ferramenta de IA ser chamada.

```
Antes:  specifica-br executar-tasks specs/features/minha-feature
Depois: specifica-br executar-tasks specs/features/minha-feature --model sonnet --effort medium
```

**2. `--pack-model` e `--pack-effort` foram removidas.**

O Contexto de Execução passa a ser construído com o modelo e o esforço do lote. Manter as opções
preservaria a possibilidade de o destilado ser construído por um modelo mais fraco do que o que o
consome, sem que a saída informasse a divergência. Não há sinônimo nem aviso de descontinuação: as
duas opções são recusadas pelo interpretador de linha de comando, que nomeia a opção recusada.
`--pack-max-tokens` permanece, por ser grandeza que não duplica nenhuma opção do lote.

```
Antes:  specifica-br executar-tasks specs/features/minha-feature --model opus --effort high --pack-model sonnet --pack-effort low
Depois: specifica-br executar-tasks specs/features/minha-feature --model opus --effort high
```

### Espera pela renovação da cota

* Nova opção `--max-wait <duracao>`, padrão `6h`, teto absoluto de `12h`. Formas aceitas: `90`
  (segundos), `30m`, `6h`, `1h30m`. Valor acima do teto é recusado na validação, não reduzido em
  silêncio.
* Nova opção `--no-wait-on-limit`. **A espera é ligada por padrão**: ao esbarrar no limite de uso da
  ferramenta, o lote aguarda a renovação da cota e retoma a task barrada, em vez de encerrar. A opção
  restaura o encerramento no primeiro limite.
* A tentativa barrada por limite não conta como task executada nem como erro — ela não rodou. Os
  tokens que ela consumiu continuam somados. A task é reenviada do início, com aviso, porque a
  tentativa barrada pode ter deixado arquivos alterados.
* O contador da janela de execução é renovado ao retomar: uma espera bem-sucedida significa que a
  janela do provedor foi renovada. Os totais do resumo continuam somando o lote inteiro.
* A interrupção pelo usuário (Ctrl+C) é atendida também durante a espera.

### Apresentação

* Nova chave de configuração `cabecalho`, com padrão `painel`: `specifica-br config cabecalho
  <painel|regua|compacto>`, ou pela seleção interativa de `specifica-br config`, com prévia das três
  formas. O estilo do cabeçalho é preferência da máquina, escolhida uma vez, e não opção de linha de
  comando.
* Abertura do lote em cabeçalho, nas três formas. Abaixo de 60 colunas as três degradam para a forma
  compacta.
* Rótulos de estado sem preenchimento interno (`[OK]`, `[AVISO]`, `[ERRO]`, `[INFO]`), alinhados numa
  calha de 7 colunas. O alinhamento é texto neutro, escrito fora da marcação de cor.
* Indicador de progresso em barra pulsante, de largura constante, com estado próprio de espera.
* Durações em forma humana e inteiros com separação de milhar pt-BR na linha de fim de task e no
  resumo final. O registro de execução em disco continua com durações numéricas e cruas: dado de
  auditoria não se formata.
* O Contexto de Execução informa o modelo efetivamente usado na construção do destilado, quando a
  ferramenta reporta essa informação.
