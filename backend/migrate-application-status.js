// ============================================================
// Non-destructive migration: employer application status enum
// ============================================================
const db = require('./db');

async function run() {
  await db.query(
    "UPDATE job_applications SET application_status = 'for_review' WHERE application_status = 'referred'"
  );

  await db.query(
    `ALTER TABLE job_applications
     MODIFY application_status ENUM(
       'submitted',
       'pending',
       'for_review',
       'for_interview',
       'hired',
       'rejected',
       'closed'
     ) DEFAULT 'submitted'`
  );

  console.log('[Migration] Employer application status enum migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Migration] Failed:', err.message);
  process.exit(1);
});
