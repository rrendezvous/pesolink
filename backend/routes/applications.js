// ============================================================
// Job Applications Routes (job seeker side)
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/applications - apply to a job
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

    if (!jobSeeker.profile_completed) {
      await conn.rollback();
      return res.status(400).json({ error: 'Please complete your NSRP profile before applying' });
    }

    const [job] = await conn.query(
      `SELECT jp.*, e.user_id AS employer_user_id, e.company_name
       FROM job_posts jp JOIN employers e ON e.id = jp.employer_id
       WHERE jp.id = ? AND jp.status = 'active'`,
      [job_post_id]
    );
    if (job.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found or not active' });
    }

    // Check duplicate
    const [existing] = await conn.query(
      'SELECT id FROM job_applications WHERE job_post_id = ? AND job_seeker_id = ?',
      [job_post_id, jobSeeker.id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'You have already applied to this job' });
    }

    const [result] = await conn.query(
      `INSERT INTO job_applications (job_post_id, job_seeker_id, cover_letter, application_status)
       VALUES (?, ?, ?, 'submitted')`,
      [job_post_id, jobSeeker.id, cover_letter || null]
    );

    // History
    await conn.query(
      `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, notes)
       VALUES (?, NULL, 'pending', ?, 'Application submitted')`,
      [result.insertId, req.user.id]
    );

    // Notify employer
    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES (?, ?, ?, 'application', ?, 'application')`,
      [
        job[0].employer_user_id,
        'New Application Received',
        `${jobSeeker.first_name} ${jobSeeker.last_name} applied for "${job[0].job_title}"`,
        result.insertId,
      ]
    );

    await conn.commit();
    res.status(201).json({ message: 'Application submitted', application_id: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error('[Apply]', err);
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
              jp.salary_min, jp.salary_max, e.company_name, e.contact_person,
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

    // Authorization: job seeker (owner), employer (job owner), or admin
    if (
      req.user.role === 'job_seeker' && app.seeker_user_id !== req.user.id ||
      req.user.role === 'employer' && app.employer_user_id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Not authorized to view this application' });
    }

    const [history] = await db.query(
      `SELECT ash.*, u.email AS changed_by_email
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = ?
       ORDER BY ash.changed_at ASC`,
      [req.params.id]
    );

    res.json({ application: app, history });
  } catch (err) {
    console.error('[Application Detail]', err);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

module.exports = router;
