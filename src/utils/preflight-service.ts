import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';
import type {
  DeclaredCapability,
  PreflightContexto,
  PreflightItem,
  PreflightResult,
  PreflightSeveridade,
} from '../types/executar-tasks.js';
import type { ToolSlug } from '../types/config.js';
import type { GlobalPath, ToolMapping } from '../types/init.js';
import type { ToolAdapter } from '../types/tool-adapter.js';
import type { ProcessRunner } from './process-runner.js';
import type { FileService } from './file-service.js';
import type { TaskDiscoveryService } from './task-discovery.js';
import { getExecutavel, getToolDisplayName } from './tool-adapters/tool-registry.js';

const COMANDO_EXECUTAR_TASK = 'executar-task.md';

/**
 * Arquivos de configuracao que cada ferramenta le em silencio: um JSON invalido
 * ali e ignorado sem aviso pela propria ferramenta, entao o preflight o promove a
 * ERRO. A lista vem da secao 5.1 (passo 10) da techspec, complementada pelas
 * convencoes de cada CLI. Caminhos relativos a raiz do projeto.
 */
const CONFIGS_POR_SLUG: Record<ToolSlug, string[]> = {
  claudecode: ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json'],
  cursor: ['.cursor/mcp.json'],
  'gemini-cli': ['.gemini/settings.json'],
  kiro: ['.kiro/settings/mcp.json'],
  opencode: ['opencode.json'],
};

/** Cabecalho da secao 9 do arquivo de task. */
const HEADER_SECAO_9 = /^##\s+9\.?\s+/m;
/** Item declarado na secao 9: `- [ ] **<nome>**`. */
const ITEM_SECAO_9 = /^[ \t]*-[ \t]*\[[ xX ]\][ \t]*\*\*([^*]+)\*\*/;
/** Linha de tipo de um item da secao 9. */
const TIPO_SECAO_9 = /\*Tipo:\*\s*(SKILL|MCP)\b/i;

/**
 * Executa os seis grupos de verificacao previa (RF-006) e classifica cada item em
 * OK, AVISO ou ERRO.
 *
 * O servico apenas classifica e devolve `PreflightResult`. A impressao, o aborto e
 * o codigo de saida sao da task-10. Nenhuma verificacao lanca: uma falha inesperada
 * vira um item AVISO, nunca um crash (RNF-001 exige que um cenario de erro nunca
 * gaste tokens, e um crash impediria o diagnostico).
 *
 * A CLI da ferramenta e invocada no maximo duas vezes em toda a execucao:
 * `--version` (CT-023) e `mcp list` (CT-022). Nenhuma task e executada.
 */
export class PreflightService {
  private itens: PreflightItem[] = [];

  constructor(
    private readonly runner: ProcessRunner,
    private readonly adapter: ToolAdapter,
    private readonly fileService: FileService,
    private readonly taskDiscovery: TaskDiscoveryService
  ) {}

  /**
   * Roda os grupos A a F e devolve o resultado consolidado.
   */
  public async run(contexto: PreflightContexto): Promise<PreflightResult> {
    this.itens = [];

    let mapping: ToolMapping | null = null;
    try {
      const todas = await this.fileService.loadToolsMapping();
      mapping =
        todas.find((m) => m.name === getToolDisplayName(contexto.ferramenta)) ?? null;
    } catch (erro) {
      this.add('B', 'tools-mapping', 'AVISO', `nao foi possivel ler tools-mapping.json: ${mensagemDe(erro)}`);
    }

    await this.protegido('A', 'grupo-a', () => this.grupoA(contexto));
    await this.protegido('B', 'grupo-b', () => this.grupoB(contexto, mapping));
    await this.protegido('C', 'grupo-c', () => this.grupoC(contexto));
    await this.protegido('D', 'grupo-d', () => this.grupoD(contexto));
    await this.protegido('E', 'grupo-e', () => this.grupoE(contexto, mapping));
    await this.protegido('F', 'grupo-f', () => this.grupoF(contexto));

    const erros = this.itens.filter((i) => i.severidade === 'ERRO').length;
    const avisos = this.itens.filter((i) => i.severidade === 'AVISO').length;

    return { itens: this.itens, erros, avisos, temErro: erros > 0 };
  }

  private add(
    grupo: string,
    item: string,
    severidade: PreflightSeveridade,
    mensagem: string
  ): void {
    this.itens.push({ grupo, item, severidade, mensagem });
  }

  /** Isola cada grupo: uma excecao inesperada vira AVISO e nao derruba o preflight. */
  private async protegido(
    grupo: string,
    item: string,
    fn: () => Promise<void>
  ): Promise<void> {
    try {
      await fn();
    } catch (erro) {
      this.add(grupo, item, 'AVISO', `verificacao interrompida: ${mensagemDe(erro)}`);
    }
  }

  private async grupoA(contexto: PreflightContexto): Promise<void> {
    const { ferramenta } = contexto;
    const executavel = getExecutavel(ferramenta);
    const mensagemAusente = `CLI de ${ferramenta} nao encontrada no PATH. Abortado antes de gastar tokens.`;

    const caminho = await this.runner.which(executavel);
    if (!caminho) {
      this.add('A', `cli-${executavel}`, 'ERRO', mensagemAusente);
    } else {
      this.add('A', `cli-${executavel}`, 'OK', `${executavel} encontrado em ${caminho}`);
    }

    const versao = await this.adapter.getVersion();
    if (!versao) {
      this.add('A', 'cli-versao', 'ERRO', mensagemAusente);
    } else {
      this.add('A', 'cli-versao', 'OK', `${executavel} ${versao}${caminho ? ` em ${caminho}` : ''}`);
    }

    for (const cmd of contexto.opcoes.requireCmd) {
      const alvo = await this.runner.which(cmd);
      if (!alvo) {
        this.add('A', `require-cmd:${cmd}`, 'ERRO', `comando exigido por --require-cmd nao encontrado no PATH: ${cmd}`);
      } else {
        this.add('A', `require-cmd:${cmd}`, 'OK', `${cmd} encontrado em ${alvo}`);
      }
    }
  }

  private async grupoB(
    contexto: PreflightContexto,
    mapping: ToolMapping | null
  ): Promise<void> {
    if (!mapping) {
      this.add('B', 'comando-executar-task', 'AVISO', 'ferramenta sem mapeamento de comandos - verificacao pulada');
      return;
    }

    const candidatos: string[] = [];
    if (mapping.commands) {
      candidatos.push(path.resolve(contexto.projetoDir, mapping.commands, COMANDO_EXECUTAR_TASK));
    }
    if (mapping.global?.commands) {
      candidatos.push(path.join(this.caminhoGlobal(mapping.global.commands, contexto.home), COMANDO_EXECUTAR_TASK));
    }

    for (const candidato of candidatos) {
      if (await fs.pathExists(candidato)) {
        this.add('B', 'comando-executar-task', 'OK', `comando executar-task instalado: ${candidato}`);
        return;
      }
    }

    this.add(
      'B',
      'comando-executar-task',
      'ERRO',
      `comando executar-task nao instalado para ${contexto.ferramenta}. Rode: specifica-br init`
    );
  }

  private async grupoC(contexto: PreflightContexto): Promise<void> {
    const modo = contexto.opcoes.permissionMode
      ? contexto.opcoes.permissionMode
      : contexto.opcoes.autoApprove
      ? 'bypassPermissions'
      : '';

    if (!modo) {
      this.add(
        'C',
        'permissao',
        'ERRO',
        'nenhuma permissao concedida - as tasks travariam nos prompts. Use --auto-approve'
      );
    } else {
      this.add('C', 'permissao', 'OK', `modo de permissao efetivo: ${modo}`);
    }

    for (const relativo of CONFIGS_POR_SLUG[contexto.ferramenta]) {
      const arquivo = path.resolve(contexto.projetoDir, relativo);
      if (!(await fs.pathExists(arquivo))) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(await fs.readFile(arquivo, 'utf-8'));
      } catch {
        this.add('C', `config:${relativo}`, 'ERRO', `${arquivo} invalido - a ferramenta o ignora em silencio`);
        continue;
      }

      this.add('C', `config:${relativo}`, 'OK', `configuracao valida: ${arquivo}`);
      await this.verificarGanchos(parsed, contexto.projetoDir, relativo);
    }
  }

  /** Verifica que os arquivos referenciados por ganchos da configuracao existem. */
  private async verificarGanchos(config: unknown, projetoDir: string, origem: string): Promise<void> {
    const comandos: string[] = [];
    const coletar = (valor: unknown): void => {
      if (Array.isArray(valor)) {
        valor.forEach(coletar);
        return;
      }
      if (valor && typeof valor === 'object') {
        for (const [chave, filho] of Object.entries(valor as Record<string, unknown>)) {
          if (chave === 'command' && typeof filho === 'string') {
            comandos.push(filho);
          } else {
            coletar(filho);
          }
        }
      }
    };

    if (config && typeof config === 'object' && 'hooks' in (config as Record<string, unknown>)) {
      coletar((config as Record<string, unknown>).hooks);
    }

    for (const comando of comandos) {
      const primeiro = comando.split(/\s+/)[0] ?? '';
      if (!primeiro.includes('/') && !primeiro.includes(path.sep)) {
        continue;
      }
      const alvo = path.resolve(projetoDir, primeiro);
      if (!(await fs.pathExists(alvo))) {
        this.add('C', `gancho:${origem}`, 'AVISO', `gancho referenciado nao encontrado: ${path.basename(primeiro)}`);
      }
    }
  }

  private async grupoD(contexto: PreflightContexto): Promise<void> {
    const registrosOk = await this.diretorioGravavel(contexto.logsDir);
    if (!registrosOk) {
      this.add(
        'D',
        'registros',
        'ERRO',
        `sem permissao de escrita em ~/.specifica-br/logs/${path.basename(contexto.logsDir)}/`
      );
    } else {
      this.add('D', 'registros', 'OK', `diretorio de registros gravavel: ${contexto.logsDir}`);
    }

    for (const caminho of contexto.tasksSelecionadas) {
      const arquivo = path.basename(caminho);
      if (!(await this.acessivel(caminho, fs.constants.R_OK))) {
        this.add('D', `task:${arquivo}`, 'ERRO', `arquivo de task selecionada nao e legivel: ${arquivo}`);
        continue;
      }
      if (!(await this.acessivel(caminho, fs.constants.W_OK))) {
        this.add(
          'D',
          `task:${arquivo}`,
          'AVISO',
          `arquivo de task legivel mas nao gravavel: ${arquivo} - a task nao conseguiria se certificar`
        );
        continue;
      }
      this.add('D', `task:${arquivo}`, 'OK', `task legivel e gravavel: ${arquivo}`);
    }

    const tasksMd = await this.taskDiscovery.isTasksMdWritable(contexto.featureDir);
    if (!tasksMd.existe) {
      this.add('D', 'tasks-md', 'AVISO', 'tasks.md ausente - o comando manda atualiza-lo');
    } else if (!tasksMd.gravavel) {
      this.add('D', 'tasks-md', 'AVISO', 'tasks.md presente mas nao gravavel - o comando nao conseguiria atualiza-lo');
    } else {
      this.add('D', 'tasks-md', 'OK', 'tasks.md presente e gravavel');
    }

    const artefatos: Array<[string, string]> = [
      ['prd.md', path.join(contexto.featureDir, 'prd.md')],
      ['techspec.md', path.join(contexto.featureDir, 'techspec.md')],
      ['architecture.md', path.join(contexto.projetoDir, 'specs', 'core', 'architecture.md')],
    ];

    for (const [nome, caminho] of artefatos) {
      if (await this.acessivel(caminho, fs.constants.R_OK)) {
        this.add('D', `contexto:${nome}`, 'OK', `artefato de contexto legivel: ${nome}`);
      } else {
        this.add(
          'D',
          `contexto:${nome}`,
          'AVISO',
          `artefato de contexto ausente ou ilegivel: ${nome} - o Contexto de Execucao degrada sem ele`
        );
      }
    }
  }

  private async grupoE(
    contexto: PreflightContexto,
    mapping: ToolMapping | null
  ): Promise<void> {
    const capacidades = await this.extrairCapacidades(contexto.tasksSelecionadas);
    const skills = capacidades.filter((c) => c.tipo === 'SKILL');
    const mcps = capacidades.filter((c) => c.tipo === 'MCP');

    const dirsSkills = this.diretoriosDeSkills(mapping, contexto);

    for (const skill of skills) {
      const encontrada = await this.localizarSkill(skill.nome, dirsSkills);
      if (encontrada) {
        this.add('E', `skill:${skill.nome}`, 'OK', `skill:${skill.nome} encontrada em ${encontrada}`);
      } else {
        this.add(
          'E',
          `skill:${skill.nome}`,
          'AVISO',
          `skill:${skill.nome} declarada e nao encontrada - a task prosseguira sem ela`
        );
      }
    }

    if (mcps.length === 0) {
      return;
    }

    if (!contexto.opcoes.mcpCheck) {
      this.add('E', 'mcp-check', 'OK', 'verificacao de MCPs desligada por --no-mcp-check');
      return;
    }

    const nomes = [...new Set(mcps.map((m) => m.nome))];
    const resultados = await this.adapter.listMcps(nomes, contexto.opcoes.mcpTimeout);
    const porNome = new Map(resultados.map((r) => [r.nome, r.severidade]));

    for (const nome of nomes) {
      const severidade = porNome.get(nome) ?? 'AVISO';
      if (severidade === 'OK') {
        this.add('E', `mcp:${nome}`, 'OK', `mcp:${nome} conectado`);
      } else {
        this.add(
          'E',
          `mcp:${nome}`,
          'AVISO',
          `mcp:${nome} declarado e nao verificavel ou nao conectado - a task prosseguira sem ele`
        );
      }
    }
  }

  private async grupoF(contexto: PreflightContexto): Promise<void> {
    const base = path.join(contexto.home, '.specifica-br');
    const logsBase = path.join(base, 'logs');

    const alvo = path.resolve(contexto.logsDir);
    const raiz = path.resolve(logsBase);
    const descendente = alvo === raiz || alvo.startsWith(raiz + path.sep);

    if (!descendente) {
      this.add(
        'F',
        'logs-descendente',
        'ERRO',
        `diretorio de registros fora de ~/.specifica-br/logs/: ${contexto.logsDir}`
      );
    } else {
      this.add('F', 'logs-descendente', 'OK', 'diretorio de registros dentro de ~/.specifica-br/logs/');
    }

    if (!(await this.diretorioGravavel(base))) {
      this.add('F', 'base-gravavel', 'ERRO', 'sem permissao de escrita em ~/.specifica-br/');
    } else {
      this.add('F', 'base-gravavel', 'OK', '~/.specifica-br/ gravavel');
    }
  }

  private diretoriosDeSkills(mapping: ToolMapping | null, contexto: PreflightContexto): string[] {
    if (!mapping) {
      return [];
    }
    const dirs: string[] = [];
    if (mapping.skills) {
      dirs.push(path.resolve(contexto.projetoDir, mapping.skills));
    }
    if (mapping.global?.skills) {
      dirs.push(this.caminhoGlobal(mapping.global.skills, contexto.home));
    }
    return dirs;
  }

  private async localizarSkill(nome: string, dirs: string[]): Promise<string | null> {
    for (const dir of dirs) {
      const comoDir = path.join(dir, nome);
      const comoArquivo = path.join(dir, `${nome}.md`);
      if (await fs.pathExists(comoDir)) {
        return comoDir;
      }
      if (await fs.pathExists(comoArquivo)) {
        return comoArquivo;
      }
    }
    return null;
  }

  private async extrairCapacidades(tasks: string[]): Promise<DeclaredCapability[]> {
    const capacidades: DeclaredCapability[] = [];
    for (const caminho of tasks) {
      let conteudo: string;
      try {
        conteudo = await fs.readFile(caminho, 'utf-8');
      } catch {
        continue;
      }
      capacidades.push(...this.parseSecao9(conteudo, path.basename(caminho)));
    }
    return capacidades;
  }

  /**
   * Extrai as capacidades declaradas na secao 9 conforme CT-014: dentro do bloco
   * iniciado por `## 9.`, cada item `- [ ] **<nome>**` seguido, ate o proximo item,
   * de uma linha `*Tipo:* SKILL` ou `*Tipo:* MCP`. Item sem tipo reconhecivel e
   * ignorado.
   */
  private parseSecao9(conteudo: string, arquivo: string): DeclaredCapability[] {
    const inicio = HEADER_SECAO_9.exec(conteudo);
    if (!inicio) {
      return [];
    }

    const linhas = conteudo.slice(inicio.index).split(/\r?\n/);
    const capacidades: DeclaredCapability[] = [];

    for (let i = 1; i < linhas.length; i += 1) {
      if (/^##\s+(?!9\b)/.test(linhas[i]) || /^#\s/.test(linhas[i])) {
        break;
      }

      const item = ITEM_SECAO_9.exec(linhas[i]);
      if (!item) {
        continue;
      }

      const nome = item[1].trim();
      let tipo: 'SKILL' | 'MCP' | null = null;

      for (let j = i + 1; j < linhas.length; j += 1) {
        if (ITEM_SECAO_9.test(linhas[j]) || /^##\s+/.test(linhas[j])) {
          break;
        }
        const t = TIPO_SECAO_9.exec(linhas[j]);
        if (t) {
          tipo = t[1].toUpperCase() as 'SKILL' | 'MCP';
          break;
        }
      }

      if (nome && tipo) {
        capacidades.push({ nome, tipo, taskArquivo: arquivo });
      }
    }

    return capacidades;
  }

  private caminhoGlobal(entry: GlobalPath, home: string): string {
    const base =
      entry.base === 'config'
        ? process.platform === 'win32'
          ? process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
          : process.env.XDG_CONFIG_HOME ?? path.join(home, '.config')
        : home;
    return path.join(base, entry.path);
  }

  private async acessivel(caminho: string, modo: number): Promise<boolean> {
    try {
      await fs.access(caminho, modo);
      return true;
    } catch {
      return false;
    }
  }

  private async diretorioGravavel(dir: string): Promise<boolean> {
    try {
      await fs.ensureDir(dir);
      await fs.access(dir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
