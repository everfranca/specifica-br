import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import fs from 'fs-extra';

import { ProcessRunner } from '../dist/utils/process-runner.js';

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: (sinal?: string) => boolean;
  killSinal?: string;
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (sinal?: string): boolean => {
    child.killSinal = sinal;
    return true;
  };
  return child;
}

interface FakeSpawn {
  spawnFn: any;
  calls: Array<{ cmd: string; args: string[]; opts: any; child: FakeChild }>;
  onSpawn?: (child: FakeChild) => void;
}

function fakeSpawn(): FakeSpawn {
  const estado: FakeSpawn = {
    calls: [],
    spawnFn: (cmd: string, args: string[], opts: any): FakeChild => {
      const child = fakeChild();
      estado.calls.push({ cmd, args, opts, child });
      if (estado.onSpawn) {
        queueMicrotask(() => estado.onSpawn!(child));
      }
      return child;
    },
  };
  return estado;
}

async function tmpDir(prefixo: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefixo));
}

test('which devolve caminho absoluto para um executavel conhecido', async () => {
  const runner = new ProcessRunner();
  const resolvido = await runner.which(process.execPath);
  assert.equal(resolvido, path.resolve(process.execPath));
});

test('which devolve null para binario inexistente sem lancar', async () => {
  const runner = new ProcessRunner();
  const resolvido = await runner.which('binario-que-nao-existe-xyz-123');
  assert.equal(resolvido, null);
});

test('run executa e devolve exitCode 0 e stdout no evento close', async () => {
  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'linux', spawnFn: spawn.spawnFn });
  spawn.onSpawn = (child) => {
    child.stdout.write('linha1\nlinha2');
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  const resultado = await runner.run(process.execPath, ['-e', '']);
  assert.equal(resultado.exitCode, 0);
  assert.equal(resultado.spawnFailed, false);
  assert.equal(resultado.stdout, 'linha1\nlinha2');
});

test('run usa shell false e stdin ignore por padrao', async () => {
  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'linux', spawnFn: spawn.spawnFn });
  spawn.onSpawn = (child) => {
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  await runner.run(process.execPath, []);
  assert.equal(spawn.calls[0].opts.shell, false);
  assert.deepEqual(spawn.calls[0].opts.stdio, ['ignore', 'pipe', 'pipe']);
});

test('runCapturingFirstLine devolve a primeira linha do stdout', async () => {
  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'linux', spawnFn: spawn.spawnFn });
  spawn.onSpawn = (child) => {
    child.stdout.write('1.2.3 (build abc)\noutra linha');
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  const primeira = await runner.runCapturingFirstLine(process.execPath, ['--version']);
  assert.equal(primeira, '1.2.3 (build abc)');
});

test('which devolve null quando PATH esta ausente, sem lancar', async () => {
  const runner = new ProcessRunner({ platform: 'linux' });
  assert.equal(await runner.which('git', {}), null);
});

test('which descarta entrada vazia de PATH e nao resolve no diretorio corrente', async () => {
  const dir = await tmpDir('pr-cwd-');
  const plantado = path.join(dir, 'evil-cmd');
  await fs.writeFile(plantado, '#!/bin/sh\necho pwned\n');
  await fs.chmod(plantado, 0o755);

  const runner = new ProcessRunner({ platform: 'linux' });
  const cwdOriginal = process.cwd();
  process.chdir(dir);

  try {
    const resolvido = await runner.which('evil-cmd', { PATH: `${path.delimiter}/nao-existe` });
    assert.equal(resolvido, null);
  } finally {
    process.chdir(cwdOriginal);
    await fs.remove(dir);
  }
});

test('which respeita PATHEXT no Windows', async () => {
  const dir = await tmpDir('pr-ext-');
  const alvo = path.join(dir, 'tool.CMD');
  await fs.writeFile(alvo, '');

  const runner = new ProcessRunner({ platform: 'win32' });
  try {
    const resolvido = await runner.which('tool', { PATH: dir, PATHEXT: '.EXE;.CMD' });
    assert.equal(resolvido, alvo);
  } finally {
    await fs.remove(dir);
  }
});

test('no Windows um alvo .cmd e invocado atraves do ComSpec com os argumentos em array', async () => {
  const dir = await tmpDir('pr-win-');
  const alvo = path.join(dir, 'claude.cmd');
  await fs.writeFile(alvo, '');

  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'win32', spawnFn: spawn.spawnFn });
  spawn.onSpawn = (child) => {
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  try {
    await runner.run(alvo, ['-p', 'x'], {
      env: { PATH: dir, ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    });
    assert.equal(spawn.calls[0].cmd, 'C:\\Windows\\System32\\cmd.exe');
    assert.deepEqual(spawn.calls[0].args, ['/d', '/s', '/c', alvo, '-p', 'x']);
    assert.equal(spawn.calls[0].opts.shell, false);
  } finally {
    await fs.remove(dir);
  }
});

test('run resolve no evento close, e nao em exit, devolvendo o stdout completo', async () => {
  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'linux', spawnFn: spawn.spawnFn });
  spawn.onSpawn = (child) => {
    child.stdout.write('{"a":');
    child.emit('exit', 0, null);
    child.stdout.write('1}');
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  const resultado = await runner.run(process.execPath, []);
  assert.equal(resultado.stdout, '{"a":1}');
});

test('run devolve spawnFailed quando o comando nao existe, sem lancar', async () => {
  const runner = new ProcessRunner({ platform: 'linux' });
  const resultado = await runner.run('binario-que-nao-existe-xyz-123', []);
  assert.equal(resultado.spawnFailed, true);
  assert.equal(resultado.exitCode, -1);
});

test('run com timeout marca timedOut e encerra o processo', async () => {
  const runner = new ProcessRunner();
  const resultado = await runner.run(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    { timeoutMs: 300 }
  );
  assert.equal(resultado.timedOut, true);
  assert.equal(resultado.spawnFailed, false);
});

test('run invoca onStderrChunk para cada pedaco de stderr', async () => {
  const spawn = fakeSpawn();
  const runner = new ProcessRunner({ platform: 'linux', spawnFn: spawn.spawnFn });
  const pedacos: string[] = [];
  spawn.onSpawn = (child) => {
    child.stderr.write('a');
    child.stderr.write('b');
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0, null);
  };

  const resultado = await runner.run(process.execPath, [], {
    onStderrChunk: (pedaco) => pedacos.push(pedaco),
  });
  assert.deepEqual(pedacos, ['a', 'b']);
  assert.equal(resultado.stderr, 'ab');
});

test('run mata o filho quando o signal e abortado (RF-024)', async () => {
  const runner = new ProcessRunner();
  const cancelamento = new AbortController();
  setTimeout(() => cancelamento.abort(), 200);

  const resultado = await runner.run(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    { signal: cancelamento.signal }
  );

  assert.equal(resultado.aborted, true);
  assert.equal(resultado.timedOut, false);
  assert.equal(resultado.spawnFailed, false);
  assert.equal(resultado.signal, 'SIGTERM');
});

test('run com signal ja abortado nao deixa o filho vivo', async () => {
  const runner = new ProcessRunner();
  const resultado = await runner.run(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    { signal: AbortSignal.abort() }
  );

  assert.equal(resultado.aborted, true);
  assert.equal(resultado.spawnFailed, false);
});

test('run sem aborto devolve aborted false', async () => {
  const runner = new ProcessRunner();
  const cancelamento = new AbortController();
  const resultado = await runner.run(process.execPath, ['-e', 'process.exit(0)'], {
    signal: cancelamento.signal,
  });

  assert.equal(resultado.aborted, false);
  assert.equal(resultado.exitCode, 0);
});
