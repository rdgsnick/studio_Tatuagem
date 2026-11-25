import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const dbFile = path.join(dataDir, 'db.json');

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ bookings: [], sessions: [] }, null, 2));
  }
}

export function readStore() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return { bookings: Array.isArray(data.bookings) ? data.bookings : [], sessions: Array.isArray(data.sessions) ? data.sessions : [], photos: Array.isArray(data.photos) ? data.photos : [] };
  } catch {
    throw new Error('O arquivo do banco local está inválido. Faça uma cópia antes de tentar recuperá-lo.');
  }
}

export function writeStore(data) {
  ensureStore();
  const temp = `${dbFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temp, dbFile);
}