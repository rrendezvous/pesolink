// ============================================================
// PESO-Link MisOr - MySQL Connection Pool
// ============================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verify connection on startup
pool.getConnection()
  .then((conn) => {
    console.log('[DB] Connected to MySQL database:', process.env.DB_NAME);
    conn.release();
  })
  .catch((err) => {
    console.error('[DB] Connection error:', err.message);
  });

module.exports = pool;
