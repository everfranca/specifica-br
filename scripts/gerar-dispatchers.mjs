import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const indiceRaiz = process.argv.indexOf('--raiz');
const RAIZ = indiceRaiz === -1
  ? path.join(__dirname, '..')
  : path.resolve(process.argv[indiceRaiz + 1]);

const BOILERPLATE = path.join(RAIZ, 'src', 'assets', 'boilerplate');
const DIRETORIO_SKILLS = path.join(BOILERPLATE, 'skills');
const DIRETORIO_COMMANDS = path.join(BOILERPLATE, 'commands');
const DIRETORIO_TEMPLATES = path.join(BOILERPLATE, 'templates');

const SKILLS_EXCLUIDAS = ['executar-task', 'product-manager', 'techspec-generator'];

const ARGUMENT_HINTS = {
  'gerar-prd': '"[descrição da funcionalidade]"',
  'realizar-codereview': '"[branch, arquivo ou diretório]"',
  'gerar-techspec': '"[caminho do prd.md]"',
  'gerar-tasks': '"[caminho do prd.md] [caminho do techspec.md]"',
  'gerar-visao': '"[ideia do projeto]"',
  'gerar-contexto': '"[caminho do projeto]"',
};

const TEMPLATES_POR_SKILL = {
  'gerar-prd': ['prd-template.md'],
  'realizar-codereview': ['codereview-template.md'],
  'gerar-techspec': ['techspec-template.md'],
  'gerar-tasks': ['task-template.md', 'tasks-template.md'],
  'gerar-visao': ['architecture-template.md', 'product_vision-template.md'],
  'gerar-contexto': ['architecture-template.md', 'product_vision-template.md'],
};

function extrairFrontmatter(conteudo) {
  const linhas = conteudo.split('\n');

  if (linhas[0] !== '---') {
    throw new Error('SKILL.md sem bloco de frontmatter');
  }

  const campos = {};

  for (const linha of linhas.slice(1)) {
    if (linha === '---') {
      return campos;
    }

    const campo = linha.match(/^([a-zA-Z-]+):\s*(.*)$/);

    if (campo) {
      campos[campo[1]] = campo[2].trim();
    }
  }

  throw new Error('Frontmatter sem fechamento');
}

function primeiraFrase(descricao) {
  const limite = descricao.search(/\.\s|$|\.$/);

  if (limite === -1) {
    return descricao;
  }

  return descricao.slice(0, limite + 1).trim();
}

function montarDispatcher(skill, description, argumentHint) {
  const linhas = [
    '---',
    `description: ${description}`,
  ];

  if (argumentHint) {
    linhas.push(`argument-hint: ${argumentHint}`);
  }

  linhas.push(
    '---',
    '',
    '<system_instructions>',
    '',
    `Carregue INTEGRALMENTE a skill \`${skill}\` (por meio da ferramenta de skills da sessão ou lendo seu arquivo SKILL.md) e siga-a do início ao fim, incluindo carregar os templates em \`assets/\` e executar o validador em \`scripts/\`.`,
    'Se não houver ferramenta de skills na sessão, localize o arquivo SKILL.md da skill nos diretórios de skills do projeto e do usuário; os recursos em `assets/` e `scripts/` ficam junto dele.',
    '',
    '- Este comando é apenas um dispatcher: todo o processo, os gates de qualidade e as regras de status vivem na skill.',
    `- Se a skill \`${skill}\` não estiver disponível no ambiente, informe o usuário e NÃO prossiga improvisando.`,
    '',
    '</system_instructions>',
    '',
  );

  return linhas.join('\n');
}

function skillsComDispatcher() {
  return fs.readdirSync(DIRETORIO_SKILLS, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .filter((nome) => !SKILLS_EXCLUIDAS.includes(nome))
    .sort();
}

function montarDispatchers() {
  const gerados = new Map();

  for (const skill of skillsComDispatcher()) {
    const conteudo = fs.readFileSync(path.join(DIRETORIO_SKILLS, skill, 'SKILL.md'), 'utf-8');
    const frontmatter = extrairFrontmatter(conteudo);

    if (!frontmatter.description) {
      throw new Error(`skill ${skill}: frontmatter sem description`);
    }

    const destino = path.join(DIRETORIO_COMMANDS, `${skill}.md`);
    gerados.set(destino, montarDispatcher(skill, primeiraFrase(frontmatter.description), ARGUMENT_HINTS[skill]));
  }

  return gerados;
}

function carimbarTemplates() {
  const carimbados = [];

  for (const [skill, templates] of Object.entries(TEMPLATES_POR_SKILL)) {
    for (const template of templates) {
      const origem = path.join(DIRETORIO_TEMPLATES, template);
      const destino = path.join(DIRETORIO_SKILLS, skill, 'assets', template);
      carimbados.push({ origem, destino });
    }
  }

  return carimbados.sort((a, b) => a.destino.localeCompare(b.destino));
}

function aplicar(gerados, carimbos, somenteVerificar) {
  const divergencias = [];

  for (const [destino, conteudo] of gerados) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf-8') : null;

    if (atual === conteudo) {
      continue;
    }

    if (somenteVerificar) {
      divergencias.push(destino);
      continue;
    }

    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo, 'utf-8');
    console.log(`dispatcher gerado: ${path.relative(RAIZ, destino)}`);
  }

  for (const { origem, destino } of carimbos) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
    const alvo = fs.readFileSync(origem);

    if (atual !== null && atual.equals(alvo)) {
      continue;
    }

    if (somenteVerificar) {
      divergencias.push(destino);
      continue;
    }

    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);
    console.log(`template carimbado: ${path.relative(RAIZ, destino)}`);
  }

  return divergencias;
}

const somenteVerificar = process.argv.includes('--check');
const divergencias = aplicar(montarDispatchers(), carimbarTemplates(), somenteVerificar);

if (divergencias.length > 0) {
  console.error('divergencia entre artefatos commitados e a fonte unica (skills e templates):');
  for (const destino of divergencias) {
    console.error(`  ${path.relative(RAIZ, destino)}`);
  }
  console.error('rode "npm run build" para regenerar os artefatos derivados.');
  process.exit(1);
}
