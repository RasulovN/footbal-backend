const { Pool } = require('pg');

// Hardcoded database configuration for cPanel shared hosting
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'football',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});


// const pool = new Pool({
//   host: 'localhost',
//   port: 5432,
//   user: 'legioner_user',
//   password: 'G(O9878DihHdm#',
//   database: 'legioner_db',
//   max: 20, // Maximum number of clients in the pool
//   idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
//   connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
// });

module.exports = pool;