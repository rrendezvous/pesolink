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

// Employer-stage applications that are still in progress (not yet Hired / Rejected / Closed).
const ACTIVE_APPLICATION_STATUSES = ['submitted', 'pending', 'for_review', 'for_interview'];

// Moves in-progress PESO-referred applications to Closed and tells each job seeker why.
// Closed is a neutral "no longer open" status, not a rejection or a hiring decision.
async function closeActiveApplications(conn, { where, params, closedBy, note, seekerMessage, notifyEmployer }) {
  const [rows] = await conn.query(
    `SELECT ja.id, ja.application_status, jp.job_title, e.user_id AS employer_user_id,
            js.user_id AS seeker_user_id, js.first_name, js.last_name
     FROM job_applications ja
     JOIN job_posts jp ON jp.id = ja.job_post_id
     JOIN employers e ON e.id = jp.employer_id
     JOIN job_seekers js ON js.id = ja.job_seeker_id
     WHERE ja.referral_status = 'peso_referred' AND ja.application_status IN (?) AND ${where}`,
    [ACTIVE_APPLICATION_STATUSES, ...params]
  );
  for (const app of rows) {
    await conn.query("UPDATE job_applications SET application_status = 'closed' WHERE id = ?", [app.id]);
    await recordHistory(conn, {
      applicationId: app.id,
      type: 'application',
      oldStatus: app.application_status,
      newStatus: 'closed',
      changedBy: closedBy,
      notes: note,
    });
    await notify(conn, app.seeker_user_id, 'Application Closed', seekerMessage(app), 'application_status', app.id);
    if (notifyEmployer) {
      await notify(
        conn,
        app.employer_user_id,
        'Applicant Record Closed',
        `${app.first_name} ${app.last_name}'s application for "${app.job_title}" was closed. ${note}`,
        'application_status',
        app.id
      );
    }
  }
  return rows.length;
}

// Closing a job post: undecided older referral requests and in-progress applications are closed,
// and every affected job seeker is notified. Hired / Rejected records are left as they are.
async function closeJobRecords(conn, jobId, closedBy, jobTitle, closedByLabel) {
  const referrals = await closeOpenReferralsForJob(conn, jobId, closedBy, jobTitle);
  const applications = await closeActiveApplications(conn, {
    where: 'ja.job_post_id = ?',
    params: [jobId],
    closedBy,
    note: `Job post closed by ${closedByLabel}`,
    seekerMessage: () => `The job post "${jobTitle}" was closed by ${closedByLabel}, so your application is now closed. This is not a rejection; you may apply to other jobs.`,
  });
  return { referrals, applications };
}

// One place that loads a job's required skills and a job seeker's saved skills and compares them,
// so the seeker, employer, and admin views (and the apply check) always agree.
// Skills are matched by skill only; proficiency levels are not part of the paper's comparison.
async function getSkillComparison(queryable, jobPostId, jobSeekerId) {
  const [requiredSkills] = await queryable.query(
    `SELECT s.id, s.skill_name, s.category
     FROM job_required_skills jrs JOIN skills s ON s.id = jrs.skill_id
     WHERE jrs.job_post_id = ? ORDER BY s.skill_name`,
    [jobPostId]
  );
  const [seekerSkills] = await queryable.query(
    `SELECT s.id, s.skill_name, s.category
     FROM job_seeker_skills jss JOIN skills s ON s.id = jss.skill_id
     WHERE jss.job_seeker_id = ? ORDER BY s.skill_name`,
    [jobSeekerId]
  );
  return { ...buildSkillComparison(requiredSkills, seekerSkills), seeker_skill_count: seekerSkills.length };
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
  ACTIVE_APPLICATION_STATUSES,
  closeActiveApplications,
  closeJobRecords,
  getSkillComparison,
  buildSkillComparison,
};
