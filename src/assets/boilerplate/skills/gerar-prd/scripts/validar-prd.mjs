import { readFileSync } from 'node:fs';

const caminhoArquivo = process.argv[2];

if (!caminhoArquivo) {
  console.error('Uso: node scripts/validar-prd.mjs <caminho-do-prd>');
  process.exit(1);
}

let conteudo;
try {
  conteudo = readFileSync(caminhoArquivo, 'utf-8');
} catch (erro) {
  console.error(`Erro: não foi possível ler o arquivo ${caminhoArquivo}`);
  process.exit(1);
}

const linhas = conteudo.split(/\r?\n/);
const violacoes = [];

for (let i = 0; i < linhas.length; i++) {
  const numero = i + 1;
  const linha = linhas[i];

  if (linha.includes('{{')) {
    violacoes.push(`L${numero}: placeholder residual "{{" encontrado`);
  }

  if (linha.includes('}}')) {
    violacoes.push(`L${numero}: placeholder residual "}}" encontrado`);
  }

  if (linha.toLowerCase().includes('[nome-da-funcionalidade]')) {
    violacoes.push(`L${numero}: placeholder literal "[nome-da-funcionalidade]" encontrado`);
  }

  const linhaTrim = linha.trim();
  if (linhaTrim.startsWith('<!--') && linhaTrim.includes('-->') && !/^<!--\s*Status:/i.test(linhaTrim)) {
    violacoes.push(`L${numero}: comentário de autoria residual (remova os comentários do template; apenas o comentário de metadata de status é permitido)`);
  }
}

const secoesObrigatorias = [
  '## 1.',
  '## 2.',
  '## 3.',
  '## 4.',
  '## 5.',
  '## 6.',
  '## 7.',
  '## 8.'
];

for (const secao of secoesObrigatorias) {
  const presente = linhas.some(linha => linha.startsWith(secao));
  if (!presente) {
    violacoes.push(`Seção obrigatória ausente: "${secao}" (seções 1 a 8 do template)`);
  }
}

const usDefinidas = [];
for (let i = 0; i < linhas.length; i++) {
  const correspondencia = linhas[i].match(/^\|\s*(US-\d+)\s*\|/);
  if (correspondencia && !usDefinidas.some(us => us.id === correspondencia[1])) {
    usDefinidas.push({ id: correspondencia[1], linha: i + 1 });
  }
}

const rfs = [];
let rfAtual = null;
for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  const cabecalhoRf = linha.match(/\*\*\[(RF-\d+)\]/);
  if (cabecalhoRf) {
    rfAtual = { id: cabecalhoRf[1], linha: i + 1, fontes: [] };
    rfs.push(rfAtual);
    continue;
  }

  const fonte = linha.match(/\*\*Fonte:\*\*\s*(.+)/);
  if (fonte && rfAtual) {
    const referencias = fonte[1].match(/US-\d+/g) || [];
    rfAtual.fontes.push(...referencias);
  }
}

const usReferenciadas = new Set();
for (const rf of rfs) {
  for (const us of rf.fontes) {
    usReferenciadas.add(us);
  }
}

for (const us of usDefinidas) {
  if (!usReferenciadas.has(us.id)) {
    violacoes.push(`L${us.linha}: ${us.id} definida na seção de User Stories mas não referenciada por nenhum RF (Fonte)`);
  }
}

for (const us of usReferenciadas) {
  if (!usDefinidas.some(definida => definida.id === us)) {
    violacoes.push(`${us} referenciada como Fonte de um RF mas não existe na tabela de User Stories (seção 3)`);
  }
}

for (const rf of rfs) {
  if (rf.fontes.length === 0) {
    violacoes.push(`L${rf.linha}: ${rf.id} sem Fonte (US-XXX); todo RF deve referenciar ao menos uma User Story`);
  }
}

if (violacoes.length === 0) {
  console.log('OK: PRD válido. Zero placeholders residuais, seções 1 a 8 presentes, zero comentários de autoria e referências US/RF consistentes.');
  process.exit(0);
}

console.error('PRD inválido. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
