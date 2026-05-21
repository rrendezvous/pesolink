// ============================================================
// Initialize/Reset Database Schema
// Usage: node init-db.js
// ============================================================
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config();

const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const schemaPath = path.join(__dirname, 'schema.sql');

const cmd = `mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} ${dbPass ? `-p${dbPass}` : ''} < ${schemaPath}`;

try {
  execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
  console.log('[init-db] Schema applied successfully.');
} catch (err) {
  console.error('[init-db] Failed:', err.message);
  process.exit(1);
}
