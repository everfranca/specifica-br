import fs from 'fs-extra';
import path from 'node:path';
import type { TaskInfo } from '../types/executar-tasks.js';
import {
  TASK_FILE_PATTERN,
  TASK_NUMBER_PATTERN,
  STATUS_DONE_PATTERN,
} from './task-discovery-patterns.js';

/** Teto da faixa de um intervalo de `--tasks`, protegendo a memoria antes da validacao de existencia. */
const INTERVALO_MAX = 10000;

/**
 * Descobre os arquivos `task-*.md` da feature, ordena numericamente, expande e
 * valida a selecao de `--tasks` e detecta o metadado de Status `DONE`.
 *
 * Implementa RF-003, RF-004, RF-005, RF-021 e a parte de descoberta de CT-014.
 * O binario nunca modifica arquivos de task: este servico apenas le.
 */
class TaskDiscoveryService {
  /**
   * Descobre as tasks no primeiro nivel de `featureDir`.
   *
   * @param featureDir Diretorio da feature, ja resolvido pelo chamador.
   * @returns Lista ordenada por `numero` crescente, com ordenacao estavel para
   *   numeros iguais (`task-1.md` e `task-01.md`). Lista vazia nao e erro aqui.
   */
  public async discover(featureDir: string): Promise<TaskInfo[]> {
    const entradas = await fs.readdir(featureDir, { withFileTypes: true });
    const tasks: TaskInfo[] = [];

    for (const entrada of entradas) {
      if (!entrada.isFile() || !TASK_FILE_PATTERN.test(entrada.name)) {
        continue;
      }

      const captura = TASK_NUMBER_PATTERN.exec(entrada.name);

      if (!captura) {
        continue;
      }

      const caminho = path.resolve(featureDir, entrada.name);
      const conteudo = await fs.readFile(caminho, 'utf-8');

      tasks.push({
        arquivo: entrada.name,
        numero: Number(captura[1]),
        caminho,
        done: STATUS_DONE_PATTERN.test(conteudo),
        selecionada: false,
      });
    }

    return this.ordenarEstavel(tasks);
  }

  /**
   * Expande a entrada bruta de `--tasks` no algoritmo literal da secao 5.1.
   *
   * @param entrada Texto da opcao `--tasks`.
   * @param numerosExistentes Numeros das tasks descobertas, para a validacao final.
   * @returns Numeros selecionados, ordenados e sem duplicatas.
   * @throws {Error} `selecao invalida`, `intervalo invertido`, `trecho invalido`,
   *   `selecao vazia` ou `task N nao existe nesta feature (disponiveis: X-Y)`.
   */
  public expandSelection(entrada: string, numerosExistentes: number[]): number[] {
    const texto = entrada.replace(/\s+/g, '');

    if (!/^[0-9,\-]+$/.test(texto)) {
      throw new Error('selecao invalida');
    }

    const numeros: number[] = [];

    for (const parte of texto.split(',')) {
      if (parte === '') {
        continue;
      }

      const intervalo = /^(\d+)-(\d+)$/.exec(parte);

      if (intervalo) {
        const inicio = Number(intervalo[1]);
        const fim = Number(intervalo[2]);

        if (inicio > fim) {
          throw new Error('intervalo invertido');
        }

        if (fim - inicio + 1 > INTERVALO_MAX) {
          throw new Error('trecho invalido');
        }

        for (let n = inicio; n <= fim; n += 1) {
          numeros.push(n);
        }

        continue;
      }

      if (/^\d+$/.test(parte)) {
        numeros.push(Number(parte));
        continue;
      }

      throw new Error('trecho invalido');
    }

    if (numeros.length === 0) {
      throw new Error('selecao vazia');
    }

    const unicos = [...new Set(numeros)].sort((a, b) => a - b);
    const existentes = new Set(numerosExistentes);
    const ausente = unicos.find((n) => !existentes.has(n));

    if (ausente !== undefined) {
      throw new Error(
        `task ${ausente} nao existe nesta feature (disponiveis: ${this.faixaExibida(numerosExistentes)})`
      );
    }

    return unicos;
  }

  /**
   * Marca `selecionada` e devolve a lista filtrada, preservando a ordem numerica.
   * A selecao e filtro, nunca ordenacao (RF-003).
   *
   * `selecionada` significa selecao EXPLICITA em `--tasks`, nao "esta no lote".
   * Sem `--tasks` todas as tasks entram, mas nenhuma foi pedida nominalmente, e
   * por isso ficam com `selecionada: false`: o aviso de RF-004 ("estava
   * selecionada mas nao foi executada") orienta quem pediu a task pelo nome e
   * seria ruido para quem nao selecionou nada.
   *
   * @param tasks Lista ja ordenada por `discover`.
   * @param selecao Numeros selecionados, ou `null` quando `--tasks` foi omitida.
   */
  public applySelection(tasks: TaskInfo[], selecao: number[] | null): TaskInfo[] {
    if (selecao === null) {
      return tasks.map((task) => ({ ...task, selecionada: false }));
    }

    const alvo = new Set(selecao);

    return tasks
      .filter((task) => alvo.has(task.numero))
      .map((task) => ({ ...task, selecionada: true }));
  }

  /**
   * Regra de RF-004 exposta para o consumidor (task-10); a decisao de pular fica
   * com o loop, mas `done` ja chega corretamente preenchido.
   */
  public isDone(task: TaskInfo): boolean {
    return task.done;
  }

  /**
   * Verifica apenas existencia e permissao de escrita de `<featureDir>/tasks.md`.
   * Nunca le nem altera o arquivo (CT-014).
   */
  public async isTasksMdWritable(
    featureDir: string
  ): Promise<{ existe: boolean; gravavel: boolean }> {
    const alvo = path.join(featureDir, 'tasks.md');

    if (!(await fs.pathExists(alvo))) {
      return { existe: false, gravavel: false };
    }

    try {
      await fs.access(alvo, fs.constants.W_OK);
      return { existe: true, gravavel: true };
    } catch {
      return { existe: true, gravavel: false };
    }
  }

  /**
   * Ordena por `numero` crescente preservando a ordem de `readdir` para numeros
   * iguais. `Array.prototype.sort` do V8 ja e estavel; o indice original e
   * mantido como desempate explicito para nao depender disso (caso extremo 25).
   */
  private ordenarEstavel(tasks: TaskInfo[]): TaskInfo[] {
    return tasks
      .map((task, indice) => ({ task, indice }))
      .sort((a, b) => a.task.numero - b.task.numero || a.indice - b.indice)
      .map((item) => item.task);
  }

  /**
   * Faixa `min-max` derivada dos numeros existentes para a mensagem de erro.
   * Lista vazia devolve `nenhuma`.
   */
  private faixaExibida(numerosExistentes: number[]): string {
    if (numerosExistentes.length === 0) {
      return 'nenhuma';
    }

    const min = Math.min(...numerosExistentes);
    const max = Math.max(...numerosExistentes);

    return `${min}-${max}`;
  }
}

export { TaskDiscoveryService };
