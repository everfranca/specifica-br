import { readFileSync } from 'node:fs';

const [caminhoVisao, caminhoArquitetura, nivelArgumento] = process.argv.slice(2);

if (!caminhoVisao || !caminhoArquitetura || !nivelArgumento) {
  console.error('Uso: node scripts/validar-visao.mjs <caminho-do-product_vision.md> <caminho-do-architecture.md> <HIGH|MEDIUM|COMPREHENSIVE>');
  process.exit(1);
}

const nivel = nivelArgumento.toUpperCase();
const NIVEIS_VALIDOS = ['HIGH', 'MEDIUM', 'COMPREHENSIVE'];
if (!NIVEIS_VALIDOS.includes(nivel)) {
  console.error(`Erro: nível inválido "${nivelArgumento}". Use HIGH, MEDIUM ou COMPREHENSIVE.`);
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

const exigirSecoes = (rotulo, linhas, secoes) => {
  for (const secao of secoes) {
    if (!temSecao(linhas, secao)) {
      violacoes.push(`${rotulo}: seção obrigatória ausente: "${secao}"`);
    }
  }
};

const corpoSemSecaoDez = linhas => {
  const inicio = linhas.findIndex(linha => linha.trim().startsWith('## 10.'));
  if (inicio === -1) {
    return linhas;
  }
  const fim = linhas.findIndex((linha, indice) => indice > inicio && /^##\s/.test(linha.trim()));
  return [...linhas.slice(0, inicio), ...linhas.slice(fim === -1 ? linhas.length : fim)];
};

const linhasVisao = coletarViolacoesBasicas('product_vision.md', lerArquivo(caminhoVisao));
const linhasArquitetura = coletarViolacoesBasicas('architecture.md', lerArquivo(caminhoArquitetura));

exigirSecoes('product_vision.md', linhasVisao, ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.']);

const secoesArquiteturaPorNivel = {
  HIGH: ['## 1.', '## 2.', '## 3.'],
  MEDIUM: ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.'],
  COMPREHENSIVE: ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.', '## 10.', '## 11.']
};
exigirSecoes('architecture.md', linhasArquitetura, secoesArquiteturaPorNivel[nivel]);

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
  console.log(`OK: artefatos da visão válidos para o nível ${nivel}. Zero placeholders, zero comentários de autoria, seções obrigatórias presentes e zero contaminação cruzada.`);
  process.exit(0);
}

console.error('Artefatos da visão inválidos. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
