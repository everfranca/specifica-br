import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALVO = path.join(__dirname, '..', 'dist', 'index.js');
const SHEBANG = '#!/usr/bin/env node\n';

const conteudo = fs.readFileSync(ALVO, 'utf-8');

if (conteudo.startsWith(SHEBANG)) {
  process.exit(0);
}

fs.writeFileSync(ALVO, SHEBANG + conteudo, 'utf-8');
