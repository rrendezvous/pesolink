// ============================================================
// Non-destructive migration: per-job PESO referral workflow
// - job_applications.referral_status (PESO Admin track):
//     submitted -> for_review -> peso_referred | rejected, or closed
// - application_status_history.status_type ('referral' | 'application')
// - job_posts.application_email (external application path)
// Runs automatically on server start; can also be run directly:
//   node migrate-referral-workflow.js
// ============================================================
const db = require('./db');

const COLUMNS = [
  {
    table: 'job_applications',
    column: 'referral_status',
    sql: `ALTER TABLE job_applications
          ADD COLUMN referral_status ENUM('submitted', 'for_review', 'peso_referred', 'rejected', 'closed')
          NOT NULL DEFAULT 'submitted' AFTER application_status`,
    // Applications created before this workflow were already visible to employers,
    // so keep them visible by treating them as PESO-referred.
    backfill: `UPDATE job_applications SET referral_status = 'peso_referred'`,
  },
  {
    table: 'job_applications',
    column: 'referral_notes',
    sql: 'ALTER TABLE job_applications ADD COLUMN referral_notes TEXT NULL AFTER referral_status',
  },
  {
    table: 'job_applications',
    column: 'referral_reviewed_by',
    sql: 'ALTER TABLE job_applications ADD COLUMN referral_reviewed_by INT NULL AFTER referral_notes',
  },
  {
    table: 'job_applications',
    column: 'referral_reviewed_at',
    sql: 'ALTER TABLE job_applications ADD COLUMN referral_reviewed_at TIMESTAMP NULL AFTER referral_reviewed_by',
  },
  {
    table: 'application_status_history',
    column: 'status_type',
    sql: `ALTER TABLE application_status_history
          ADD COLUMN status_type ENUM('referral', 'application') NOT NULL DEFAULT 'application' AFTER application_id`,
  },
  {
    table: 'job_posts',
    column: 'application_email',
    sql: 'ALTER TABLE job_posts ADD COLUMN application_email VARCHAR(255) NULL AFTER requirements',
  },
];

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function ensureReferralWorkflowColumns() {
  for (const migration of COLUMNS) {
    if (await columnExists(migration.table, migration.column)) continue;
    await db.query(migration.sql);
    if (migration.backfill) await db.query(migration.backfill);
    console.log(`[Migration] Added ${migration.table}.${migration.column}.`);
  }
}

module.exports = { ensureReferralWorkflowColumns };

if (require.main === module) {
  ensureReferralWorkflowColumns()
    .then(() => {
      console.log('[Migration] Referral workflow migration complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err.message);
      process.exit(1);
    });
}
