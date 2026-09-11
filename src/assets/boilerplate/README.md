# Boilerplate

Este diretório contém os artefatos distribuídos pelo comando `specifica init` para os diretórios de cada ferramenta de IA mapeada.

## Estrutura

```
boilerplate/
├── commands/     # Dispatchers (.md) instalados nos diretórios de comandos de cada ferramenta
├── skills/       # Skills (pastas com SKILL.md + recursos) instaladas nos diretórios de skills
└── templates/    # Templates de documentos copiados para specs/templates/ do projeto
```

## Estrutura padrão de uma skill

```
skills/nome-da-skill/
├── SKILL.md        # Obrigatório: processo, gates e regras (frontmatter name + description)
├── assets/         # Templates usados na geração do artefato
├── scripts/        # Validadores determinísticos em Node.js puro (.mjs, zero dependências)
└── references/     # Material de apoio carregado sob demanda (opcional)
```

Regras de autoria:

- `SKILL.md` com menos de 500 linhas; frontmatter apenas com `name` (igual ao nome do diretório, minúsculas e hífens) e `description` (terceira pessoa, com gatilhos de uso).
- Referências de no máximo 1 nível de profundidade: o SKILL.md aponta direto para o arquivo; nunca arquivo apontando para arquivo.
- Scripts são sempre invocados como `node scripts/nome-do-script.mjs`: sem shebang, sem chmod, sem dependências externas ou de sistema operacional (funcionam em Linux, macOS e Windows).
- Caminhos internos da skill sempre relativos à própria skill e com barras normais (ex.: `assets/prd-template.md`).

## Regra de precedência de templates

Os templates vivem embutidos nos `assets/` de cada skill; o `init` não copia `specs/templates/` por padrão (a cópia é opt-in via flag `--templates`, para customização e versionamento por override). Ao gerar um artefato, a skill usa:

1. `specs/templates/<template>.md` do projeto, se existir (prevalece; permite customização pelo usuário);
2. caso contrário, `assets/<template>.md` embutido na própria skill.

A precedência do projeto é permanente: projetos legados com `specs/templates/` commitado continuam funcionando, e nenhuma geração pode falhar pela ausência do diretório no projeto.

Antes de gerar, a skill DEVE ler o template efetivo. Gerar sem ler o template invalida a execução.

A fonte única dos templates é `boilerplate/templates/`, carimbada em build time para dentro dos `assets/` das skills pelo script `scripts/gerar-dispatchers.mjs` (idempotente).

## Papel do dispatcher

Cada comando em `commands/` que possui skill equivalente é um dispatcher fino: frontmatter com `description` (primeira frase da description da skill) e `argument-hint`, e uma instrução bloqueante para carregar a skill de mesmo nome e segui-la do início ao fim, incluindo `assets/` e `scripts/`. Se a skill não estiver disponível no ambiente, o dispatcher informa o usuário e não prossegue improvisando.

O dispatcher é artefato DERIVADO: é gerado em build time pelo script `scripts/gerar-dispatchers.mjs` a partir do `SKILL.md` de cada skill. A fonte é sempre a skill; dispatchers nunca são editados à mão, e o build falha se o arquivo commitado divergir da fonte.

O dispatcher é neutro por exigência: o mesmo arquivo é instalado idêntico em todas as ferramentas mapeadas, portanto não pode conter caminhos, nomes de ferramenta ou sintaxe exclusivos de qualquer harness ou sistema operacional.

Em ferramentas onde comandos e skills de mesmo nome coexistem, a skill vence (comportamento desejado); nas demais, o dispatcher é o ponto de entrada via `/nome-do-comando`.

## Exceção: executar-task

`executar-task.md` PERMANECE comando integral, sem skill correspondente, e está fora da lista de geração do script de dispatchers. Motivos (decisão permanente):

1. O loop do CLI `executar-tasks` invoca a ferramenta com `opencode run --command executar-task` (ver `src/utils/tool-adapters/opencode-adapter.ts`, `buildTaskArgs`): a flag `--command` do OpenCode resolve COMANDOS, não skills.
2. O preflight do lote valida o ARQUIVO `executar-task.md` nos diretórios de comandos antes de gastar tokens (ver `src/utils/preflight-service.ts`, grupo B); ausência é ERRO bloqueante.

O preflight também aceita `skills/executar-task/SKILL.md` como candidato (à prova de futuro), mas o comando continua sendo a forma primária e não há previsão de migração.

## Modificação

Para modificar os artefatos, edite os arquivos neste diretório. As alterações serão refletidas na próxima vez que o comando `init` for executado. Dispatchers e `assets/` de templates, porém, são derivados: altere a skill em `skills/` ou o template em `templates/` e rode `npm run build` para regenerá-los.
