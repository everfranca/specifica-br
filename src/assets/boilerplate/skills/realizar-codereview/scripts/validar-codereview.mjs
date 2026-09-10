import { readFileSync } from 'node:fs';

const caminhoArquivo = process.argv[2];

if (!caminhoArquivo) {
  console.error('Uso: node scripts/validar-codereview.mjs <caminho-do-relatorio>');
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
}

const secoesObrigatorias = [
  '## Metadados',
  '## Resumo',
  '## Findings Críticos (BLOCKER)',
  '## Findings Alta Prioridade',
  '## Demais Findings',
  '## Pontos Positivos',
  '## Veredito',
  '## Formato de Finding (Referência)'
];

for (const secao of secoesObrigatorias) {
  const presente = linhas.some(linha => linha.startsWith(secao));
  if (!presente) {
    violacoes.push(`Seção obrigatória ausente: "${secao}"`);
  }
}

const severidades = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const findings = [];
let findingAtual = null;

for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  const cabecalho = linha.match(/^###\s*\[(F-\d+)\]/);

  if (cabecalho) {
    findingAtual = { id: cabecalho[1], linha: i + 1, corpo: [] };
    findings.push(findingAtual);
    continue;
  }

  if (findingAtual && /^#{1,3}\s/.test(linha)) {
    findingAtual = null;
    continue;
  }

  if (findingAtual) {
    findingAtual.corpo.push(linha);
  }
}

for (const finding of findings) {
  const temSeveridade = finding.corpo.some(linha =>
    severidades.some(severidade => linha.includes(severidade))
  );

  if (!temSeveridade) {
    violacoes.push(`L${finding.linha}: ${finding.id} sem severidade rotulada (CRITICAL, HIGH, MEDIUM ou LOW)`);
  }

  const temLocalizacao = finding.corpo.some(linha => /`[^`\s]+:\d+[^`]*`/.test(linha));

  if (!temLocalizacao) {
    violacoes.push(`L${finding.linha}: ${finding.id} sem localização precisa no formato arquivo:linha`);
  }
}

const indiceStatus = linhas.findIndex(linha => /^\*\*Status\*\*:/.test(linha));

if (indiceStatus === -1) {
  violacoes.push('Veredito incompleto: linha "**Status**:" não encontrada');
} else {
  const status = linhas[indiceStatus].replace(/^\*\*Status\*\*:\s*/, '').trim().toUpperCase();
  const statusValido = ['APROVADO', 'APROVADO COM RESSALVAS', 'REPROVADO'].some(valido => status.startsWith(valido));

  if (!statusValido) {
    violacoes.push(`L${indiceStatus + 1}: status de veredito inválido "${status}" (use APROVADO, APROVADO COM RESSALVAS ou REPROVADO)`);
  }
}

if (!linhas.some(linha => /^\*\*Justificativa\*\*/.test(linha))) {
  violacoes.push('Veredito incompleto: "**Justificativa**" não encontrada');
}

if (!linhas.some(linha => /\*\*Pré-condições para merge\*\*/.test(linha))) {
  violacoes.push('Veredito incompleto: "**Pré-condições para merge**" não encontradas');
}

if (violacoes.length === 0) {
  console.log('OK: relatório válido. Zero placeholders residuais, seções do template presentes, findings com localização e severidade, veredito completo.');
  process.exit(0);
}

console.error('Relatório inválido. Corrija cada violação abaixo e revalide:');
for (const violacao of violacoes) {
  console.error(`- ${violacao}`);
}
process.exit(1);
