// ============================================================
// Initialize/Reset Database Schema
// Usage: node init-db.js
// ============================================================
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mysql = require('mysql2/promise');

async function initDb() {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME;
  const schemaPath = path.join(__dirname, 'schema.sql');

  try {
    // 1. Create connection to MySQL server (without database selected)
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      multipleStatements: true,
    });

    // 2. Read schema file
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // 3. Execute schema (multipleStatements allows full schema execution)
    await connection.query(schema);

    console.log('[init-db] Schema applied successfully.');
    await connection.end();
  } catch (err) {
    console.error('[init-db] Failed:', err.message);
    process.exit(1);
  }
}

initDb();
