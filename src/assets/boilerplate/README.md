# Boilerplate Templates

Este diretório contém os arquivos de template que serão copiados ao inicializar um projeto com o comando `specifica init`.

## Estrutura

```
boilerplate/
├── opencode-commands/     # Templates de comandos para OpenCode
│   ├── executar-task.md
│   ├── gerar-prd.md
│   ├── gerar-tasks.md
│   └── gerar-techspec.md
└── specs-templates/       # Templates de documentos specs
    ├── prd-template.md
    ├── task-template.md
    ├── tasks-template.md
    └── techspec-template.md
```

## Uso

Quando o usuário executa `specifica init`, estes arquivos são copiados para:
- `.opencode/commands/` - Arquivos de comandos OpenCode
- `specs/templates/` - Arquivos de templates de especificações

## Modificação

Para modificar os templates, edite os arquivos neste diretório. As alterações serão refletidas na próxima vez que o comando `init` for executado.
