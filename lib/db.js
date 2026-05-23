const { Pool } = require('pg');

// const pool = new Pool({
//   host: process.env.DB_HOST  'localhost',
//   port: Number(process.env.DB_PORT  5432),
//   user: process.env.DB_USER  'postgres',
//   password: process.env.DB_PASSWORD  'postgres',
//   database: process.env.DB_NAME  'football',
//   max: Number(process.env.DB_POOL_MAX  5),
//   min: 0,
//   idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS  10000),
//   connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS  3000),
//   allowExitOnIdle: true,
// });




// serverless config
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'legione1_admin',
  password: '$Nurbek2000',
  database: 'legione1_legioner_db',

    ssl: false,

  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});




module.exports = pool;