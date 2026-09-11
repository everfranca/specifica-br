import { readFileSync } from 'node:fs';

const [caminhoArquitetura, caminhoVisao] = process.argv.slice(2);

if (!caminhoArquitetura || !caminhoVisao) {
  console.error('Uso: node scripts/validar-contexto.mjs <caminho-do-architecture.md> <caminho-do-product_vision.md>');
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

const TERMOS_TECNICOS_PALAVRA = [
  'react', 'vue', 'angular', 'svelte', 'django', 'fastapi', 'express', 'spring', 'laravel', 'rails', 'flask',
  'postgresql', 'mysql', 'mongodb', 'oracle', 'redis', 'memcached', 'elasticsearch', 'kafka', 'rabbitmq',
  'docker', 'kubernetes', 'terraform', 'jenkins', 'graphql', 'grpc', 'websocket', 'jwt', 'oauth', 'openid',
  'saml', 'prisma', 'dapper', 'mongoose', 'typeorm', 'sequelize', 'endpoint', 'framework',
  'microserviço', 'microserviços', 'microsserviço', 'microsserviços', 'nosql', 'mensageria', 'webhook', 'webhooks',
  'sql', 'api', 'apís'
];

const TERMOS_TECNICOS_TEXTO = [
  '.net', 'c#', 'node.js', 'node 20', 'python 3', 'sql server', 'banco de dados', 'banco sql',
  'api rest', 'rest api', 'ci/cd', 'github actions', 'gitlab ci', 'azure devops', 'aws', 'azure', 'gcp',
  'google cloud', 'entity framework', 'hibernate', 'message broker', 'deploy', 'cloud'
];

const TERMOS_NEGOCIO = [
  'persona', 'personas', 'receita', 'faturamento', 'conversão', 'conversao', 'churn', 'marketing',
  'proposta de valor', 'jornada do usuário', 'jornada do usuario', 'usuários principais', 'usuarios principais',
  'cliente final', 'clientes finais', 'nps'
];

const violacoes = [];

const coletarViolacoesBasicas = (rotulo, conteudo) => {
  const linhas = conteudo.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const numero = i + 1;
    const linha = linhas[i];
    if (linha.includes('{{')) {
      violacoes.push(`${rotulo} L${numero}: placeholder residual "{{" encontrado`);
    }
    if (linha.toLowerCase().includes('[nome-da-funcionalidade]') || linha.includes('[Nome da Persona]')) {
      violacoes.push(`${rotulo} L${numero}: placeholder literal de template encontrado`);
    }
    const linhaTrim = linha.trim();
    if (linhaTrim.startsWith('<!--') && linhaTrim.includes('-->') && !/^<!--\s*Status:/i.test(linhaTrim)) {
      violacoes.push(`${rotulo} L${numero}: comentário de autoria residual (remova os comentários do template; apenas o comentário de metadata de status é permitido)`);
    }
  }
  return linhas;
};

const temSecao = (linhas, prefixo) => linhas.some(linha => linha.trim().startsWith(prefixo));

const temSecaoPorNome = (linhas, nome) => linhas.some(linha => /^##\s+\d+\.\s+.*$/i.test(linha.trim()) && linha.toLowerCase().includes(nome.toLowerCase()));

const corpoSemSecaoDez = linhas => {
  const inicio = linhas.findIndex(linha => linha.trim().startsWith('## 10.'));
  if (inicio === -1) {
    return linhas;
  }
  const fim = linhas.findIndex((linha, indice) => indice > inicio && /^##\s/.test(linha.trim()));
  return [...linhas.slice(0, inicio), ...linhas.slice(fim === -1 ? linhas.length : fim)];
};

const linhasArquitetura = coletarViolacoesBasicas('architecture.md', lerArquivo(caminhoArquitetura));
const linhasVisao = coletarViolacoesBasicas('product_vision.md', lerArquivo(caminhoVisao));

for (const secao of ['## 1.', '## 2.']) {
  if (!temSecao(linhasArquitetura, secao)) {
    violacoes.push(`architecture.md: seção obrigatória ausente: "${secao}"`);
  }
}

for (const nome of ['Integrações Externas', 'Maturidade de Testes', 'Domínio Inferido']) {
  if (!temSecaoPorNome(linhasArquitetura, nome)) {
    violacoes.push(`architecture.md: seção obrigatória ausente por nome: "${nome}"`);
  }
}

if (linhasArquitetura.some(linha => linha.includes('[REVISAR]'))) {
  violacoes.push('architecture.md: tag [REVISAR] remanescente (itens de baixa confiança devem ser clarificados e aprovados)');
}

for (const secao of ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.', '## 10.']) {
  if (!temSecao(linhasVisao, secao)) {
    violacoes.push(`product_vision.md: seção obrigatória ausente: "${secao}" (seção 10 = Inferências do Código Legado)`);
  }
}

const indiceDez = linhasVisao.findIndex(linha => linha.trim().startsWith('## 10.'));
if (indiceDez !== -1) {
  const fim = linhasVisao.findIndex((linha, indice) => indice > indiceDez && /^##\s/.test(linha.trim()));
  const corpoDez = linhasVisao.slice(indiceDez + 1, fim === -1 ? linhasVisao.length : fim).join('\n');
  if (corpoDez.trim().length === 0) {
    violacoes.push('product_vision.md: seção 10 (Inferências do Código Legado) vazia');
  } else if (!corpoDez.includes('%')) {
    violacoes.push('product_vision.md: seção 10 sem níveis de confiança (%) nas inferências');
  }
}

const linhasVisaoNegocio = corpoSemSecaoDez(linhasVisao);
for (const termo of TERMOS_TECNICOS_PALAVRA) {
  const padrao = new RegExp(`\\b${termo}\\b`, 'i');
  for (let i = 0; i < linhasVisaoNegocio.length; i++) {
    if (padrao.test(linhasVisaoNegocio[i])) {
      violacoes.push(`product_vision.md L${i + 1}: contaminação técnica "${termo}" em documento de negócio (fora da seção 10)`);
    }
  }
}
for (const termo of TERMOS_TECNICOS_TEXTO) {
  for (let i = 0; i < linhasVisaoNegocio.length; i++) {
    if (linhasVisaoNegocio[i].toLowerCase().includes(termo)) {
      violacoes.push(`product_vision.md L${i + 1}: contaminação técnica "${termo}" em documento de negócio (fora da seção 10)`);
    }
  }
}

for (let i = 0; i < linhasArquitetura.length; i++) {
  const linhaMinuscula = linhasArquitetura[i].toLowerCase();
  for (const termo of TERMOS_NEGOCIO) {
    const padrao = /\s/.test(termo)
      ? linhaMinuscula.includes(termo)
      : new RegExp(`\\b${termo}\\b`).test(linhaMinuscula);
    if (padrao) {
      violacoes.push(`architecture.md L${i + 1}: contaminação de negócio "${termo}" em documento técnico`);
      break;
    }
  }
}

if (violacoes.length === 0) {
  console.log('OK: artefatos de contexto válidos. Zero placeholders, zero comentários de autoria, zero tags [REVISAR], seções obrigatórias presentes e zero contaminação cruzada.');
  process.exit(0);
}

console.error('Artefatos de contexto inválidos. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
