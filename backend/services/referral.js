'use strict';

// ============================================================
// PESO referral workflow helpers
// PESO verifies the NSRP profile once (see nsrpReview.js); a verified seeker's application is created
// as peso_referred. submitted / for_review / rejected remain only on older per-job records.
// Application status (employer): for_review -> for_interview -> hired | rejected (after PESO-Referred only)
// ============================================================

const REFERRAL_LABELS = {
  submitted: 'Submitted',
  for_review: 'For Review',
  peso_referred: 'PESO-Referred',
  rejected: 'Rejected',
  closed: 'Closed',
};

// Requests PESO has not decided yet.
const OPEN_REFERRAL_STATUSES = ['submitted', 'for_review'];

async function recordHistory(conn, {
  applicationId, type, oldStatus, newStatus, changedBy, notes,
}) {
  await conn.query(
    `INSERT INTO application_status_history
       (application_id, status_type, old_status, new_status, changed_by, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [applicationId, type, oldStatus || null, newStatus, changedBy || null, notes || null]
  );
}

async function notify(conn, userId, title, message, type, relatedId, relatedType = 'application') {
  await conn.query(
    `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, message, type, relatedId || null, relatedType]
  );
}

async function notifyAdmins(conn, title, message, relatedId) {
  await conn.query(
    `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
     SELECT id, ?, ?, 'referral_request', ?, 'application'
     FROM users WHERE role = 'admin' AND account_status = 'active'`,
    [title, message, relatedId]
  );
}

// When a job post closes, referral requests PESO has not decided yet are closed too.
async function closeOpenReferralsForJob(conn, jobId, closedBy, jobTitle) {
  const [open] = await conn.query(
    `SELECT ja.id, ja.referral_status, js.user_id AS seeker_user_id
     FROM job_applications ja
     JOIN job_seekers js ON js.id = ja.job_seeker_id
     WHERE ja.job_post_id = ? AND ja.referral_status IN (?)`,
    [jobId, OPEN_REFERRAL_STATUSES]
  );
  for (const app of open) {
    await conn.query(
      "UPDATE job_applications SET referral_status = 'closed', referral_reviewed_by = ?, referral_reviewed_at = NOW() WHERE id = ?",
      [closedBy, app.id]
    );
    await recordHistory(conn, {
      applicationId: app.id,
      type: 'referral',
      oldStatus: app.referral_status,
      newStatus: 'closed',
      changedBy: closedBy,
      notes: 'Job post was closed before PESO completed the referral review',
    });
    await notify(
      conn,
      app.seeker_user_id,
      'Referral Request Closed',
      `Your PESO referral request for "${jobTitle}" was closed because the job post is no longer accepting applicants.`,
      'referral_status',
      app.id
    );
  }
  return open.length;
}

// Rule-based matched/missing required skills (no score, ranking, or decision).
function buildSkillComparison(requiredSkills, seekerSkills) {
  const seekerSkillIds = new Set(seekerSkills.map((skill) => skill.id));
  const matched = requiredSkills.filter((skill) => seekerSkillIds.has(skill.id));
  const missing = requiredSkills.filter((skill) => !seekerSkillIds.has(skill.id));

  return {
    total_required_skills: requiredSkills.length,
    matched_count: matched.length,
    missing_count: missing.length,
    matched_skills: matched,
    missing_required_skills: missing,
    skill_comparison_notice: 'Rule-based skill comparison only. It lists matched and missing skills and does not decide hiring outcomes.',
  };
}

module.exports = {
  REFERRAL_LABELS,
  OPEN_REFERRAL_STATUSES,
  recordHistory,
  notify,
  notifyAdmins,
  closeOpenReferralsForJob,
  buildSkillComparison,
};
