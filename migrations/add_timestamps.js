/**
 * Migration: Add automatic timestamp handling to all tables
 * 
 * This migration adds:
 * 1. DEFAULT NOW() for created_at on INSERT
 * 2. DEFAULT NOW() for updated_at on INSERT  
 * 3. Trigger to automatically update updated_at on UPDATE
 */

const pool = require('./lib/db');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Tables to update
    const tables = ['users', 'categories', 'articles', 'contact_messages', 'favorites'];

    for (const table of tables) {
      console.log(`Processing table: ${table}`);

      // Add created_at column if not exists with default
      try {
        await client.query(`
          ALTER TABLE ${table} 
          ALTER COLUMN created_at SET DEFAULT NOW()
        `);
        console.log(`  ✓ created_at default set for ${table}`);
      } catch (err) {
        if (!err.message.includes('already')) throw err;
        console.log(`  ✓ created_at already configured for ${table}`);
      }

      // Add updated_at column if not exists with default
      try {
        await client.query(`
          ALTER TABLE ${table} 
          ALTER COLUMN updated_at SET DEFAULT NOW()
        `);
        console.log(`  ✓ updated_at default set for ${table}`);
      } catch (err) {
        if (!err.message.includes('already')) throw err;
        console.log(`  ✓ updated_at already configured for ${table}`);
      }

      // Drop existing trigger function if exists
      try {
        await client.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
      } catch (err) {
        // Ignore if doesn't exist
      }

      // Create trigger function for automatic updated_at update
      const funcName = `update_${table}_updated_at_func`;
      
      try {
        await client.query(`DROP FUNCTION IF EXISTS ${funcName}()`);
      } catch (err) {
        // Ignore
      }

      await client.query(`
        CREATE OR REPLACE FUNCTION ${funcName}()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      // Create trigger
      await client.query(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION ${funcName}()
      `);

      console.log(`  ✓ Trigger created for ${table}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
