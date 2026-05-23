const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./lib/db');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/auth.route');
const newsRoutes = require('./routes/news.routes');
const categoryRoutes = require('./routes/category.routes');
const userRoutes = require('./routes/user.routes');
const contactRoutes = require('./routes/contact.routes');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOADS_PATH = path.join(process.cwd(), 'uploads');
let server;

const allowedOrigins = (process.env.CORS_ORIGINS || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'https://api.legioners.uz',
  'https://legioners.uz',
  'https://www.legioners.uz',
].join(',')).split(',').map((v) => v.trim()).filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(allowedOrigins.includes(origin) ? null : new Error('Not allowed by CORS'), allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later.' },
}));

app.use('/uploads', express.static(UPLOADS_PATH, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));
app.use('/uz/uploads', express.static(UPLOADS_PATH, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/contact', contactRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/check', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', message: 'Database connected successfully' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Database check failed' });
  }
});

app.use((err, req, res, next) => {
  console.error('Request error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      reset_token TEXT,
      reset_expires TIMESTAMP,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_uz TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title_uz TEXT NOT NULL,
      title_ru TEXT NOT NULL,
      content_uz TEXT NOT NULL,
      content_ru TEXT NOT NULL,
      category_id TEXT,
      user_id TEXT,
      tags TEXT[],
      cover_image TEXT,
      youtube_url TEXT,
      publish_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      article_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, article_id)
    )
  `);

  try {
    await pool.query('ALTER TABLE articles ADD FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE');
  } catch (_) {}
  try {
    await pool.query('ALTER TABLE articles ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
  } catch (_) {}
  try {
    await pool.query('ALTER TABLE favorites ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
  } catch (_) {}
  try {
    await pool.query('ALTER TABLE favorites ADD FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE');
  } catch (_) {}
}

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const normalizedEmail = adminEmail.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
  if (existing.rows.length > 0) return;

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const id = `user-${Date.now()}`;
  await pool.query(
    'INSERT INTO users (id, email, password, role) VALUES ($1, $2, $3, $4)',
    [id, normalizedEmail, hashedPassword, 'admin'],
  );
  console.log('Admin user created from env');
}

async function startServer() {
  await pool.query('SELECT 1');
  if (process.env.AUTO_MIGRATE === 'true') {
    await ensureSchema();
  }
  await ensureAdminUser();
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

async function shutdown(reason, err) {
  if (err) {
    console.error(reason, err && err.message ? err.message : err);
  } else {
    console.log(reason);
  }
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  } finally {
    process.exit(err ? 1 : 0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM received'));
process.on('SIGINT', () => shutdown('SIGINT received'));
process.on('unhandledRejection', (reason) => shutdown('Unhandled Rejection', reason));
process.on('uncaughtException', (error) => shutdown('Uncaught Exception', error));

startServer().catch((error) => shutdown('Startup failed', error));

module.exports = app;
