import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStore, writeStore } from './store.js';

const app = express();
const PORT = Number(process.env.PORT || 3333);
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';
const cookieName = 'ink_session';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const TIMES = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];
const STYLES = ['Fine line','Blackwork','Realismo','Ornamental','Tradicional'];

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(express.json({ limit: '9mb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } });
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Muitas solicitações. Tente novamente mais tarde.' } });

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i < 0 ? [v, ''] : [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}
function setSessionCookie(res, token) {
  const bits = [`${cookieName}=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${Math.floor(SESSION_TTL / 1000)}`];
  if (isProd) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isProd ? '; Secure' : ''}`);
}
function auth(req, res, next) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  const db = readStore();
  const digest = hashToken(token);
  const session = db.sessions.find(s => safeEqual(s.tokenHash, digest) && s.expiresAt > Date.now());
  if (!session) {
    db.sessions = db.sessions.filter(s => s.expiresAt > Date.now());
    writeStore(db);
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  }
  req.sessionDigest = digest;
  next();
}
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const d = new Date(`${date}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
function isSlotTaken(bookings, date, time, ignoreId = null) {
  return bookings.some(b => b.id !== ignoreId && b.date === date && b.time === time && ['Pendente','Confirmado'].includes(b.status));
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ink-studio-api' }));
app.get('/api/photos', (_req, res) => {
  const db = readStore();
  res.json({ photos: db.photos || [] });
});
app.get('/api/public-config', (_req, res) => res.json({ whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '') }));
app.get('/api/availability', (req, res) => {
  const date = String(req.query.date || '');
  if (!validDate(date)) return res.status(400).json({ error: 'Data inválida.' });
  const db = readStore();
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (date < localToday) return res.json({ times: [] });
  const times = TIMES.filter(t => !isSlotTaken(db.bookings, date, t));
  res.json({ times });
});

app.post('/api/bookings', bookingLimiter, (req, res) => {
  const { name, phone, style, date, time, description = '' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return res.status(400).json({ error: 'Informe seu nome (2 a 100 caracteres).' });
  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10 || phone.length > 30) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
  if (!STYLES.includes(style)) return res.status(400).json({ error: 'Selecione um estilo válido.' });
  if (!validDate(date)) return res.status(400).json({ error: 'Informe uma data válida.' });
  if (!TIMES.includes(time)) return res.status(400).json({ error: 'Selecione um horário disponível.' });
  if (typeof description !== 'string' || description.length > 1200) return res.status(400).json({ error: 'A descrição deve ter no máximo 1.200 caracteres.' });
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (date < today) return res.status(400).json({ error: 'Não é possível solicitar uma data que já passou.' });
  const db = readStore();
  if (isSlotTaken(db.bookings, date, time)) return res.status(409).json({ error: 'Esse horário acabou de ser solicitado ou reservado. Escolha outro.' });
  const booking = {
    id: crypto.randomUUID(), name: name.trim(), phone: phone.trim(), style, date, time,
    description: description.trim(), status: 'Pendente', createdAt: new Date().toISOString()
  };
  db.bookings.push(booking);
  writeStore(db);
  res.status(201).json({ booking, message: 'Solicitação enviada. Aguarde a confirmação do estúdio.' });
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD_HASH || '';
  if (!expected || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(expected)) return res.status(503).json({ error: 'A senha administrativa ainda não foi configurada. Execute npm run setup:admin.' });
  const [, salt, stored] = expected.split('$');
  const actual = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  if (!safeEqual(actual, stored)) return res.status(401).json({ error: 'Senha incorreta.' });
  const token = crypto.randomBytes(32).toString('base64url');
  const db = readStore();
  db.sessions = db.sessions.filter(s => s.expiresAt > Date.now());
  db.sessions.push({ tokenHash: hashToken(token), expiresAt: Date.now() + SESSION_TTL });
  writeStore(db);
  setSessionCookie(res, token);
  res.json({ authenticated: true });
});
app.get('/api/admin/session', auth, (_req, res) => res.json({ authenticated: true }));
app.post('/api/admin/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (token) {
    const db = readStore();
    const digest = hashToken(token);
    db.sessions = db.sessions.filter(s => !safeEqual(s.tokenHash, digest));
    writeStore(db);
  }
  clearSessionCookie(res);
  res.json({ authenticated: false });
});
app.get('/api/admin/bookings', auth, (_req, res) => {
  const db = readStore();
  res.json({ bookings: [...db.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
app.patch('/api/admin/bookings/:id', auth, (req, res) => {
  const { status } = req.body || {};
  if (!['Confirmado','Recusado','Cancelado'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  const db = readStore();
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Solicitação não encontrada.' });
  if (status === 'Confirmado' && isSlotTaken(db.bookings, booking.date, booking.time, booking.id)) return res.status(409).json({ error: 'Já existe outro pedido pendente ou confirmado nesse horário.' });
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  writeStore(db);
  res.json({ booking });
});
app.post('/api/admin/photos', auth, (req, res) => {
  const { title, type, place = '', client = '', dataUrl } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) return res.status(400).json({ error: 'Informe um título com até 80 caracteres.' });
  if (!STYLES.includes(type)) return res.status(400).json({ error: 'Selecione um estilo válido.' });
  if (typeof place !== 'string' || place.length > 80 || typeof client !== 'string' || client.length > 80) return res.status(400).json({ error: 'Região ou cliente excede o limite de caracteres.' });
  if (typeof dataUrl !== 'string') return res.status(400).json({ error: 'Selecione uma imagem.' });
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'A imagem deve ter no máximo 6 MB.' });
  const ext = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  const id = crypto.randomUUID();
  const uploadDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, `${id}.${ext}`), buffer, { flag: 'wx' });
  const photo = { id, title: title.trim(), type, place: place.trim(), client: client.trim(), image: `/uploads/${id}.${ext}`, createdAt: new Date().toISOString() };
  const db = readStore();
  db.photos = [...(db.photos || []), photo];
  writeStore(db);
  res.status(201).json({ photo });
});
app.delete('/api/admin/photos/:id', auth, (req, res) => {
  const db = readStore();
  const photo = (db.photos || []).find(item => item.id === req.params.id);
  if (!photo) return res.status(404).json({ error: 'Foto não encontrada.' });
  db.photos = db.photos.filter(item => item.id !== req.params.id);
  writeStore(db);
  const filename = path.basename(photo.image || '');
  if (filename) { try { fs.unlinkSync(path.join(__dirname, 'uploads', filename)); } catch {} }
  res.json({ deleted: true });
});

app.delete('/api/admin/bookings/:id', auth, (req, res) => {
  const db = readStore();
  const before = db.bookings.length;
  db.bookings = db.bookings.filter(b => b.id !== req.params.id);
  if (before === db.bookings.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });
  writeStore(db);
  res.json({ deleted: true });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
  app.get('/', (_req, res) => res.status(200).send('INK STUDIO API ativa. Execute também o Vite em http://localhost:5173.'));
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`INK STUDIO API ativa em http://127.0.0.1:${PORT}`);
  if (!process.env.ADMIN_PASSWORD_HASH) console.log('Configure a senha com: npm run setup:admin');
});