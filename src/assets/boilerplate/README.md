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

Os templates em `boilerplate/templates/` são copiados para `specs/templates/` do projeto do usuário no `init`. Ao gerar um artefato, a skill usa:

1. `specs/templates/<template>.md` do projeto, se existir (prevalece; permite customização pelo usuário);
2. caso contrário, `assets/<template>.md` embutido na própria skill.

Antes de gerar, a skill DEVE ler o template efetivo. Gerar sem ler o template invalida a execução.

## Papel do dispatcher

Cada comando em `commands/` que possui skill equivalente é um dispatcher fino: mantém o frontmatter original (`description`, `argument-hint`) e uma instrução bloqueante para carregar a skill de mesmo nome e segui-la do início ao fim, incluindo `assets/` e `scripts/`. Se a skill não estiver disponível no ambiente, o dispatcher informa o usuário e não prossegue improvisando.

O dispatcher é neutro por exigência: o mesmo arquivo é instalado idêntico em todas as ferramentas mapeadas, portanto não pode conter caminhos, nomes de ferramenta ou sintaxe exclusivos de qualquer harness ou sistema operacional.

Em ferramentas onde comandos e skills de mesmo nome coexistem, a skill vence (comportamento desejado); nas demais, o dispatcher é o ponto de entrada via `/nome-do-comando`.

## Exceção: executar-task

`executar-task.md` PERMANECE comando integral, sem skill correspondente. Motivo: acoplamento direto com o loop do CLI, que invoca `opencode run --command executar-task`, e com o preflight, que procura o arquivo `executar-task.md` nos diretórios de comandos.

## Modificação

Para modificar os artefatos, edite os arquivos neste diretório. As alterações serão refletidas na próxima vez que o comando `init` for executado.
