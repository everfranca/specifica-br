import { readFileSync } from 'node:fs';

const caminhoArquivo = process.argv[2];

if (!caminhoArquivo) {
  console.error('Uso: node scripts/validar-techspec.mjs <caminho-do-techspec>');
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
  '## 8.',
  '## 9.'
];

for (const secao of secoesObrigatorias) {
  const presente = linhas.some(linha => linha.startsWith(secao));
  if (!presente) {
    violacoes.push(`Seção obrigatória ausente: "${secao}" (seções 1 a 9 do template)`);
  }
}

const ROTULOS_ORIGEM = /^(?:descoberto|solicitado|proposto)(?:\s*\(|$)/i;
const ehOrigemValida = valor => ROTULOS_ORIGEM.test(valor.trim());

let emTabelaResumo = false;
for (let i = 0; i < linhas.length; i++) {
  const numero = i + 1;
  const linha = linhas[i];
  const linhaTrim = linha.trim();

  if (/^###\s+Tabela Resumo de Contratos/.test(linhaTrim)) {
    emTabelaResumo = true;
    continue;
  }

  if (emTabelaResumo && linhaTrim.startsWith('#')) {
    emTabelaResumo = false;
  }

  const comoObtido = linhaTrim.match(/^\|\s*\*\*Como Obtido\*\*\s*\|\s*([^|]*)\|/);
  if (comoObtido) {
    const valor = comoObtido[1].replace(/[\[\]]/g, '').trim();
    if (!ehOrigemValida(valor)) {
      violacoes.push(`L${numero}: campo "Como Obtido" sem origem válida (esperado DESCOBERTO/SOLICITADO/PROPOSTO, encontrado "${valor}")`);
    }
    continue;
  }

  if (emTabelaResumo && linhaTrim.startsWith('|')) {
    const campos = linhaTrim.split('|').slice(1, -1).map(campo => campo.trim());
    const id = campos[0];
    if (/^(CT|ENV|SEC)-\d+$/i.test(id)) {
      const origem = campos[4];
      if (!origem || !ehOrigemValida(origem)) {
        violacoes.push(`L${numero}: contrato ${id} na Tabela Resumo sem origem válida na coluna Origem (esperado DESCOBERTO/SOLICITADO/PROPOSTO)`);
      }
    }
  }
}

const indiceSecao9 = linhas.findIndex(linha => linha.startsWith('## 9.'));
if (indiceSecao9 !== -1) {
  const fim = linhas.findIndex((linha, indice) => indice > indiceSecao9 && /^##\s/.test(linha));
  const corpo = linhas.slice(indiceSecao9 + 1, fim === -1 ? linhas.length : fim).join('\n').trim();
  if (corpo.length === 0) {
    violacoes.push('Seção 9 vazia: registre os itens utilizados ou a variante de ausência');
  } else {
    const temItem = /^\|.*\|\s*(SKILL|MCP)\s*\|/im.test(corpo) || /\*\*(SKILL|MCP)\*\*/i.test(corpo);
    const temAusencia = /nenhuma skill ou mcp/i.test(corpo);
    if (!temItem && !temAusencia) {
      violacoes.push('Seção 9 sem itens reconhecíveis (linha por item com Tipo SKILL|MCP) e sem variante de ausência ("Nenhuma skill ou MCP aplicável...")');
    }
  }
}

if (violacoes.length === 0) {
  console.log('OK: Tech Spec válido. Zero placeholders residuais, seções 1 a 9 presentes, zero comentários de autoria, origem preenchida em todos os contratos e seção 9 preenchida.');
  process.exit(0);
}

console.error('Tech Spec inválido. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
