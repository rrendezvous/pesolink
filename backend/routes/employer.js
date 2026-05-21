// ============================================================
// Employer Routes - profile, jobs, applicants, status updates
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

const VALID_STATUSES = ['submitted', 'pending', 'for_review', 'referred', 'rejected', 'closed'];

async function getEmployer(userId) {
  const [rows] = await db.query('SELECT * FROM employers WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function requireApprovedEmployer(req, res) {
  const emp = await getEmployer(req.user.id);
  if (!emp) {
    res.status(404).json({ error: 'Employer profile not found' });
    return null;
  }
  if (emp.approval_status !== 'approved') {
    res.status(403).json({ error: 'Employer account pending PESO admin approval' });
    return null;
  }
  return emp;
}

// GET /api/employer/profile
router.get('/profile', async (req, res) => {
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: emp });
  } catch (err) {
    console.error('[Emp Profile GET]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/employer/profile
router.post('/profile', async (req, res) => {
  const { company_name, company_address, contact_person, contact_number, business_type, company_size } = req.body;
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });

    await db.query(
      `UPDATE employers SET
         company_name=?, company_address=?, contact_person=?, contact_number=?,
         business_type=?, company_size=?
       WHERE id=?`,
      [
        company_name || emp.company_name,
        company_address || null,
        contact_person || null,
        contact_number || null,
        business_type || null,
        company_size || null,
        emp.id,
      ]
    );
    const [updated] = await db.query('SELECT * FROM employers WHERE id = ?', [emp.id]);
    res.json({ message: 'Profile updated', profile: updated[0] });
  } catch (err) {
    console.error('[Emp Profile POST]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/employer/jobs
router.get('/jobs', async (req, res) => {
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });

    const [jobs] = await db.query(
      `SELECT jp.*,
        (SELECT COUNT(*) FROM job_applications WHERE job_post_id = jp.id) AS applicant_count
       FROM job_posts jp WHERE jp.employer_id = ? ORDER BY jp.posted_at DESC`,
      [emp.id]
    );
    res.json({ jobs });
  } catch (err) {
    console.error('[Emp Jobs]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /api/employer/jobs - create job post
router.post('/jobs', async (req, res) => {
  const emp = await requireApprovedEmployer(req, res);
  if (!emp) return;

  const {
    job_title, job_description, job_type, salary_min, salary_max,
    location, vacancies, requirements, closing_date, required_skills,
  } = req.body;

  if (!job_title || !job_description) {
    return res.status(400).json({ error: 'Job title and description are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO job_posts
        (employer_id, job_title, job_description, job_type, salary_min, salary_max,
         location, vacancies, requirements, closing_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        emp.id, job_title, job_description, job_type || 'full-time',
        salary_min || null, salary_max || null, location || null,
        vacancies || 1, requirements || null, closing_date || null,
      ]
    );
    const jobId = result.insertId;

    if (Array.isArray(required_skills)) {
      for (const s of required_skills) {
        if (!s.skill_id) continue;
        await conn.query(
          `INSERT INTO job_required_skills (job_post_id, skill_id, required_level, is_required)
           VALUES (?, ?, ?, ?)`,
          [jobId, s.skill_id, s.required_level || 'beginner', s.is_required !== false]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: 'Job posted', job_id: jobId });
  } catch (err) {
    await conn.rollback();
    console.error('[Emp Job POST]', err);
    res.status(500).json({ error: 'Failed to create job' });
  } finally {
    conn.release();
  }
});

// PUT /api/employer/jobs/:id
router.put('/jobs/:id', async (req, res) => {
  const emp = await requireApprovedEmployer(req, res);
  if (!emp) return;

  const {
    job_title, job_description, job_type, salary_min, salary_max,
    location, vacancies, requirements, closing_date, status, required_skills,
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [jobs] = await conn.query(
      'SELECT * FROM job_posts WHERE id = ? AND employer_id = ?',
      [req.params.id, emp.id]
    );
    if (jobs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = jobs[0];

    await conn.query(
      `UPDATE job_posts SET
         job_title=?, job_description=?, job_type=?, salary_min=?, salary_max=?,
         location=?, vacancies=?, requirements=?, closing_date=?, status=?
       WHERE id=?`,
      [
        job_title || job.job_title,
        job_description || job.job_description,
        job_type || job.job_type,
        salary_min ?? job.salary_min,
        salary_max ?? job.salary_max,
        location || job.location,
        vacancies || job.vacancies,
        requirements || job.requirements,
        closing_date || job.closing_date,
        status || job.status,
        req.params.id,
      ]
    );

    if (Array.isArray(required_skills)) {
      await conn.query('DELETE FROM job_required_skills WHERE job_post_id = ?', [req.params.id]);
      for (const s of required_skills) {
        if (!s.skill_id) continue;
        await conn.query(
          `INSERT INTO job_required_skills (job_post_id, skill_id, required_level, is_required)
           VALUES (?, ?, ?, ?)`,
          [req.params.id, s.skill_id, s.required_level || 'beginner', s.is_required !== false]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Job updated' });
  } catch (err) {
    await conn.rollback();
    console.error('[Emp Job PUT]', err);
    res.status(500).json({ error: 'Failed to update job' });
  } finally {
    conn.release();
  }
});

// DELETE /api/employer/jobs/:id
router.delete('/jobs/:id', async (req, res) => {
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });

    const [result] = await db.query(
      'DELETE FROM job_posts WHERE id = ? AND employer_id = ?',
      [req.params.id, emp.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (err) {
    console.error('[Emp Job DELETE]', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// GET /api/employer/jobs/:id/applicants
router.get('/jobs/:id/applicants', async (req, res) => {
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });

    const [jobs] = await db.query(
      'SELECT * FROM job_posts WHERE id = ? AND employer_id = ?',
      [req.params.id, emp.id]
    );
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });

    const [applicants] = await db.query(
      `SELECT ja.id AS application_id, ja.application_status, ja.applied_at, ja.cover_letter,
              js.id AS job_seeker_id, js.first_name, js.middle_name, js.last_name,
              js.contact_number, js.city, js.province, js.education_level, js.course,
              js.years_of_experience, js.employment_status, js.preferred_occupation,
              u.email
       FROM job_applications ja
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       JOIN users u ON u.id = js.user_id
       WHERE ja.job_post_id = ?
       ORDER BY ja.applied_at DESC`,
      [req.params.id]
    );

    res.json({ job: jobs[0], applicants });
  } catch (err) {
    console.error('[Emp Applicants]', err);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// PUT /api/employer/applications/:id/status
router.put('/applications/:id/status', async (req, res) => {
  const { status, notes } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const emp = await getEmployer(req.user.id);
    if (!emp) {
      await conn.rollback();
      return res.status(404).json({ error: 'Profile not found' });
    }

    const [apps] = await conn.query(
      `SELECT ja.*, jp.job_title, jp.employer_id, js.user_id AS seeker_user_id
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       WHERE ja.id = ?`,
      [req.params.id]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }
    const app = apps[0];
    if (app.employer_id !== emp.id) {
      await conn.rollback();
      return res.status(403).json({ error: 'Not authorized' });
    }

    const oldStatus = app.application_status;

    await conn.query(
      'UPDATE job_applications SET application_status = ? WHERE id = ?',
      [status, req.params.id]
    );

    await conn.query(
      `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, oldStatus, status, req.user.id, notes || null]
    );

    // Notify job seeker (tracking visibility only — not a hiring decision)
    const statusLabel = {
      submitted: 'submitted',
      pending: 'pending review',
      for_review: 'now under review',
      referred: 'referred for employer consideration',
      rejected: 'no longer being considered',
      closed: 'closed',
    }[status];
    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES (?, ?, ?, 'application_status', ?, 'application')`,
      [
        app.seeker_user_id,
        'Application Status Updated',
        `Your application for "${app.job_title}" is ${statusLabel}.`,
        req.params.id,
      ]
    );

    await conn.commit();
    res.json({ message: 'Status updated' });
  } catch (err) {
    await conn.rollback();
    console.error('[Emp Status]', err);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    conn.release();
  }
});

module.exports = router;
