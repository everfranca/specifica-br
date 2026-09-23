import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const argumentos = process.argv.slice(2);

if (argumentos.length < 2) {
  console.error('Uso: node scripts/validar-tasks.mjs <caminho-do-techspec.md> <caminho-do-tasks.md> [caminho-do-task-N.md ...]');
  process.exit(1);
}

const lerArquivo = caminho => {
  try {
    return readFileSync(caminho, 'utf-8');
  } catch (erro) {
    console.error(`Erro: não foi possível ler o arquivo ${caminho}`);
    process.exit(1);
  }
};

const PADRAO_ID = /\b(?:CT|ENV|SEC)-\d+\b/g;
const extrairIds = texto => new Set(texto.match(PADRAO_ID) || []);

const violacoes = [];

const techspec = lerArquivo(argumentos[0]);
const idsTechspec = extrairIds(techspec);

const conteudoTasks = lerArquivo(argumentos[1]);
const linhasTasks = conteudoTasks.split(/\r?\n/);

for (let i = 0; i < linhasTasks.length; i++) {
  const numero = i + 1;
  const linha = linhasTasks[i];
  if (linha.includes('{{')) {
    violacoes.push(`tasks.md L${numero}: placeholder residual "{{" encontrado`);
  }
  const linhaTrim = linha.trim();
  if (linhaTrim.startsWith('<!--') && linhaTrim.includes('-->') && !/^<!--\s*Status:/i.test(linhaTrim)) {
    violacoes.push(`tasks.md L${numero}: comentário de autoria residual (remova os comentários do template)`);
  }
}

for (const secao of ['## Contratos', '## Tarefas']) {
  if (!linhasTasks.some(linha => linha.trim().startsWith(secao))) {
    violacoes.push(`tasks.md: seção obrigatória ausente: "${secao}"`);
  }
}

const tasksListadas = new Set();
for (const linha of linhasTasks) {
  const correspondencia = linha.match(/-\s*\[[ xX]\]\s*(task-\d+\.md)/);
  if (correspondencia) {
    tasksListadas.add(correspondencia[1]);
  }
}

const arquivosTasks = argumentos.slice(2);
const nomesArquivosTasks = new Set(arquivosTasks.map(arquivo => basename(arquivo)));

for (const taskListada of tasksListadas) {
  if (!nomesArquivosTasks.has(taskListada)) {
    violacoes.push(`tasks.md lista "${taskListada}" mas o arquivo não foi fornecido/não existe (task órfã no índice)`);
  }
}

for (const nomeArquivo of nomesArquivosTasks) {
  if (!tasksListadas.has(nomeArquivo)) {
    violacoes.push(`arquivo "${nomeArquivo}" existe mas não possui linha correspondente no índice tasks.md (task órfã)`);
  }
}

const mapaFronteira = new Map();
const linhasTechspec = techspec.split(/\r?\n/);
let idAtual = null;
for (let i = 0; i < linhasTechspec.length; i++) {
  const linha = linhasTechspec[i].trim();
  const idResumo = linha.match(/^\|\s*((?:CT|ENV|SEC)-\d+)\s*\|\s*([^|]+)\|/);
  if (idResumo && /^(?:CT)-\d+$/.test(idResumo[1])) {
    mapaFronteira.set(idResumo[1], idResumo[2].trim());
    idAtual = null;
    continue;
  }
  const idMetadata = linha.match(/^\|\s*\*\*ID\*\*\s*\|\s*((?:CT)-\d+)\s*\|/);
  if (idMetadata) {
    idAtual = idMetadata[1];
    continue;
  }
  const fronteiraMetadata = linha.match(/^\|\s*\*\*Fronteira\*\*\s*\|\s*([^|]+)\|/);
  if (fronteiraMetadata && idAtual && !mapaFronteira.has(idAtual)) {
    mapaFronteira.set(idAtual, fronteiraMetadata[1].trim());
    idAtual = null;
  }
}

const camadasPorFronteira = fronteira => {
  const valor = fronteira.toLowerCase();
  if (valor.includes('database')) {
    return ['Database'];
  }
  if (valor.includes('client')) {
    return ['Backend', 'Frontend'];
  }
  if (valor.includes('message') || valor.includes('broker') || valor.includes('cache') || valor.includes('external') || valor.includes('storage') || valor.includes('search')) {
    return ['Backend'];
  }
  if (valor.includes('environment') || valor.includes('env')) {
    return ['Backend', 'Frontend', 'Infraestrutura'];
  }
  return null;
};

const idsEncontrados = new Set(extrairIds(conteudoTasks));

const validarSecaoNove = (nomeArquivo, linhas) => {
  const indice = linhas.findIndex(linha => linha.trim().startsWith('## 9.'));
  if (indice === -1) {
    violacoes.push(`${nomeArquivo}: seção 9 (Skills e MCPs) ausente`);
    return;
  }
  const fim = linhas.findIndex((linha, pos) => pos > indice && /^##\s/.test(linha));
  const corpo = linhas.slice(indice + 1, fim === -1 ? linhas.length : fim);
  const textoCorpo = corpo.join('\n').trim();
  if (textoCorpo.length === 0) {
    violacoes.push(`${nomeArquivo}: seção 9 vazia (declare itens com cinco campos ou a variante de ausência)`);
    return;
  }
  if (/nenhuma skill ou mcp/i.test(textoCorpo)) {
    if (!/justificativa/i.test(textoCorpo)) {
      violacoes.push(`${nomeArquivo}: variante de ausência na seção 9 sem "Justificativa: [motivo]"`);
    }
    return;
  }
  let itemAtual = null;
  let camposDoItem = null;
  const finalizarItem = () => {
    if (itemAtual === null) {
      return;
    }
    for (const campo of camposDoItem) {
      if (!campo) {
        violacoes.push(`${nomeArquivo}: item "${itemAtual}" da seção 9 sem os cinco campos obrigatórios (nome, Tipo, Origem, Motivo, Passos de Aplicação)`);
        return;
      }
    }
  };
  for (const linha of corpo) {
    if (!/^\s*-/.test(linha)) {
      continue;
    }
    const conteudo = linha.replace(/^\s*-\s*(?:\[[ xX]\]\s*)?/, '').replace(/\*{1,2}/g, '').trim();
    if (conteudo.length > 0 && !conteudo.includes(':')) {
      finalizarItem();
      itemAtual = conteudo;
      camposDoItem = [false, false, false, false];
      continue;
    }
    if (itemAtual !== null) {
      const nomeCampo = conteudo.split(':')[0].trim().toLowerCase();
      if (nomeCampo === 'tipo') {
        camposDoItem[0] = true;
      }
      if (nomeCampo === 'origem') {
        camposDoItem[1] = true;
      }
      if (nomeCampo === 'motivo') {
        camposDoItem[2] = true;
      }
      if (nomeCampo.startsWith('passos')) {
        camposDoItem[3] = true;
      }
    }
  }
  finalizarItem();
  if (!corpo.some(linha => /\btipo\s*:/i.test(linha)) && !corpo.some(linha => /passos?\s*:/i.test(linha))) {
    violacoes.push(`${nomeArquivo}: seção 9 sem itens reconhecíveis (cinco campos por item) e sem variante de ausência`);
  }
};

for (const caminhoTask of arquivosTasks) {
  const nomeArquivo = basename(caminhoTask);
  const conteudoTask = lerArquivo(caminhoTask);
  const linhasTask = conteudoTask.split(/\r?\n/);

  for (const id of extrairIds(conteudoTask)) {
    idsEncontrados.add(id);
  }

  for (let i = 0; i < linhasTask.length; i++) {
    const numero = i + 1;
    const linha = linhasTask[i];
    if (linha.includes('{{')) {
      violacoes.push(`${nomeArquivo} L${numero}: placeholder residual "{{" encontrado`);
    }
    if (linha.toLowerCase().includes('[nome-da-funcionalidade]')) {
      violacoes.push(`${nomeArquivo} L${numero}: placeholder literal "[nome-da-funcionalidade]" encontrado`);
    }
    const linhaTrim = linha.trim();
    if (linhaTrim.startsWith('<!--') && linhaTrim.includes('-->') && !/^<!--\s*Status:/i.test(linhaTrim)) {
      violacoes.push(`${nomeArquivo} L${numero}: comentário de autoria residual (remova os comentários do template)`);
    }
  }

  for (let numero = 1; numero <= 9; numero++) {
    const secao = `## ${numero}.`;
    if (!linhasTask.some(linha => linha.trim().startsWith(secao))) {
      violacoes.push(`${nomeArquivo}: seção obrigatória ausente: "${secao}" (seções 1 a 9 do template)`);
    }
  }

  validarSecaoNove(nomeArquivo, linhasTask);

  let camadasAtuais = null;
  for (const id of extrairIds(conteudoTask)) {
    if (!/^CT-/.test(id) || !mapaFronteira.has(id)) {
      continue;
    }
    const camadas = camadasPorFronteira(mapaFronteira.get(id));
    if (!camadas) {
      continue;
    }
    if (camadasAtuais === null) {
      camadasAtuais = new Set(camadas);
      continue;
    }
    const comum = camadas.filter(camada => camadasAtuais.has(camada));
    if (comum.length === 0) {
      violacoes.push(`${nomeArquivo}: task mistura camadas tecnológicas (contratos declarados apontam para camadas incompatíveis: ${[...camadasAtuais].join(', ')} + ${camadas.join(', ')})`);
      break;
    }
    camadasAtuais = new Set(comum);
  }
}

for (const idTechspec of idsTechspec) {
  if (!idsEncontrados.has(idTechspec)) {
    violacoes.push(`${idTechspec} presente na techspec mas não mapeado em nenhuma task (tasks.md ou task-N.md)`);
  }
}

if (violacoes.length === 0) {
  console.log('OK: tasks válidas. Cobertura completa de CT/ENV/SEC-XXX, nenhuma task órfã, isolamento de camada preservado, seções 1 a 9 presentes e seção 9 de cada task com cinco campos ou ausência justificada.');
  process.exit(0);
}

console.error('Tasks inválidas. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
