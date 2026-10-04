// ============================================================
// Non-destructive migration: PESO referral workflow
// - job_seekers.nsrp_* (one-time PESO verification of the NSRP profile):
//     not_submitted -> submitted -> for_review -> verified | needs_revision
// - job_applications.referral_status (peso_referred when a verified seeker applies)
// - application_status_history.status_type ('referral' | 'application')
// - job_posts.application_email (external application path)
// Runs automatically on server start; can also be run directly:
//   node migrate-referral-workflow.js
// ============================================================
const db = require('./db');
const { nsrpFingerprint } = require('./services/nsrpReview');

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
    table: 'job_seekers',
    column: 'nsrp_status',
    sql: `ALTER TABLE job_seekers
          ADD COLUMN nsrp_status ENUM('not_submitted', 'submitted', 'for_review', 'verified', 'needs_revision')
          NOT NULL DEFAULT 'not_submitted' AFTER profile_completed`,
    backfill: backfillNsrpStatus,
  },
  {
    table: 'job_seekers',
    column: 'nsrp_review_notes',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_review_notes TEXT NULL AFTER nsrp_status',
  },
  {
    table: 'job_seekers',
    column: 'nsrp_reviewed_by',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_reviewed_by INT NULL AFTER nsrp_review_notes',
  },
  {
    table: 'job_seekers',
    column: 'nsrp_reviewed_at',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_reviewed_at TIMESTAMP NULL AFTER nsrp_reviewed_by',
  },
  {
    table: 'job_seekers',
    column: 'nsrp_submitted_at',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_submitted_at TIMESTAMP NULL AFTER nsrp_reviewed_at',
  },
  {
    table: 'job_seekers',
    column: 'nsrp_reviewed_hash',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_reviewed_hash CHAR(64) NULL AFTER nsrp_submitted_at',
  },
  {
    table: 'job_seekers',
    column: 'nsrp_certified_at',
    sql: 'ALTER TABLE job_seekers ADD COLUMN nsrp_certified_at TIMESTAMP NULL AFTER nsrp_submitted_at',
  },
  {
    table: 'job_seekers',
    column: 'peso_assessment',
    sql: 'ALTER TABLE job_seekers ADD COLUMN peso_assessment JSON NULL AFTER nsrp_reviewed_hash',
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

// Runs once, when nsrp_status is first added (the review columns are added right after it).
async function backfillNsrpStatus() {
  const reviewColumns = ['nsrp_review_notes', 'nsrp_reviewed_by', 'nsrp_reviewed_at', 'nsrp_submitted_at', 'nsrp_reviewed_hash'];
  for (const migration of COLUMNS.filter((item) => reviewColumns.includes(item.column))) {
    if (!(await columnExists(migration.table, migration.column))) await db.query(migration.sql);
  }

  // Older databases still have the profile-level referral columns; keep PESO's earlier decisions.
  if (await columnExists('job_seekers', 'referral_status')) {
    await db.query(
      `UPDATE job_seekers SET
         nsrp_status = CASE referral_status
           WHEN 'referral_ready' THEN 'verified'
           WHEN 'needs_revision' THEN 'needs_revision'
           WHEN 'submitted' THEN 'submitted'
           ELSE 'not_submitted' END,
         nsrp_review_notes = referral_review_notes,
         nsrp_reviewed_by = referral_reviewed_by,
         nsrp_reviewed_at = referral_reviewed_at,
         nsrp_submitted_at = CASE WHEN referral_status = 'submitted' THEN updated_at ELSE NULL END`
    );
    const [verified] = await db.query("SELECT id FROM job_seekers WHERE nsrp_status = 'verified'");
    for (const seeker of verified) {
      await db.query('UPDATE job_seekers SET nsrp_reviewed_hash = ? WHERE id = ?', [await nsrpFingerprint(db, seeker.id), seeker.id]);
    }
  }

  // Per-job requests PESO had not decided yet are closed; verified seekers can apply again with one tap.
  if (await columnExists('job_applications', 'referral_status')) {
    const [open] = await db.query("SELECT id, referral_status FROM job_applications WHERE referral_status IN ('submitted', 'for_review')");
    for (const app of open) {
      await db.query("UPDATE job_applications SET referral_status = 'closed', referral_reviewed_at = NOW() WHERE id = ?", [app.id]);
      await db.query(
        `INSERT INTO application_status_history (application_id, status_type, old_status, new_status, notes)
         VALUES (?, 'referral', ?, 'closed', 'PESO now verifies the NSRP profile once. Apply again after your NSRP profile is PESO-verified.')`,
        [app.id, app.referral_status]
      );
    }
  }
}

// NSRP Form 1 civil status includes "Live-in" (the OCR also returns it).
async function ensureLiveInCivilStatus() {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_seekers' AND COLUMN_NAME = 'civil_status'`
  );
  if (rows.length && !String(rows[0].type).includes("'live-in'")) {
    await db.query(
      "ALTER TABLE job_seekers MODIFY civil_status ENUM('single', 'married', 'widowed', 'separated', 'live-in')"
    );
    console.log('[Migration] Added live-in to job_seekers.civil_status.');
  }
}

async function ensureReferralWorkflowColumns() {
  for (const migration of COLUMNS) {
    if (await columnExists(migration.table, migration.column)) continue;
    await db.query(migration.sql);
    if (typeof migration.backfill === 'function') await migration.backfill();
    else if (migration.backfill) await db.query(migration.backfill);
    console.log(`[Migration] Added ${migration.table}.${migration.column}.`);
  }
  await ensureLiveInCivilStatus();
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
