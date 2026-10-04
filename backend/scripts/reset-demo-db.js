// ============================================================
// Reset the DEMO database (default peso_link_demo) from schema.sql, then seed it.
// Safe alternative to `npm run init-db`, which always targets peso_link_misor.
//   npm run reset-demo            -> peso_link_demo
//   DEMO_DB=my_demo npm run reset-demo
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REAL_DB = 'peso_link_misor';
const demoDb = process.env.DEMO_DB || 'peso_link_demo';

async function main() {
  if (demoDb === REAL_DB || !/^[A-Za-z0-9_]+$/.test(demoDb)) {
    console.error(`[reset-demo] Refusing to reset "${demoDb}". Use a separate demo database name.`);
    process.exit(1);
  }
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8').split(REAL_DB).join(demoDb);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  await conn.query(schema);
  await conn.end();
  console.log(`[reset-demo] Schema applied to ${demoDb}. Seeding...`);

  const seed = spawnSync(process.execPath, [path.join(__dirname, '..', 'seed.js')], {
    stdio: 'inherit',
    env: { ...process.env, DB_NAME: demoDb, DB_HOST: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST },
  });
  process.exit(seed.status ?? 1);
}

main().catch((err) => {
  console.error('[reset-demo] Failed:', err.message);
  process.exit(1);
});
