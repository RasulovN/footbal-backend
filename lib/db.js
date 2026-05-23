const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const baseConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'football',
    };

const pool = new Pool({
  ...baseConfig,
  max: Number(process.env.DB_POOL_MAX || 5),
  min: 0,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 3000),
  allowExitOnIdle: true,
});

module.exports = pool;
