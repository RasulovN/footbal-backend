const { Pool } = require('pg');

// =========================================================
// LOCAL CONFIG (default)
// =========================================================
// const pool = new Pool({
//   host: 'localhost',
//   port: 5432,
//   user: 'postgres',
//   password: 'postgres',
//   database: 'football',
//   ssl: false,
//   max: 5,
//   min: 0,
//   idleTimeoutMillis: 10000,
//   connectionTimeoutMillis: 3000,
//   allowExitOnIdle: true,
// });

// =========================================================
// SERVER CONFIG (Hostinger/cPanel)
// Uncomment this block and comment LOCAL block before push
// =========================================================
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'legione1_admin',
  password: '$Nurbek2000',
  database: 'legione1_legioner_db',
  ssl: false,
  max: 5,
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
  allowExitOnIdle: true,
});

module.exports = pool;
