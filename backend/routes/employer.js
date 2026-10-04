// ============================================================
// Employer Routes - profile, jobs, applicants, status updates
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  recordHistory, notify, closeJobRecords, buildSkillComparison, ACTIVE_APPLICATION_STATUSES,
} = require('../services/referral');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

// Employers only see and update PESO-referred applicants (the referral itself is PESO Admin's decision).
const EMPLOYER_STATUSES = ['for_review', 'for_interview', 'hired', 'rejected'];

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
        (SELECT COUNT(*) FROM job_applications
         WHERE job_post_id = jp.id AND referral_status = 'peso_referred') AS applicant_count
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
    location, vacancies, requirements, closing_date, required_skills, application_email,
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
         location, vacancies, requirements, application_email, closing_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        emp.id, job_title, job_description, job_type || 'full-time',
        salary_min || null, salary_max || null, location || null,
        vacancies || 1, requirements || null, application_email || null, closing_date || null,
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

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       SELECT u.id, ?, ?, 'new_job_post', ?, 'job_post'
       FROM users u
       JOIN job_seekers js ON js.user_id = u.id
       WHERE u.role = 'job_seeker' AND u.account_status = 'active'`,
      [
        'New Job Posted',
        `${emp.company_name} posted "${job_title}". Open the job details to review requirements and application instructions.`,
        jobId,
      ]
    );

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
    location, vacancies, requirements, closing_date, status, required_skills, application_email,
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
         location=?, vacancies=?, requirements=?, application_email=?, closing_date=?, status=?
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
        // Blank clears the optional email; omitted keeps it.
        application_email === undefined ? job.application_email : (application_email || null),
        closing_date || job.closing_date,
        status || job.status,
        req.params.id,
      ]
    );

    const nextStatus = status || job.status;
    if (nextStatus === 'closed' && job.status !== 'closed') {
      await closeJobRecords(conn, job.id, req.user.id, job_title || job.job_title, 'the employer');
    } else if (nextStatus === 'active') {
      // Job posting update alert (§3.5.4) for job seekers whose application is still in progress.
      const [active] = await conn.query(
        `SELECT DISTINCT js.user_id FROM job_applications ja JOIN job_seekers js ON js.id = ja.job_seeker_id
         WHERE ja.job_post_id = ? AND ja.referral_status = 'peso_referred' AND ja.application_status IN (?)`,
        [job.id, ACTIVE_APPLICATION_STATUSES]
      );
      for (const applicant of active) {
        await notify(
          conn,
          applicant.user_id,
          'Job Post Updated',
          `${emp.company_name} updated the job post "${job_title || job.job_title}". Open it to review the latest details.`,
          'job_post_update',
          job.id,
          'job_post'
        );
      }
    }

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

// PUT /api/employer/jobs/:id/close - employer soft-closes a job post
router.put('/jobs/:id/close', async (req, res) => {
  const emp = await requireApprovedEmployer(req, res);
  if (!emp) return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [jobs] = await conn.query(
      'SELECT id, job_title FROM job_posts WHERE id = ? AND employer_id = ?',
      [req.params.id, emp.id]
    );
    if (jobs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }

    await conn.query("UPDATE job_posts SET status = 'closed' WHERE id = ?", [req.params.id]);
    const closed = await closeJobRecords(conn, jobs[0].id, req.user.id, jobs[0].job_title, 'the employer');

    await conn.commit();
    res.json({
      message: 'Job post closed; record retained for monitoring',
      closed_applications: closed.applications + closed.referrals,
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Emp Job Close]', err);
    res.status(500).json({ error: 'Failed to close job post' });
  } finally {
    conn.release();
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
              ja.referral_status, ja.referral_notes, ja.referral_reviewed_at,
              js.id AS job_seeker_id, js.first_name, js.middle_name, js.last_name,
              js.contact_number, js.city, js.province, js.education_level, js.course,
              js.years_of_experience, js.employment_status, js.preferred_occupation,
              js.profile_completed,
              u.email
       FROM job_applications ja
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       JOIN users u ON u.id = js.user_id
       WHERE ja.job_post_id = ? AND ja.referral_status = 'peso_referred'
       ORDER BY ja.referral_reviewed_at DESC`,
      [req.params.id]
    );

    const [requiredSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jrs.required_level, jrs.is_required
       FROM job_required_skills jrs
       JOIN skills s ON s.id = jrs.skill_id
       WHERE jrs.job_post_id = ?`,
      [req.params.id]
    );

    const applicantIds = applicants.map((applicant) => applicant.job_seeker_id);
    let seekerSkills = [];
    if (applicantIds.length > 0) {
      const [rows] = await db.query(
        `SELECT jss.job_seeker_id, s.id, s.skill_name, s.category, jss.proficiency_level
         FROM job_seeker_skills jss
         JOIN skills s ON s.id = jss.skill_id
         WHERE jss.job_seeker_id IN (?)`,
        [applicantIds]
      );
      seekerSkills = rows;
    }

    const skillsBySeeker = new Map();
    for (const skill of seekerSkills) {
      if (!skillsBySeeker.has(skill.job_seeker_id)) {
        skillsBySeeker.set(skill.job_seeker_id, []);
      }
      skillsBySeeker.get(skill.job_seeker_id).push({
        id: skill.id,
        skill_name: skill.skill_name,
        category: skill.category,
        proficiency_level: skill.proficiency_level,
      });
    }

    const applicantsWithComparison = applicants.map((applicant) => {
      const applicantSkills = skillsBySeeker.get(applicant.job_seeker_id) || [];
      return {
        ...applicant,
        applicant_skills: applicantSkills,
        ...buildSkillComparison(requiredSkills, applicantSkills),
      };
    });

    res.json({ job: jobs[0], applicants: applicantsWithComparison });
  } catch (err) {
    console.error('[Emp Applicants]', err);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// PUT /api/employer/applications/:id/status
router.put('/applications/:id/status', async (req, res) => {
  const { status, notes } = req.body;
  if (!EMPLOYER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${EMPLOYER_STATUSES.join(', ')}` });
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
    if (app.referral_status !== 'peso_referred') {
      await conn.rollback();
      return res.status(403).json({ error: 'Only PESO-referred applicants can be updated by the employer' });
    }

    const oldStatus = app.application_status;

    await conn.query(
      'UPDATE job_applications SET application_status = ? WHERE id = ?',
      [status, req.params.id]
    );

    await recordHistory(conn, {
      applicationId: req.params.id,
      type: 'application',
      oldStatus,
      newStatus: status,
      changedBy: req.user.id,
      notes,
    });

    // Notify job seeker (tracking visibility only — not a hiring decision)
    const statusLabel = {
      for_review: 'now under review by the employer',
      for_interview: 'set for interview',
      hired: 'marked hired by the employer',
      rejected: 'no longer being considered by the employer',
    }[status];
    const notifTitle = status === 'hired' ? 'Congratulations! You are Hired' : 'Application Status Updated';
    const notifMessage = status === 'hired'
      ? `Congratulations! Your application for "${app.job_title}" has been marked as Hired by the employer. Please remember to update your employment status on your NSRP profile.`
      : `Your application for "${app.job_title}" is ${statusLabel}.`;

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES (?, ?, ?, 'application_status', ?, 'application')`,
      [
        app.seeker_user_id,
        notifTitle,
        notifMessage,
        req.params.id,
      ]
    );

    if (status === 'hired' && oldStatus !== 'hired') {
      const [[job]] = await conn.query('SELECT id, vacancies, status FROM job_posts WHERE id = ?', [app.job_post_id]);
      const [[hired]] = await conn.query(
        "SELECT COUNT(*) AS count FROM job_applications WHERE job_post_id = ? AND application_status = 'hired'",
        [app.job_post_id]
      );
      if (job.status === 'active' && hired.count >= job.vacancies) {
        await notify(
          conn,
          req.user.id,
          'All Vacancies Filled',
          `"${app.job_title}" now has ${hired.count} hired for ${job.vacancies} ${job.vacancies === 1 ? 'vacancy' : 'vacancies'}. Close the job post when you are done so the remaining applicants are informed.`,
          'vacancies_filled',
          job.id,
          'job_post'
        );
      }
    }

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
