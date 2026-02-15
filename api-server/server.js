// ═══════════════════════════════════════════════════════════════
// BOLH API Server — Express + SQLite
// ═══════════════════════════════════════════════════════════════
import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'bolh_super_secret_key_2026';
const UPLOADS_DIR = join(__dirname, 'uploads');
const DB_PATH = join(__dirname, 'bolh.db');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Database (sql.js) ──
const SQL = await initSqlJs();
let rawDb;
try {
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buf);
  } else {
    rawDb = new SQL.Database();
  }
} catch {
  rawDb = new SQL.Database();
}

// Wrapper to match better-sqlite3 style API
const db = {
  exec: (sql) => rawDb.run(sql),
  prepare: (sql) => ({
    run: (...params) => { rawDb.run(sql, params); },
    get: (...params) => {
      const stmt = rawDb.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const results = [];
      const stmt = rawDb.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        results.push(row);
      }
      stmt.free();
      return results;
    },
  }),
  pragma: () => {},
  save: () => {
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  },
};

// Auto-save every 30 seconds
setInterval(() => { try { db.save(); } catch {} }, 30000);
process.on('exit', () => { try { db.save(); } catch {} });
process.on('SIGINT', () => { try { db.save(); } catch {} process.exit(0); });

// ── Create tables ──
db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    avatar TEXT,
    bio TEXT DEFAULT '',
    rating REAL DEFAULT 5.0,
    reviews_count INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 1,
    lat REAL,
    lng REAL,
    password_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- User skills (for workers)
  CREATE TABLE IF NOT EXISTS user_skills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    has_diploma INTEGER DEFAULT 0,
    price_per_hour INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Orders
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    worker_id TEXT REFERENCES users(id),
    department_id TEXT NOT NULL,
    skill_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    address TEXT,
    scheduled_at TEXT,
    duration_hours REAL DEFAULT 1,
    budget INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Chat messages
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT NOT NULL REFERENCES users(id),
    order_id TEXT REFERENCES orders(id),
    text TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Reviews
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    target_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Payments
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id),
    payer_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT DEFAULT 'card',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
  CREATE INDEX IF NOT EXISTS idx_orders_worker ON orders(worker_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
`);

// ── Express app ──
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// ── File upload ──
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = file.originalname.split('.').pop();
      cb(null, `${uuid()}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── Auth middleware ──
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Helper: generate token ──
function generateToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

// ═══════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════

// POST /api/auth/send-code  — send SMS (mock)
app.post('/api/auth/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  // In production: send real SMS via Twilio/SMS.ru etc.
  // For demo: always return success, code is "1234"
  console.log(`[SMS] Code 1234 sent to ${phone}`);
  res.json({ success: true, message: 'Code sent' });
});

// POST /api/auth/verify-code  — verify SMS code & login/register
app.post('/api/auth/verify-code', (req, res) => {
  const { phone, code, name, role } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });
  // Demo: accept any 4-digit code
  if (code.length !== 4) return res.status(400).json({ error: 'Invalid code' });

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  if (!user) {
    // Register new user
    const id = uuid();
    db.prepare('INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)').run(
      id, phone, name || 'User', role || 'client'
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    console.log(`[AUTH] New user registered: ${phone} (${role || 'client'})`);
  } else {
    console.log(`[AUTH] User logged in: ${phone}`);
  }

  const token = generateToken(user.id);
  res.json({ success: true, token, user: sanitizeUser(user) });
});

// GET /api/auth/me  — get current user
app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user) });
});

function sanitizeUser(u) {
  return {
    id: u.id, phone: u.phone, name: u.name, role: u.role,
    avatar: u.avatar, bio: u.bio, rating: u.rating,
    reviews_count: u.reviews_count, is_verified: !!u.is_verified,
    is_online: !!u.is_online, lat: u.lat, lng: u.lng,
    created_at: u.created_at,
  };
}

// ═══════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════

// PATCH /api/users/me  — update profile
app.patch('/api/users/me', auth, (req, res) => {
  const { name, bio, role, lat, lng, is_online } = req.body;
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (lat !== undefined) { fields.push('lat = ?'); values.push(lat); }
  if (lng !== undefined) { fields.push('lng = ?'); values.push(lng); }
  if (is_online !== undefined) { fields.push('is_online = ?'); values.push(is_online ? 1 : 0); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push("updated_at = datetime('now')");
  values.push(req.userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: sanitizeUser(user) });
});

// POST /api/users/me/avatar  — upload avatar
app.post('/api/users/me/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.prepare("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?").run(avatarUrl, req.userId);
  res.json({ avatar: avatarUrl });
});

// GET /api/users/:id  — get user profile
app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const skills = db.prepare('SELECT * FROM user_skills WHERE user_id = ?').all(user.id);
  const reviews = db.prepare('SELECT r.*, u.name as author_name FROM reviews r JOIN users u ON r.author_id = u.id WHERE r.target_id = ? ORDER BY r.created_at DESC LIMIT 20').all(user.id);
  res.json({ user: sanitizeUser(user), skills, reviews });
});

// GET /api/workers  — search workers (with filters)
app.get('/api/workers', (req, res) => {
  const { dept, skill, online, lat, lng, radius, min_rating, q, limit: lim, offset: off } = req.query;
  let sql = "SELECT * FROM users WHERE role = 'worker'";
  const params = [];

  if (online === '1') { sql += ' AND is_online = 1'; }
  if (min_rating) { sql += ' AND rating >= ?'; params.push(+min_rating); }
  if (q) { sql += ' AND name LIKE ?'; params.push(`%${q}%`); }
  if (dept) {
    sql += ' AND id IN (SELECT user_id FROM user_skills WHERE department_id = ?)';
    params.push(dept);
  }
  if (skill) {
    sql += ' AND id IN (SELECT user_id FROM user_skills WHERE skill_id = ?)';
    params.push(skill);
  }

  sql += ' ORDER BY rating DESC, reviews_count DESC';
  sql += ` LIMIT ? OFFSET ?`;
  params.push(+(lim || 20), +(off || 0));

  const workers = db.prepare(sql).all(...params).map(sanitizeUser);
  const total = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'worker'").get().c;
  res.json({ workers, total });
});

// ═══════════════════════════════════════
// SKILLS ROUTES
// ═══════════════════════════════════════

// POST /api/skills  — add skill to profile
app.post('/api/skills', auth, (req, res) => {
  const { department_id, skill_id, price_per_hour, has_diploma } = req.body;
  if (!department_id || !skill_id) return res.status(400).json({ error: 'Department and skill required' });
  const id = uuid();
  db.prepare('INSERT OR REPLACE INTO user_skills (id, user_id, department_id, skill_id, price_per_hour, has_diploma) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, department_id, skill_id, price_per_hour || 0, has_diploma ? 1 : 0);
  res.json({ success: true, id });
});

// DELETE /api/skills/:id  — remove skill
app.delete('/api/skills/:id', auth, (req, res) => {
  db.prepare('DELETE FROM user_skills WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

// GET /api/skills/me  — my skills
app.get('/api/skills/me', auth, (req, res) => {
  const skills = db.prepare('SELECT * FROM user_skills WHERE user_id = ?').all(req.userId);
  res.json({ skills });
});

// ═══════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════

// POST /api/orders  — create order
app.post('/api/orders', auth, (req, res) => {
  const { department_id, skill_id, address, scheduled_at, duration_hours, budget, notes, lat, lng } = req.body;
  if (!department_id) return res.status(400).json({ error: 'Department required' });
  const id = uuid();
  db.prepare(`INSERT INTO orders (id, client_id, department_id, skill_id, address, scheduled_at, duration_hours, budget, notes, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.userId, department_id, skill_id || null, address || '', scheduled_at || null, duration_hours || 1, budget || 0, notes || '', lat || null, lng || null);
  
  // Notify nearby workers (mock)
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.status(201).json({ order });
});

// GET /api/orders  — list my orders
app.get('/api/orders', auth, (req, res) => {
  const { status, role } = req.query;
  let sql;
  const params = [];
  if (role === 'worker') {
    sql = 'SELECT * FROM orders WHERE worker_id = ?';
  } else {
    sql = 'SELECT * FROM orders WHERE client_id = ?';
  }
  params.push(req.userId);
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  const orders = db.prepare(sql).all(...params);
  res.json({ orders });
});

// GET /api/orders/:id  — order detail
app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// PATCH /api/orders/:id  — update order status
app.patch('/api/orders/:id', auth, (req, res) => {
  const { status, worker_id } = req.body;
  const fields = [];
  const values = [];
  if (status) { fields.push('status = ?'); values.push(status); }
  if (worker_id) { fields.push('worker_id = ?'); values.push(worker_id); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({ order });
});

// ═══════════════════════════════════════
// CHAT / MESSAGES
// ═══════════════════════════════════════

// POST /api/messages  — send message
app.post('/api/messages', auth, (req, res) => {
  const { receiver_id, text, order_id } = req.body;
  if (!receiver_id || !text) return res.status(400).json({ error: 'Receiver and text required' });
  const id = uuid();
  db.prepare('INSERT INTO messages (id, sender_id, receiver_id, order_id, text) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, receiver_id, order_id || null, text);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  res.status(201).json({ message: msg });
});

// GET /api/messages/:userId  — chat history with user
app.get('/api/messages/:userId', auth, (req, res) => {
  const other = req.params.userId;
  const messages = db.prepare(
    'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC'
  ).all(req.userId, other, other, req.userId);
  // Mark as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0').run(other, req.userId);
  res.json({ messages });
});

// GET /api/chats  — list conversations
app.get('/api/chats', auth, (req, res) => {
  const chats = db.prepare(`
    SELECT 
      CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id,
      MAX(created_at) as last_at,
      COUNT(*) as msg_count,
      SUM(CASE WHEN receiver_id = ? AND is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM messages
    WHERE sender_id = ? OR receiver_id = ?
    GROUP BY other_id
    ORDER BY last_at DESC
  `).all(req.userId, req.userId, req.userId, req.userId);
  
  // Enrich with user info
  const enriched = chats.map(c => {
    const user = db.prepare('SELECT id, name, avatar, is_online FROM users WHERE id = ?').get(c.other_id);
    const lastMsg = db.prepare('SELECT text, created_at FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1')
      .get(req.userId, c.other_id, c.other_id, req.userId);
    return { ...c, user, last_message: lastMsg };
  });
  res.json({ chats: enriched });
});

// ═══════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════

// POST /api/reviews  — leave review
app.post('/api/reviews', auth, (req, res) => {
  const { target_id, order_id, rating, text } = req.body;
  if (!target_id || !rating) return res.status(400).json({ error: 'Target and rating required' });
  const id = uuid();
  db.prepare('INSERT INTO reviews (id, order_id, author_id, target_id, rating, text) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, order_id || null, req.userId, target_id, rating, text || '');
  // Update target's average rating
  const stats = db.prepare('SELECT AVG(rating) as avg_r, COUNT(*) as cnt FROM reviews WHERE target_id = ?').get(target_id);
  db.prepare('UPDATE users SET rating = ?, reviews_count = ? WHERE id = ?').run(
    Math.round(stats.avg_r * 10) / 10, stats.cnt, target_id
  );
  res.status(201).json({ success: true });
});

// GET /api/reviews/:userId  — reviews for user
app.get('/api/reviews/:userId', (req, res) => {
  const reviews = db.prepare(
    'SELECT r.*, u.name as author_name, u.avatar as author_avatar FROM reviews r JOIN users u ON r.author_id = u.id WHERE r.target_id = ? ORDER BY r.created_at DESC'
  ).all(req.params.userId);
  res.json({ reviews });
});

// ═══════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════

// GET /api/notifications  — my notifications
app.get('/api/notifications', auth, (req, res) => {
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.userId);
  res.json({ notifications: notifs });
});

// PATCH /api/notifications/read-all
app.patch('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.userId);
  res.json({ success: true });
});

// ═══════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════

// POST /api/payments  — create payment
app.post('/api/payments', auth, (req, res) => {
  const { order_id, receiver_id, amount, method } = req.body;
  if (!receiver_id || !amount) return res.status(400).json({ error: 'Receiver and amount required' });
  const id = uuid();
  db.prepare('INSERT INTO payments (id, order_id, payer_id, receiver_id, amount, method) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, order_id || null, req.userId, receiver_id, amount, method || 'card');
  res.status(201).json({ payment: { id, status: 'pending' } });
});

// GET /api/payments  — my payments
app.get('/api/payments', auth, (req, res) => {
  const payments = db.prepare('SELECT * FROM payments WHERE payer_id = ? OR receiver_id = ? ORDER BY created_at DESC').all(req.userId, req.userId);
  res.json({ payments });
});

// ═══════════════════════════════════════
// UPLOAD (general file upload)
// ═══════════════════════════════════════
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

// ═══════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════
app.get('/api/health', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: { users: userCount, orders: orderCount },
  });
});

// ═══════════════════════════════════════
// SEED DATA (create some demo workers)
// ═══════════════════════════════════════
function seedDemoData() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (existing > 0) return; // Already seeded

  console.log('[SEED] Creating demo data...');
  const demoWorkers = [
    { phone: '+77001234501', name: 'Алексей Козлов', role: 'worker', dept: 'plumbing', skill: 'plumb_general', price: 4000 },
    { phone: '+77001234502', name: 'Дмитрий Сидоров', role: 'worker', dept: 'electrical', skill: 'elec_general', price: 4500 },
    { phone: '+77001234503', name: 'Максим Иванов', role: 'worker', dept: 'cleaning', skill: 'clean_general', price: 3000 },
    { phone: '+77001234504', name: 'Артём Петров', role: 'worker', dept: 'security', skill: 'sec_bodyguard', price: 5500 },
    { phone: '+77001234505', name: 'Иван Волков', role: 'worker', dept: 'handyman', skill: 'handy_general', price: 3500 },
    { phone: '+77001234506', name: 'Сергей Орлов', role: 'worker', dept: 'auto', skill: 'auto_mechanic', price: 5000 },
    { phone: '+77001234507', name: 'Мария Попова', role: 'worker', dept: 'beauty', skill: 'beauty_hair', price: 4000 },
    { phone: '+77001234508', name: 'Елена Кузнецова', role: 'worker', dept: 'health', skill: 'health_massage', price: 6000 },
    { phone: '+77001234509', name: 'Анна Лебедева', role: 'worker', dept: 'education', skill: 'edu_tutor', price: 3500 },
    { phone: '+77001234510', name: 'Олег Морозов', role: 'worker', dept: 'tech', skill: 'tech_pc_repair', price: 4000 },
    { phone: '+77001234511', name: 'Виктор Новиков', role: 'worker', dept: 'logistics', skill: 'logi_moving', price: 5000 },
    { phone: '+77001234512', name: 'Роман Зайцев', role: 'worker', dept: 'plumbing', skill: 'plumb_clog', price: 3500 },
  ];

  const insertUser = db.prepare('INSERT INTO users (id, phone, name, role, rating, reviews_count, is_verified, is_online, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSkill = db.prepare('INSERT INTO user_skills (id, user_id, department_id, skill_id, price_per_hour) VALUES (?, ?, ?, ?, ?)');

  // Almaty center coords with some offset
  const baseLat = 43.238949;
  const baseLng = 76.945465;

  for (const w of demoWorkers) {
    const id = uuid();
    const rating = +(4.2 + Math.random() * 0.8).toFixed(1);
    const reviews = Math.floor(20 + Math.random() * 180);
    const verified = Math.random() > 0.3 ? 1 : 0;
    const online = Math.random() > 0.2 ? 1 : 0;
    const lat = baseLat + (Math.random() - 0.5) * 0.05;
    const lng = baseLng + (Math.random() - 0.5) * 0.05;

    insertUser.run(id, w.phone, w.name, w.role, rating, reviews, verified, online, lat, lng);
    insertSkill.run(uuid(), id, w.dept, w.skill, w.price);
  }

  console.log(`[SEED] Created ${demoWorkers.length} demo workers`);
}

seedDemoData();

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n  ╔═══════════════════════════════════════╗`);
  console.log(`  ║   BOLH API Server v1.0.0              ║`);
  console.log(`  ║   Running on http://localhost:${PORT}    ║`);
  console.log(`  ╚═══════════════════════════════════════╝\n`);
  console.log(`  Endpoints:`);
  console.log(`    POST /api/auth/send-code`);
  console.log(`    POST /api/auth/verify-code`);
  console.log(`    GET  /api/auth/me`);
  console.log(`    GET  /api/workers?dept=&online=1&q=`);
  console.log(`    POST /api/orders`);
  console.log(`    GET  /api/orders`);
  console.log(`    POST /api/messages`);
  console.log(`    GET  /api/chats`);
  console.log(`    POST /api/reviews`);
  console.log(`    GET  /api/notifications`);
  console.log(`    POST /api/payments`);
  console.log(`    POST /api/upload`);
  console.log(`    GET  /api/health\n`);
});
