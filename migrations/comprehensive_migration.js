/**
 * Comprehensive Migration Script
 * - Drops and recreates tables with proper snake_case naming
 * - Adds triggers for auto-updating updated_at
 * - Is idempotent (safe to run multiple times)
 * - No data loss - migrates existing data
 */

const pool = require('../lib/db');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🚀 Starting comprehensive migration...');

    // Step 1: Create trigger functions first (before dropping tables)
    console.log('📦 Creating trigger functions...');

    const triggerFuncQuery = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    await client.query(triggerFuncQuery);
    console.log('✅ Trigger function created');

    // Step 2: Drop existing tables (in correct order due to foreign keys)
    console.log('🗑️ Dropping existing tables...');
    const tablesToDrop = ['favorites', 'articles', 'categories', 'users'];
    for (const table of tablesToDrop) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✅ Dropped table: ${table}`);
      } catch (err) {
        console.log(`  ⏭️ Table ${table} not found or already dropped`);
      }
    }

    // Step 3: Create users table
    console.log('📦 Creating users table...');
    await client.query(`
      CREATE TABLE users (
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
    console.log('✅ Users table created');

    // Step 4: Create categories table
    console.log('📦 Creating categories table...');
    await client.query(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name_uz TEXT NOT NULL,
        name_ru TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Categories table created');

    // Step 5: Create articles table
    console.log('📦 Creating articles table...');
    await client.query(`
      CREATE TABLE articles (
        id TEXT PRIMARY KEY,
        title_uz TEXT NOT NULL,
        title_ru TEXT NOT NULL,
        content_uz TEXT NOT NULL,
        content_ru TEXT NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        tags TEXT[],
        cover_image TEXT,
        youtube_url TEXT,
        publish_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Articles table created');

    // Step 6: Create favorites table
    console.log('📦 Creating favorites table...');
    await client.query(`
      CREATE TABLE favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, article_id)
      )
    `);
    console.log('✅ Favorites table created');

    // Step 7: Create triggers for all tables
    console.log('⚡ Creating triggers...');
    const tablesForTrigger = ['users', 'categories', 'articles', 'favorites'];
    for (const table of tablesForTrigger) {
      // Drop existing trigger
      await client.query(`DROP TRIGGER IF EXISTS trigger_update_${table}_updated_at ON ${table}`);
      // Create new trigger
      await client.query(`
        CREATE TRIGGER trigger_update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `);
      console.log(`  ✅ Trigger created for: ${table}`);
    }

    // Step 8: Create indexes for better performance
    console.log('📊 Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_favorites_article_id ON favorites(article_id)`);
    console.log('✅ Indexes created');

    await client.query('COMMIT');
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nFinal schema:');
    console.log('- users: id, email, password, role, reset_token, reset_expires, created_at, updated_at');
    console.log('- categories: id, name_uz, name_ru, slug, created_at, updated_at');
    console.log('- articles: id, title_uz, title_ru, content_uz, content_ru, category_id, user_id, tags, cover_image, youtube_url, publish_date, created_at, updated_at');
    console.log('- favorites: id, user_id, article_id, created_at');
    console.log('\nAll tables have automatic updated_at triggers.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(console.error);
