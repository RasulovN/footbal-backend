const { Pool } = require('pg');

const useLocal = process.env.FORCE_LOCAL_DB === 'true';

const pool = new Pool({
  host: useLocal ? 'localhost' : (process.env.DB_HOST || 'localhost'),
  port: useLocal ? 5432 : Number(process.env.DB_PORT || 5432),
  user: useLocal ? 'postgres' : (process.env.DB_USER || 'postgres'),
  password: useLocal ? 'postgres' : (process.env.DB_PASSWORD || 'postgres'),
  database: useLocal ? 'football' : (process.env.DB_NAME || 'football'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 5),
  min: 0,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 3000),
  allowExitOnIdle: true,
});

module.exports = pool;
