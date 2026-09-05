import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EsperaPorLimiteDeUso } from '../dist/utils/espera-limite.js';
import type { EstadoDeEspera, Relogio } from '../dist/types/executar-tasks.js';

/** Instante de referencia fixo: 04/09/2026 14:00 local. */
const AGORA = new Date(2026, 8, 4, 14, 0, 0, 0).getTime();

const TETO_6H = 6 * 60 * 60;

/**
 * Relogio falso: `esperar` avanca o tempo simulado e devolve na hora. Nenhum
 * teste deste arquivo aguarda tempo real (RNF-006).
 */
class RelogioFalso implements Relogio {
  public esperas: number[] = [];

  constructor(private instante: number = AGORA) {}

  agora(): number {
    return this.instante;
  }

  async esperar(ms: number, signal?: AbortSignal): Promise<void> {
    this.esperas.push(ms);
    if (signal?.aborted) {
      return;
    }
    this.instante += ms;
    this.aoEsperar?.(this);
  }

  /** Gancho para abortar ou inspecionar o estado no meio da espera. */
  public aoEsperar: ((relogio: RelogioFalso) => void) | null = null;
}

function fakeLayout() {
  const mensagens: Array<[string, string]> = [];
  const inicios: EstadoDeEspera[] = [];
  const atualizacoes: EstadoDeEspera[] = [];
  const fins: number[] = [];
  const obj = {
    header() {},
    taskStart() {},
    taskEnd() {},
    taskSkipped() {},
    message(kind: string, texto: string) {
      mensagens.push([kind, texto]);
    },
    waitStart(estado: EstadoDeEspera) {
      inicios.push(estado);
    },
    waitUpdate(estado: EstadoDeEspera) {
      atualizacoes.push(estado);
    },
    waitEnd(segundos: number) {
      fins.push(segundos);
    },
    summary() {},
    dispose() {},
  };
  return { obj, mensagens, inicios, atualizacoes, fins };
}

function fakeLogger() {
  const eventos: Array<Record<string, unknown>> = [];
  const obj = {
    async logEvent(evento: Record<string, unknown>) {
      eventos.push(evento);
    },
    appendStderr() {},
    async close() {},
  };
  return { obj, eventos };
}

function montar(
  over: {
    relogio?: RelogioFalso;
    isTTY?: boolean;
    tetoAcumuladoSegundos?: number;
    ligada?: boolean;
  } = {},
) {
  const relogio = over.relogio ?? new RelogioFalso();
  const layout = fakeLayout();
  const logger = fakeLogger();
  const servico = new EsperaPorLimiteDeUso({
    relogio,
    layout: layout.obj as never,
    logger: logger.obj as never,
    isTTY: over.isTTY ?? true,
    tetoAcumuladoSegundos: over.tetoAcumuladoSegundos ?? TETO_6H,
    ligada: over.ligada ?? true,
  });
  return { servico, relogio, layout, logger };
}

function entrada(over: Record<string, unknown> = {}) {
  return {
    textoBruto: 'Claude usage limit reached, try again in 30 minutes',
    contexto: 'task' as const,
    task: 'task-7.md',
    posicao: 3,
    total: 12,
    tentativa: 1,
    signal: new AbortController().signal,
    ...over,
  };
}

function eventos(logger: ReturnType<typeof fakeLogger>, nome: string) {
  return logger.eventos.filter((evento) => evento.event === nome);
}

test('horario conhecido: espera ate a renovacao mais 30 s de folga e manda retomar', async () => {
  const { servico, relogio, layout, logger } = montar();

  const resultado = await servico.aguardar(entrada());

  assert.deepStrictEqual(resultado, { retomar: true, motivoDaDesistencia: null });
  assert.strictEqual(servico.acumuladoSegundos, 30 * 60 + 30);
  assert.strictEqual(relogio.agora(), AGORA + (30 * 60 + 30) * 1000);
  assert.strictEqual(layout.fins.length, 1);
  assert.strictEqual(layout.fins[0], 30 * 60 + 30);
});

test('horario conhecido: grava aguardando_limite e retomada com os campos de CT-043', async () => {
  const { servico, logger } = montar();

  await servico.aguardar(entrada());

  const aguardando = eventos(logger, 'aguardando_limite');
  assert.strictEqual(aguardando.length, 1);
  assert.deepStrictEqual(
    {
      task: aguardando[0].task,
      tentativa: aguardando[0].tentativa,
      origem_horario: aguardando[0].origem_horario,
      espera_planejada_segundos: aguardando[0].espera_planejada_segundos,
      espera_acumulada_segundos_antes: aguardando[0].espera_acumulada_segundos_antes,
      teto_espera_segundos: aguardando[0].teto_espera_segundos,
    },
    {
      task: 'task-7.md',
      tentativa: 1,
      origem_horario: 'informado',
      espera_planejada_segundos: 30 * 60 + 30,
      espera_acumulada_segundos_antes: 0,
      teto_espera_segundos: TETO_6H,
    },
  );
  assert.strictEqual(
    aguardando[0].renovacao_prevista,
    new Date(AGORA + 30 * 60 * 1000).toISOString(),
  );

  const retomada = eventos(logger, 'retomada');
  assert.strictEqual(retomada.length, 1);
  assert.deepStrictEqual(retomada[0], {
    event: 'retomada',
    ts: '',
    task: 'task-7.md',
    tentativa: 2,
    espera_efetiva_segundos: 30 * 60 + 30,
    espera_acumulada_segundos_depois: 30 * 60 + 30,
    janela_renovada: true,
  });
});

test('em TTY a linha de espera e atualizada a cada segundo, com a natureza correta', async () => {
  const { servico, layout } = montar({ isTTY: true });

  await servico.aguardar(
    entrada({ textoBruto: 'Claude usage limit reached, try again in 5 minutes' }),
  );

  assert.strictEqual(layout.inicios.length, 1);
  assert.strictEqual(layout.inicios[0].natureza, 'renovacao_conhecida');
  assert.strictEqual(layout.inicios[0].tentativa, 2);
  assert.strictEqual(layout.inicios[0].posicao, 3);
  assert.strictEqual(layout.inicios[0].total, 12);
  // 330 s de espera, uma atualizacao por segundo, sem a do instante final.
  assert.strictEqual(layout.atualizacoes.length, 329);
  assert.strictEqual(layout.atualizacoes[0].restanteSegundos, 329);
});

test('espera desligada desiste sem iniciar espera alguma', async () => {
  const { servico, relogio, layout, logger } = montar({ ligada: false });

  const resultado = await servico.aguardar(entrada());

  assert.deepStrictEqual(resultado, {
    retomar: false,
    motivoDaDesistencia: 'espera desligada por --no-wait-on-limit',
  });
  assert.strictEqual(layout.inicios.length, 0);
  assert.strictEqual(relogio.esperas.length, 0);
  assert.strictEqual(logger.eventos.length, 0);
  assert.strictEqual(servico.acumuladoSegundos, 0);
});

test('horario conhecido alem do teto nao inicia espera e nomeia horario e teto', async () => {
  const { servico, layout, relogio } = montar({ tetoAcumuladoSegundos: 600 });

  const resultado = await servico.aguardar(
    entrada({ textoBruto: 'usage limit reached, try again in 30 minutes' }),
  );

  assert.strictEqual(resultado.retomar, false);
  assert.strictEqual(
    resultado.motivoDaDesistencia,
    'renovacao da cota prevista para 14:30, alem do teto de 10m 00s de --max-wait',
  );
  assert.strictEqual(layout.inicios.length, 0);
  assert.strictEqual(relogio.esperas.length, 0);
});

test('a terceira tentativa com horario conhecido desiste com a mensagem literal', async () => {
  const { servico, relogio, layout } = montar();

  const primeira = await servico.aguardar(entrada({ tentativa: 1 }));
  const segunda = await servico.aguardar(entrada({ tentativa: 2 }));
  const terceira = await servico.aguardar(entrada({ tentativa: 3 }));

  assert.strictEqual(primeira.retomar, true);
  assert.strictEqual(segunda.retomar, true);
  assert.deepStrictEqual(terceira, {
    retomar: false,
    motivoDaDesistencia: 'limite de uso persiste apos 3 tentativas',
  });
  // Tres execucoes e duas esperas.
  assert.strictEqual(layout.inicios.length, 2);
  assert.ok(relogio.esperas.length > 0);
});

test('sondagem nao tem limite de tentativas: so o teto acumulado freia o lote', async () => {
  const { servico, layout } = montar({ tetoAcumuladoSegundos: TETO_6H, isTTY: false });
  const desconhecido = 'Claude usage limit reached';

  let esperas = 0;
  let ultima = { retomar: true, motivoDaDesistencia: null as string | null };

  for (let tentativa = 1; tentativa <= 200 && ultima.retomar; tentativa += 1) {
    ultima = await servico.aguardar(entrada({ textoBruto: desconhecido, tentativa }));
    if (ultima.retomar) {
      esperas += 1;
      assert.ok(
        servico.acumuladoSegundos <= TETO_6H,
        'nenhuma espera pode ultrapassar o teto acumulado',
      );
    }
  }

  // 6 horas em sondagens de 5 minutos, muito alem das 3 tentativas do horario
  // conhecido: com horario desconhecido nao ha limite de tentativas (D6).
  assert.strictEqual(esperas, TETO_6H / 300);
  assert.strictEqual(servico.acumuladoSegundos, TETO_6H);
  assert.strictEqual(ultima.motivoDaDesistencia, 'teto de espera de 6h 00m esgotado sem renovacao da cota');
  assert.strictEqual(layout.inicios.length, TETO_6H / 300);
});

test('a ultima sondagem e truncada no que resta do teto', async () => {
  const { servico, relogio } = montar({ tetoAcumuladoSegundos: 400, isTTY: false });
  const desconhecido = 'Claude usage limit reached';

  await servico.aguardar(entrada({ textoBruto: desconhecido, tentativa: 1 }));
  await servico.aguardar(entrada({ textoBruto: desconhecido, tentativa: 2 }));
  const terceira = await servico.aguardar(entrada({ textoBruto: desconhecido, tentativa: 3 }));

  assert.strictEqual(servico.acumuladoSegundos, 400);
  assert.strictEqual(terceira.retomar, false);
  assert.strictEqual(relogio.agora(), AGORA + 400 * 1000);
});

test('a sondagem publica o aviso de horario desconhecido pelo canal unico', async () => {
  const { servico, layout } = montar({ tetoAcumuladoSegundos: 600, isTTY: false });

  await servico.aguardar(entrada({ textoBruto: 'Claude usage limit reached' }));

  assert.deepStrictEqual(layout.mensagens[0], [
    'info',
    'limite de uso sem horario de renovacao informado - nova tentativa a cada 5min, ate o teto de 10m 00s',
  ]);
});

test('o teto acumulado e compartilhado entre esperas da mesma instancia', async () => {
  const { servico } = montar();
  const cincoMin = 'usage limit reached, try again in 5 minutes';

  await servico.aguardar(entrada({ textoBruto: cincoMin, tentativa: 1 }));
  await servico.aguardar(entrada({ textoBruto: cincoMin, contexto: 'context_pack', task: null, tentativa: 2 }));

  assert.strictEqual(servico.acumuladoSegundos, 2 * (5 * 60 + 30));
});

test('a construcao do destilado grava task nulo nos dois eventos', async () => {
  const { servico, logger } = montar();

  await servico.aguardar(entrada({ contexto: 'context_pack', task: null }));

  assert.strictEqual(eventos(logger, 'aguardando_limite')[0].task, null);
  assert.strictEqual(eventos(logger, 'retomada')[0].task, null);
});

test('o aborto encerra a espera dentro de 1 s de tempo simulado (RNF-003)', async () => {
  const controle = new AbortController();
  const relogio = new RelogioFalso();
  relogio.aoEsperar = () => controle.abort();
  const { servico, layout, logger } = montar({ relogio, isTTY: true });

  const resultado = await servico.aguardar(
    entrada({
      textoBruto: 'usage limit reached, try again in 60 minutes',
      signal: controle.signal,
    }),
  );

  assert.strictEqual(relogio.agora() - AGORA <= 1000, true);
  assert.strictEqual(resultado.retomar, false);
  assert.strictEqual(resultado.motivoDaDesistencia, 'espera interrompida pelo usuario');
  assert.strictEqual(eventos(logger, 'retomada').length, 0);
  assert.strictEqual(layout.fins.length, 1);
});

test('fora de TTY uma espera de 1 hora produz uma linha de entrada, tres periodicas e uma de retomada', async () => {
  const { servico, layout } = montar({ isTTY: false });
  const renovacao = new Date(AGORA + 3570 * 1000).toISOString();

  const resultado = await servico.aguardar(
    entrada({ textoBruto: `Claude usage limit reached, reset at ${renovacao}` }),
  );

  assert.strictEqual(resultado.retomar, true);
  assert.strictEqual(layout.inicios.length, 1);
  assert.strictEqual(layout.atualizacoes.length, 3);
  assert.strictEqual(layout.fins.length, 1);
  assert.strictEqual(layout.fins[0], 3600);

  // Intervalo maximo de 15 minutos entre linhas consecutivas.
  const restantes = [3600, ...layout.atualizacoes.map((estado) => estado.restanteSegundos), 0];
  for (let i = 1; i < restantes.length; i += 1) {
    assert.ok(restantes[i - 1] - restantes[i] <= 900, 'nenhum intervalo passa de 15 minutos');
  }
});
