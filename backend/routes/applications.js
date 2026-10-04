// ============================================================
// Job Applications Routes (job seeker side)
// A PESO-Link application is a PESO referral request for one job post.
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { refreshProfileCompleted } = require('../services/nsrpProfileValidation');
const { recordHistory, notifyAdmins } = require('../services/referral');

const router = express.Router();

// POST /api/applications - request PESO referral for a job post
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

    // One referral record per job seeker per job. A request PESO rejected or closed may be
    // requested again (e.g. after fixing the NSRP profile); an open or endorsed one may not.
    const [existing] = await conn.query(
      'SELECT id, referral_status FROM job_applications WHERE job_post_id = ? AND job_seeker_id = ?',
      [job_post_id, jobSeeker.id]
    );
    const previous = existing[0] || null;
    if (previous && !['rejected', 'closed'].includes(previous.referral_status)) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already have a PESO referral request for this job' });
    }

    // Gate from the paper: the required NSRP-based profile fields must be complete.
    const requirements = await refreshProfileCompleted(conn, jobSeeker.id);
    if (!requirements.isComplete) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Complete the required NSRP profile fields before requesting PESO referral',
        missing_fields: requirements.missing_fields,
      });
    }

    const [job] = await conn.query(
      `SELECT jp.*, e.company_name
       FROM job_posts jp JOIN employers e ON e.id = jp.employer_id
       WHERE jp.id = ? AND jp.status = 'active'`,
      [job_post_id]
    );
    if (job.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found or not active' });
    }

    let applicationId;
    if (previous) {
      applicationId = previous.id;
      await conn.query(
        `UPDATE job_applications
         SET referral_status = 'submitted', application_status = 'submitted', cover_letter = ?,
             referral_notes = NULL, referral_reviewed_by = NULL, referral_reviewed_at = NULL
         WHERE id = ?`,
        [cover_letter || null, applicationId]
      );
      await recordHistory(conn, {
        applicationId,
        type: 'referral',
        oldStatus: previous.referral_status,
        newStatus: 'submitted',
        changedBy: req.user.id,
        notes: 'PESO referral requested again',
      });
    } else {
      const [result] = await conn.query(
        `INSERT INTO job_applications
           (job_post_id, job_seeker_id, cover_letter, application_status, referral_status)
         VALUES (?, ?, ?, 'submitted', 'submitted')`,
        [job_post_id, jobSeeker.id, cover_letter || null]
      );
      applicationId = result.insertId;
      await recordHistory(conn, {
        applicationId,
        type: 'referral',
        oldStatus: null,
        newStatus: 'submitted',
        changedBy: req.user.id,
        notes: 'PESO referral requested',
      });
    }

    // Routed to PESO Admin first; the employer is notified only after PESO endorsement.
    await notifyAdmins(
      conn,
      'New PESO Referral Request',
      `${jobSeeker.first_name} ${jobSeeker.last_name} requested PESO referral for "${job[0].job_title}" (${job[0].company_name}).`,
      applicationId
    );

    await conn.commit();
    res.status(previous ? 200 : 201).json({
      message: 'PESO referral request submitted',
      application_id: applicationId,
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Referral Request]', err);
    res.status(500).json({ error: 'Failed to submit referral request' });
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
