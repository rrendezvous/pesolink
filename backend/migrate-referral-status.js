// ============================================================
// Non-destructive migration: NSRP referral-ready status fields
// ============================================================
const db = require('./db');

async function columnExists(columnName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'job_seekers'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return rows[0].count > 0;
}

async function run() {
  const migrations = [
    {
      column: 'nsrp_full_data',
      sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_full_data JSON AFTER preferred_occupation',
    },
    {
      column: 'referral_status',
      sql: "ALTER TABLE job_seekers ADD COLUMN referral_status ENUM('draft', 'submitted', 'needs_revision', 'referral_ready') DEFAULT 'draft' AFTER profile_completed",
    },
    {
      column: 'referral_review_notes',
      sql: 'ALTER TABLE job_seekers ADD COLUMN referral_review_notes TEXT AFTER referral_status',
    },
    {
      column: 'referral_reviewed_by',
      sql: 'ALTER TABLE job_seekers ADD COLUMN referral_reviewed_by INT NULL AFTER referral_review_notes',
    },
    {
      column: 'referral_reviewed_at',
      sql: 'ALTER TABLE job_seekers ADD COLUMN referral_reviewed_at TIMESTAMP NULL AFTER referral_reviewed_by',
    },
  ];

  for (const migration of migrations) {
    if (await columnExists(migration.column)) {
      console.log(`[Migration] ${migration.column} already exists.`);
      continue;
    }
    await db.query(migration.sql);
    console.log(`[Migration] Added ${migration.column}.`);
  }

  await db.query(
    `UPDATE job_seekers
     SET referral_status = 'draft'
     WHERE referral_status IS NULL`
  );

  console.log('[Migration] Referral status migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration] Failed:', err.message);
  process.exit(1);
});
