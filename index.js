// Import database pool
const pool = require('./lib/db');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth.route');
const newsRoutes = require('./routes/news.routes');
const categoryRoutes = require('./routes/category.routes');
const userRoutes = require('./routes/user.routes');
const contactRoutes = require('./routes/contact.routes');

const app = express();

/**
 * Static File Serving Configuration
 * 
 * The uploads directory contains user-uploaded images.
 * We serve it statically so images can be accessed via URL.
 * 
 * Why static middleware?
 * - Express.static() is optimized for serving files
 * - Handles MIME types automatically
 * - Supports caching headers
 * - More efficient than custom middleware
 * 
 * path.join() and process.cwd():
 * - process.cwd() returns current working directory
 * - Ensures paths work regardless of where the script is run from
 * - Cross-platform compatible (Windows/Linux)
 */

// Resolve uploads directory path relative to project root
const UPLOADS_PATH = path.join(process.cwd(), 'uploads');

// Static middleware for /uploads route
// Serves files from the uploads directory at /uploads/filename.ext
app.use('/uploads', express.static(UPLOADS_PATH, {
  // Set Cache-Control for production performance
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true,
}));

// Alternative route with /uz prefix for language compatibility
app.use('/uz/uploads', express.static(UPLOADS_PATH, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// Middleware to add proper headers for static files
app.use('/uploads', (req, res, next) => {
  // Enable CORS for static files
  res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/uz/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// CORS configuration - support development and production origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default
      'http://localhost:5174', // Vite alternative
      'http://localhost:8080', // Development
      'http://localhost:8081', // Development alternative
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:8081',
      'https://api.legioners.uz',
      'https://legioners.uz',
      'https://www.legioners.uz',
    ];

    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Allow all origins in development, restrict in production
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

// Enable CORS with configuration
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 800,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Handle OPTIONS requests for CORS preflight
app.options('*', cors());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/contact', contactRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler for static files
app.use('/uploads', (req, res) => {
  res.status(404).json({ error: 'Image not found' });
});

// Database connection check
async function checkDbConnection() {
  try {
    const client = await pool.connect();
    app.get('/check', (req, res) => {
      res.json({ status: 'OK', message: 'Database connected successfully' });
    });
    console.log('✅ Database connected successfully');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

// Create tables if not exist
async function createTablesIfNotExist() {
  try {
    console.log('📦 Creating tables...');

    // Users table
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
    console.log('✅ Users table ready');

    // Categories table
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
    console.log('✅ Categories table ready');

    // Articles table
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
    console.log('✅ Articles table ready');

    // Favorites table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        article_id TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, article_id)
      )
    `);
    console.log('✅ Favorites table ready');

    // Add foreign keys
    try {
      await pool.query(`ALTER TABLE articles ADD FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE`);
    } catch (err) { /* ignore if exists */ }
    
    try {
      await pool.query(`ALTER TABLE articles ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`);
    } catch (err) { /* ignore if exists */ }
    
    try {
      await pool.query(`ALTER TABLE favorites ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
    } catch (err) { /* ignore if exists */ }
    
    try {
      await pool.query(`ALTER TABLE favorites ADD FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE`);
    } catch (err) { /* ignore if exists */ }

    console.log('✅ Foreign keys ready');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  }
}

// Set up timestamp triggers
async function setupTimestampTriggers() {
  try {
    const tables = ['users', 'categories', 'articles', 'favorites'];

    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    for (const table of tables) {
      try {
        await pool.query(`DROP TRIGGER IF EXISTS trigger_update_${table}_updated_at ON ${table}`);
        await pool.query(`
          CREATE TRIGGER trigger_update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
        `);
      } catch (err) { /* ignore errors */ }
    }
    console.log('✅ Triggers ready');
  } catch (error) {
    console.error('❌ Error setting up triggers:', error.message);
  }
}

async function startServer() {
  await checkDbConnection();
  await createTablesIfNotExist();
  await setupTimestampTriggers();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('📁 Uploads directory: ' + UPLOADS_PATH);
    console.log('🌐 Images accessible at: /uploads/filename.ext');
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

module.exports = app;
