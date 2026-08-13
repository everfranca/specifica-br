import os from 'os';
import path from 'path';
import type { GlobalBase, GlobalPath } from '../types/init.js';

function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Diretorio home do usuario. `os.homedir()` ja cobre Linux, macOS e Windows,
 * mas mantemos o fallback por HOME/USERPROFILE para ambientes onde ele falha
 * (containers sem entrada em /etc/passwd, por exemplo).
 */
export function resolveHome(): string {
  const candidates = [os.homedir(), process.env.HOME, process.env.USERPROFILE];

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate;
    }
  }

  throw new Error('Erro: Não foi possível determinar o diretório do usuário (HOME/USERPROFILE).');
}

/**
 * Diretorio de configuracao por usuario:
 * - Windows: %APPDATA% (fallback <home>/AppData/Roaming)
 * - Linux e macOS: $XDG_CONFIG_HOME (fallback <home>/.config)
 */
export function resolveConfigHome(): string {
  if (isWindows()) {
    const appData = process.env.APPDATA;

    if (appData && appData.trim().length > 0) {
      return appData;
    }

    return path.join(resolveHome(), 'AppData', 'Roaming');
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return xdgConfigHome;
  }

  return path.join(resolveHome(), '.config');
}

export function resolveBase(base: GlobalBase): string {
  return base === 'config' ? resolveConfigHome() : resolveHome();
}

export function resolveGlobalPath(entry: GlobalPath): string {
  return path.join(resolveBase(entry.base), entry.path);
}

/**
 * Encurta o caminho para exibicao, trocando o home do usuario por `~`.
 * Somente cosmetico: o caminho real continua sendo o absoluto.
 */
export function shortenPath(target: string): string {
  let home: string;

  try {
    home = resolveHome();
  } catch {
    return target;
  }

  if (target === home) {
    return '~';
  }

  if (target.startsWith(home + path.sep)) {
    return '~' + target.slice(home.length);
  }

  return target;
}
