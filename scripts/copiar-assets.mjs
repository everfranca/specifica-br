import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGEM = path.join(__dirname, '..', 'src', 'assets');
const DESTINO = path.join(__dirname, '..', 'dist');
const DESTINO_TOKENS = path.join(DESTINO, 'assets', 'tokens.json');

fs.cpSync(ORIGEM, DESTINO, { recursive: true });
fs.mkdirSync(path.dirname(DESTINO_TOKENS), { recursive: true });
fs.cpSync(path.join(ORIGEM, 'tokens.json'), DESTINO_TOKENS);
