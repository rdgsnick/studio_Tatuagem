import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));
try {
  const first = await ask('Crie uma senha para o painel (mínimo 10 caracteres): ');
  if (first.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');
  const second = await ask('Repita a senha: ');
  if (first !== second) throw new Error('As senhas não coincidem.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(first, salt, 64).toString('hex');
  let current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : 'PORT=3333\nNODE_ENV=development\nAPP_ORIGIN=http://localhost:5173\nWHATSAPP_NUMBER=\n';
  if (/^ADMIN_PASSWORD_HASH=.*$/m.test(current)) current = current.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH=scrypt$${salt}$${hash}`);
  else current += `\nADMIN_PASSWORD_HASH=scrypt$${salt}$${hash}\n`;
  fs.writeFileSync(envPath, current, { mode: 0o600 });
  console.log('Senha administrativa configurada. Ela não fica salva em texto puro.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { rl.close(); }
