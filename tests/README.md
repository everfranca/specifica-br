# Suite de testes

Os testes desta feature sao escritos em TypeScript com a convencao de nomes `*.test.ts` e compilados para `*.test.js` neste mesmo diretorio pelo `tsconfig.test.json`. A execucao e feita pelo runner nativo do Node (`node --test --experimental-test-coverage`), acionado por `npm test`, que primeiro compila o codigo de producao em `dist/` e os testes aqui, e entao executa a suite reportando cobertura das fontes carregadas de `dist/`.

Cada task da feature `comando-executar-tasks-global` adiciona seus proprios arquivos de teste neste diretorio. Os arquivos compilados (`*.test.js`) sao artefatos de build e nao integram o pacote publicado (o campo `files` do `package.json` publica apenas `dist/`).
