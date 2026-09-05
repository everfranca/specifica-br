import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guarda de regressao do critério de aceite 6 do PRD e do anti-pattern da secao
 * 2.2 da techspec: nenhum componente fora de `src/utils/terminal/banner.ts` pode
 * conter a sequencia `[` seguida de rotulo de estado. A guarda e textual de
 * proposito — um rotulo escrito a mao em comentario tambem e rotulo duplicado, e
 * envelhece junto com a forma antiga.
 *
 * Escopo: os arquivos `.ts` de `src/`, que sao o codigo-fonte do produto.
 * `src/assets/**` fica de fora porque e boilerplate copiado para o projeto de
 * quem usa a ferramenta, nao codigo do produto. `tests/` e `dist/` nao sao
 * varridos.
 */

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_VARREDURA = path.join(RAIZ_PROJETO, 'src');
const EXCECAO_UNICA = path.join('utils', 'terminal', 'banner.ts');

/** Forma nova (`[OK]`) e forma antiga com preenchimento interno (`[  OK ]`). */
const ROTULO_LITERAL = /\[ *(?:OK|AVISO|AVIS|ERRO|INFO) *\]/;

interface Infracao {
  readonly arquivo: string;
  readonly linha: number;
  readonly trecho: string;
}

function arquivosTypeScript(diretorio: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      achados.push(...arquivosTypeScript(caminho));
      continue;
    }
    if (entrada.isFile() && entrada.name.endsWith('.ts')) {
      achados.push(caminho);
    }
  }
  return achados;
}

function varrer(raiz: string, excecaoRelativa: string): Infracao[] {
  const infracoes: Infracao[] = [];
  for (const arquivo of arquivosTypeScript(raiz)) {
    const relativo = path.relative(raiz, arquivo);
    if (relativo === excecaoRelativa) continue;
    const linhas = readFileSync(arquivo, 'utf8').split('\n');
    linhas.forEach((conteudo, indice) => {
      if (ROTULO_LITERAL.test(conteudo)) {
        infracoes.push({
          arquivo: path.relative(RAIZ_PROJETO, arquivo),
          linha: indice + 1,
          trecho: conteudo.trim(),
        });
      }
    });
  }
  return infracoes;
}

function relatar(infracoes: readonly Infracao[]): string {
  return [
    `rotulo de estado literal em ${infracoes.length} ponto(s) de src/:`,
    ...infracoes.map((i) => `  ${i.arquivo}:${i.linha}: ${i.trecho}`),
    'Corrija na task de origem. Nunca acrescente excecao a esta guarda:',
    'a unica fonte de rotulo e src/utils/terminal/banner.ts.',
  ].join('\n');
}

test('nenhum arquivo de src/ fora de banner.ts contem rotulo de estado literal', () => {
  const infracoes = varrer(RAIZ_VARREDURA, EXCECAO_UNICA);
  assert.deepEqual(infracoes, [], relatar(infracoes));
});

test('a varredura enxerga o codigo-fonte do produto', () => {
  const arquivos = arquivosTypeScript(RAIZ_VARREDURA);
  assert.ok(arquivos.length > 20, 'varredura vazia ou rasa nao prova nada');
  assert.ok(arquivos.some((a) => a.endsWith(path.join('utils', 'task-runner.ts'))));
  assert.ok(arquivos.some((a) => a.endsWith(EXCECAO_UNICA)));
});

test('a guarda reprova as duas formas de rotulo, e so poupa banner.ts', () => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'guarda-rotulos-'));
  try {
    const formas = ['[OK]', '[AVISO]', '[ERRO]', '[INFO]', '[  OK ]', '[ AVIS]', '[ ERRO]', '[ INFO]'];
    mkdirSync(path.join(raiz, 'utils', 'terminal'), { recursive: true });
    writeFileSync(
      path.join(raiz, 'utils', 'infrator.ts'),
      formas.map((forma) => `const r = '${forma}';`).join('\n'),
      'utf8'
    );
    writeFileSync(
      path.join(raiz, 'utils', 'terminal', 'banner.ts'),
      formas.map((forma) => `const r = '${forma}';`).join('\n'),
      'utf8'
    );
    writeFileSync(path.join(raiz, 'utils', 'limpo.ts'), 'const r = rotulo(kind);\n', 'utf8');

    const infracoes = varrer(raiz, EXCECAO_UNICA);

    assert.equal(infracoes.length, formas.length, 'cada forma de rotulo e uma infracao');
    assert.deepEqual(
      infracoes.map((i) => i.linha),
      formas.map((_, indice) => indice + 1)
    );
    assert.ok(infracoes.every((i) => i.arquivo.endsWith(path.join('utils', 'infrator.ts'))));
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('a mensagem de falha nomeia arquivo e linha de cada infracao', () => {
  const relato = relatar([
    { arquivo: 'src/utils/task-runner.ts', linha: 412, trecho: "const r = '[ AVIS]';" },
    { arquivo: 'src/utils/layouts/lote.ts', linha: 88, trecho: "const r = '[OK]';" },
  ]);

  assert.match(relato, /src\/utils\/task-runner\.ts:412/);
  assert.match(relato, /src\/utils\/layouts\/lote\.ts:88/);
  assert.match(relato, /Nunca acrescente excecao/);
});

test('arquivo que nao e .ts fica fora da varredura', () => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'guarda-rotulos-'));
  try {
    writeFileSync(path.join(raiz, 'modelo.md'), "linha com [ AVIS] dentro\n", 'utf8');
    writeFileSync(path.join(raiz, 'tokens.json'), '{ "use": "[OK]" }\n', 'utf8');

    assert.deepEqual(varrer(raiz, EXCECAO_UNICA), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
