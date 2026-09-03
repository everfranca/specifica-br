import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQUIVO_README = 'README.md';
const ARQUIVO_README_NPM = 'docs/README.npm.md';
const ARQUIVO_BACKUP = '.readme-github.bak.md';

const RAIZ_PADRAO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Resolve um caminho relativo dentro da raiz do pacote, recusando qualquer
 * destino que escape dela.
 *
 * @param raiz - Diretório raiz do pacote
 * @param relativo - Caminho relativo ao qual a operação se aplica
 * @returns Caminho absoluto contido na raiz
 * @throws {Error} Quando o caminho resolvido fica fora da raiz
 */
function resolverNaRaiz(raiz, relativo) {
  const raizAbsoluta = resolve(raiz);
  const destino = resolve(raizAbsoluta, relativo);

  if (destino !== raizAbsoluta && !destino.startsWith(raizAbsoluta + sep)) {
    throw new Error(`Caminho fora da raiz do pacote: ${relativo}`);
  }

  return destino;
}

/**
 * Substitui o README.md da raiz pela versão destinada ao npm, guardando a
 * versão do GitHub em um backup.
 *
 * @param raiz - Diretório raiz do pacote
 * @returns Mensagem de sucesso da operação
 * @throws {Error} Quando já existe backup ou algum arquivo de origem falta
 */
export function aplicarVersaoNpm(raiz = RAIZ_PADRAO) {
  const readme = resolverNaRaiz(raiz, ARQUIVO_README);
  const readmeNpm = resolverNaRaiz(raiz, ARQUIVO_README_NPM);
  const backup = resolverNaRaiz(raiz, ARQUIVO_BACKUP);

  if (existsSync(backup)) {
    throw new Error(
      `Backup ${ARQUIVO_BACKUP} já existe: um ciclo anterior de empacotamento não foi concluído.\n` +
        `Para resolver, restaure o README do GitHub com "node scripts/swap-readme.js --restore" ` +
        `e só então repita o empacotamento.`
    );
  }

  if (!existsSync(readme)) {
    throw new Error(`Arquivo ${ARQUIVO_README} não encontrado na raiz do pacote.`);
  }

  if (!existsSync(readmeNpm)) {
    throw new Error(`Arquivo ${ARQUIVO_README_NPM} não encontrado: não há versão npm do README para publicar.`);
  }

  copyFileSync(readme, backup);
  copyFileSync(readmeNpm, readme);

  return `README do npm aplicado; versão do GitHub guardada em ${ARQUIVO_BACKUP}.`;
}

/**
 * Restaura o README.md do GitHub a partir do backup e remove o backup.
 *
 * @param raiz - Diretório raiz do pacote
 * @returns Mensagem de sucesso da operação
 * @throws {Error} Quando não há backup a restaurar
 */
export function restaurarVersaoGithub(raiz = RAIZ_PADRAO) {
  const readme = resolverNaRaiz(raiz, ARQUIVO_README);
  const backup = resolverNaRaiz(raiz, ARQUIVO_BACKUP);

  if (!existsSync(backup)) {
    throw new Error(
      `Backup ${ARQUIVO_BACKUP} não encontrado: não há README do GitHub para restaurar.\n` +
        `Se o README.md da raiz estiver com a versão do npm, recupere-o com "git checkout -- README.md".`
    );
  }

  copyFileSync(backup, readme);
  rmSync(backup);

  return 'README do GitHub restaurado; backup removido.';
}

/**
 * Executa o modo informado na linha de comando.
 *
 * @param argumentos - Argumentos recebidos pelo processo
 * @returns Mensagem de sucesso da operação
 * @throws {Error} Quando nenhum modo válido é informado
 */
export function executar(argumentos) {
  if (argumentos.includes('--npm')) {
    return aplicarVersaoNpm();
  }

  if (argumentos.includes('--restore')) {
    return restaurarVersaoGithub();
  }

  throw new Error('Informe um modo: --npm para aplicar o README do npm ou --restore para restaurar o do GitHub.');
}

const executadoDiretamente = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  try {
    console.log(executar(process.argv.slice(2)));
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exit(1);
  }
}
