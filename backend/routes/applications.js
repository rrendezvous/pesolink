// ============================================================
// Job Applications Routes (job seeker side)
// PESO verifies the job seeker's NSRP profile once (job_seekers.nsrp_status). A verified seeker
// applies to any job with one tap and the record reaches the employer as PESO-Referred.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { recordHistory, notify, getSkillComparison } = require('../services/referral');
const { NSRP_STATUS_LABELS, requiredMatchesFor } = require('../services/nsrpReview');

const router = express.Router();

// POST /api/applications - apply to a job with PESO referral (PESO-verified NSRP profile required)
router.post('/', authenticate, requireRole('job_seeker'), async (req, res) => {
  const { job_post_id, cover_letter } = req.body;
  if (!job_post_id) return res.status(400).json({ error: 'job_post_id is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [jsRows] = await conn.query('SELECT * FROM job_seekers WHERE user_id = ?', [req.user.id]);
    if (jsRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Profile not found' });
    }
    const jobSeeker = jsRows[0];

    // One record per job seeker per job. A closed record (e.g. withdrawn) may be reused.
    const [existing] = await conn.query(
      'SELECT id, referral_status FROM job_applications WHERE job_post_id = ? AND job_seeker_id = ?',
      [job_post_id, jobSeeker.id]
    );
    const previous = existing[0] || null;
    if (previous && !['rejected', 'closed'].includes(previous.referral_status)) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already applied to this job with PESO referral' });
    }

    if (jobSeeker.nsrp_status !== 'verified') {
      await conn.rollback();
      return res.status(400).json({
        error: `Your NSRP profile must be PESO-verified before you can apply with PESO referral (current status: ${NSRP_STATUS_LABELS[jobSeeker.nsrp_status]})`,
        code: 'NSRP_NOT_VERIFIED',
        nsrp_status: jobSeeker.nsrp_status,
      });
    }

    const [job] = await conn.query(
      `SELECT jp.*, e.company_name, e.user_id AS employer_user_id
       FROM job_posts jp JOIN employers e ON e.id = jp.employer_id JOIN users eu ON eu.id = e.user_id
       WHERE jp.id = ? AND jp.status = 'active' AND eu.account_status = 'active'
         AND (jp.closing_date IS NULL OR jp.closing_date >= CURDATE())`,
      [job_post_id]
    );
    if (job.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'This job post is closed or no longer accepting applications', code: 'JOB_CLOSED' });
    }

    // Temporary minimum skill-match rule (MIN_SKILL_MATCHES) until PESO confirms its own rule.
    const comparison = await getSkillComparison(conn, job_post_id, jobSeeker.id);
    const neededMatches = requiredMatchesFor(comparison.total_required_skills);
    if (comparison.matched_count < neededMatches) {
      await conn.rollback();
      return res.status(400).json({
        error: `This job needs at least ${neededMatches} matching skills from its required skills. You have ${comparison.matched_count}.`,
        code: 'SKILL_MINIMUM',
        matched_count: comparison.matched_count,
        required_matches: neededMatches,
      });
    }

    const verifiedOn = jobSeeker.nsrp_reviewed_at
      ? new Date(jobSeeker.nsrp_reviewed_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
      : null;
    const referralNote = `NSRP profile verified by PESO${verifiedOn ? ` on ${verifiedOn}` : ''}`;

    let applicationId;
    if (previous) {
      applicationId = previous.id;
      await conn.query(
        `UPDATE job_applications
         SET referral_status = 'peso_referred', application_status = 'for_review', cover_letter = ?,
             referral_notes = ?, referral_reviewed_by = ?, referral_reviewed_at = NOW(), applied_at = NOW()
         WHERE id = ?`,
        [cover_letter || null, referralNote, jobSeeker.nsrp_reviewed_by, applicationId]
      );
    } else {
      const [result] = await conn.query(
        `INSERT INTO job_applications
           (job_post_id, job_seeker_id, cover_letter, application_status, referral_status,
            referral_notes, referral_reviewed_by, referral_reviewed_at)
         VALUES (?, ?, ?, 'for_review', 'peso_referred', ?, ?, NOW())`,
        [job_post_id, jobSeeker.id, cover_letter || null, referralNote, jobSeeker.nsrp_reviewed_by]
      );
      applicationId = result.insertId;
    }
    await recordHistory(conn, {
      applicationId,
      type: 'referral',
      oldStatus: previous ? previous.referral_status : null,
      newStatus: 'peso_referred',
      changedBy: req.user.id,
      notes: `Applied with PESO referral - ${referralNote}`,
    });

    await notify(
      conn,
      job[0].employer_user_id,
      'New PESO-Referred Applicant',
      `${jobSeeker.first_name} ${jobSeeker.last_name} applied for "${job[0].job_title}" with a PESO-verified NSRP profile.`,
      'peso_referral',
      applicationId
    );

    await conn.commit();
    res.status(previous ? 200 : 201).json({
      message: `Application sent to ${job[0].company_name} as PESO-Referred`,
      application_id: applicationId,
    });
  } catch (err) {
    await conn.rollback();
    // A second tap that raced the first one hits the one-record-per-job unique key.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already applied to this job with PESO referral' });
    }
    console.error('[Apply with PESO Referral]', err);
    res.status(500).json({ error: 'Failed to submit application' });
  } finally {
    conn.release();
  }
});

// GET /api/applications/my-applications
router.get('/my-applications', authenticate, requireRole('job_seeker'), async (req, res) => {
  try {
    const [jsRows] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [req.user.id]);
    if (jsRows.length === 0) return res.json({ applications: [] });
    const jsId = jsRows[0].id;

    const [apps] = await db.query(
      `SELECT ja.*, jp.job_title, jp.location, jp.job_type, e.company_name
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       WHERE ja.job_seeker_id = ?
       ORDER BY ja.applied_at DESC`,
      [jsId]
    );
    res.json({ applications: apps });
  } catch (err) {
    console.error('[My Applications]', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/applications/:id - details with history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [apps] = await db.query(
      `SELECT ja.*, jp.job_title, jp.job_description, jp.location, jp.job_type,
              jp.salary_min, jp.salary_max, jp.status AS job_status, e.company_name, e.contact_person,
              e.company_address,
              js.first_name, js.last_name, js.user_id AS seeker_user_id,
              e.user_id AS employer_user_id
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       WHERE ja.id = ?`,
      [req.params.id]
    );
    if (apps.length === 0) return res.status(404).json({ error: 'Application not found' });
    const app = apps[0];

    // Authorization: job seeker (owner), employer (job owner, PESO-referred records only), or admin
    if (
      req.user.role === 'job_seeker' && app.seeker_user_id !== req.user.id ||
      req.user.role === 'employer' && (app.employer_user_id !== req.user.id || app.referral_status !== 'peso_referred')
    ) {
      return res.status(403).json({ error: 'Not authorized to view this application' });
    }

    const [history] = await db.query(
      `SELECT ash.*, u.email AS changed_by_email
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = ?
       ORDER BY ash.changed_at ASC, ash.id ASC`,
      [req.params.id]
    );

    res.json({ application: app, history });
  } catch (err) {
    console.error('[Application Detail]', err);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

module.exports = router;
