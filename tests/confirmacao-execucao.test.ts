import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import {
  confirmarExecucao,
  devePerguntar,
  montarPergunta,
} from '../dist/utils/confirmacao-execucao.js';
import type { DecisaoDeConfirmacao } from '../dist/utils/confirmacao-execucao.js';
import { LEVEL, createPainter } from '../dist/utils/terminal/index.js';
import type { Painter } from '../dist/utils/terminal/index.js';

const PERGUNTA = {
  tasks: 3,
  ferramenta: 'claudecode',
  model: 'opus',
  effort: 'high',
  acessoTotal: false,
};

function painterNenhum(): Painter {
  return createPainter(LEVEL.NONE);
}

function coletarSaida(stream: PassThrough): { texto: () => string } {
  let conteudo = '';
  stream.on('data', (pedaco: Buffer | string) => {
    conteudo += pedaco.toString();
  });
  return { texto: () => conteudo };
}

async function decidirCom(
  respostas: string[],
  painter: Painter = painterNenhum()
): Promise<{ decisao: DecisaoDeConfirmacao; saida: string }> {
  const entrada = new PassThrough();
  const saida = new PassThrough();
  const registrada = coletarSaida(saida);
  const pendente = confirmarExecucao(montarPergunta(PERGUNTA), {
    entrada,
    saida,
    painter,
  });
  for (const resposta of respostas) {
    entrada.write(`${resposta}\n`);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return { decisao: await pendente, saida: registrada.texto() };
}

test('devePerguntar: tabela-verdade completa das quatro condicoes (16 combinacoes)', () => {
  for (const yes of [false, true]) {
    for (const dryRun of [false, true]) {
      for (const stdinIsTTY of [false, true]) {
        for (const ci of [false, true]) {
          const condicoes = { yes, dryRun, stdinIsTTY, ci };
          const esperado = !yes && !dryRun && stdinIsTTY && !ci;
          assert.equal(
            devePerguntar(condicoes),
            esperado,
            `yes=${yes} dryRun=${dryRun} stdinIsTTY=${stdinIsTTY} ci=${ci}`
          );
        }
      }
    }
  }
});

test('devePerguntar: so pergunta com TTY, sem CI, sem --yes e sem --dry-run', () => {
  assert.equal(
    devePerguntar({ yes: false, dryRun: false, stdinIsTTY: true, ci: false }),
    true
  );
  assert.equal(
    devePerguntar({ yes: false, dryRun: false, stdinIsTTY: true, ci: true }),
    false
  );
  assert.equal(
    devePerguntar({ yes: false, dryRun: false, stdinIsTTY: false, ci: false }),
    false
  );
});

test('montarPergunta: texto base com tasks, ferramenta, modelo e esforco', () => {
  assert.equal(
    montarPergunta(PERGUNTA),
    'iniciar a execucao? 3 tasks com claudecode/opus/high'
  );
});

test('montarPergunta: (acesso total) presente apenas quando acessoTotal', () => {
  assert.equal(
    montarPergunta({ ...PERGUNTA, acessoTotal: true }),
    'iniciar a execucao? 3 tasks com claudecode/opus/high (acesso total)'
  );
  assert.equal(
    montarPergunta({ ...PERGUNTA, acessoTotal: false }),
    'iniciar a execucao? 3 tasks com claudecode/opus/high'
  );
});

test('montarPergunta: pergunta toda em ASCII imprimivel, sem acento (RNF-003)', () => {
  const texto = montarPergunta({ ...PERGUNTA, acessoTotal: true });
  assert.match(texto, /^[\x20-\x7E]+$/);
});

test('Enter confirma, porque o padrao da pergunta e Y', async () => {
  const { decisao } = await decidirCom(['']);
  assert.equal(decisao, 'confirmado');
});

test('as confirmacoes sao aceitas em qualquer caixa', async () => {
  for (const resposta of ['', 'y', 'Y', 'yes', 'YES', 'Yes', 's', 'S', 'sim', 'Sim', 'SIM']) {
    const { decisao } = await decidirCom([resposta]);
    assert.equal(decisao, 'confirmado', `resposta: ${JSON.stringify(resposta)}`);
  }
});

test('as recusas sao aceitas em qualquer caixa', async () => {
  for (const resposta of ['n', 'N', 'no', 'NO', 'No', 'nao', 'NAO', 'Nao']) {
    const { decisao } = await decidirCom([resposta]);
    assert.equal(decisao, 'recusado', `resposta: ${JSON.stringify(resposta)}`);
  }
});

test('resposta invalida re-pergunta e a resposta seguinte decide', async () => {
  const { decisao, saida } = await decidirCom(['talvez', 'n']);
  assert.equal(decisao, 'recusado');
  const repeticoes = saida.split('iniciar a execucao?').length - 1;
  assert.equal(repeticoes, 2);
});

test('resposta invalida em branco com espacos tambem confirma (Enter)', async () => {
  const { decisao } = await decidirCom(['   ']);
  assert.equal(decisao, 'confirmado');
});

test('EOF sem resposta devolve interrompido e nunca inicia o lote', async () => {
  const entrada = new PassThrough();
  const saida = new PassThrough();
  const pendente = confirmarExecucao(montarPergunta(PERGUNTA), {
    entrada,
    saida,
    painter: painterNenhum(),
  });
  entrada.destroy();
  assert.equal(await pendente, 'interrompido');
});

test('SIGINT de processo durante a pergunta devolve interrompido', async () => {
  const entrada = new PassThrough();
  const saida = new PassThrough();
  const pendente = confirmarExecucao(montarPergunta(PERGUNTA), {
    entrada,
    saida,
    painter: painterNenhum(),
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  process.emit('SIGINT', 'SIGINT');
  assert.equal(await pendente, 'interrompido');
});

test('com Painter LEVEL.NONE a pergunta sai sem nenhuma sequencia ANSI (RNF-003)', async () => {
  const { decisao, saida } = await decidirCom(['s']);
  assert.equal(decisao, 'confirmado');
  assert.ok(!saida.includes('\x1b'));
  assert.ok(
    saida.includes('> iniciar a execucao? 3 tasks com claudecode/opus/high (Y/n)')
  );
});

test('com cor, a pergunta sai com as sequencias da paleta', async () => {
  const { decisao, saida } = await decidirCom(['y'], createPainter(LEVEL.TRUECOLOR));
  assert.equal(decisao, 'confirmado');
  assert.ok(saida.includes('\x1b['));
});

test('apos qualquer desfecho a interface readline e fechada e ignora entrada nova', async () => {
  const entrada = new PassThrough();
  const saida = new PassThrough();
  const registrada = coletarSaida(saida);
  const pendente = confirmarExecucao(montarPergunta(PERGUNTA), {
    entrada,
    saida,
    painter: painterNenhum(),
  });
  entrada.write('n\n');
  assert.equal(await pendente, 'recusado');
  entrada.write('y\n');
  await new Promise<void>((resolve) => setImmediate(resolve));
  const repeticoes = registrada.texto().split('iniciar a execucao?').length - 1;
  assert.equal(repeticoes, 1);
});
