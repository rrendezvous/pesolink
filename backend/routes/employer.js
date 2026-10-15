// ============================================================
// Employer Routes - profile, jobs, applicants, status updates
// ============================================================
const express = require('express');
const db = require('../db');
const { isValidEmail, INVALID_EMAIL_MESSAGE } = require('../services/email');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  recordHistory, notify, closeJobRecords, buildSkillComparison, ACTIVE_APPLICATION_STATUSES,
} = require('../services/referral');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

// Employers only see and update PESO-referred applicants (the referral itself is PESO Admin's decision).
const EMPLOYER_STATUSES = ['for_review', 'for_interview', 'hired', 'rejected'];

// 'YYYY-MM-DD' that is a real calendar date (MySQL rejects 2026-13-01 with a server error).
function isRealDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Today as YYYY-MM-DD in server time (Philippine time, same as MySQL CURDATE()).
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];
const isBlank = (v) => !String(v ?? '').trim();

// Checks the job post fields; returns an error message, or null when they are fine.
// On edit, `saved` is the stored job post: omitted fields keep their saved values.
function jobInputError(body, saved = null) {
  const { job_title, job_description, job_type, vacancies, salary_min, salary_max } = body;
  const titleBlank = saved ? job_title !== undefined && isBlank(job_title) : isBlank(job_title);
  const descBlank = saved ? job_description !== undefined && isBlank(job_description) : isBlank(job_description);
  if (titleBlank || descBlank) return 'Job title and description are required';
  if (!isBlank(job_type) && !JOB_TYPES.includes(job_type)) return `Job type must be one of: ${JOB_TYPES.join(', ')}`;
  if (!isBlank(vacancies) && !(Number.isInteger(Number(vacancies)) && Number(vacancies) >= 1)) {
    return 'Vacancies must be a whole number of at least 1';
  }
  // Same rule as saving: omitted keeps the saved amount, blank clears it.
  const amount = (value, savedValue) => {
    if (value === undefined) return saved && savedValue != null ? Number(savedValue) : null;
    return isBlank(value) ? null : Number(value);
  };
  const min = amount(salary_min, saved?.salary_min);
  const max = amount(salary_max, saved?.salary_max);
  if ([min, max].some((v) => v !== null && !(Number.isFinite(v) && v >= 0))) return 'Salary must be an amount of 0 or more';
  if (min !== null && max !== null && min > max) return 'Salary Min cannot be higher than Salary Max';
  return null;
}

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
  if (company_name !== undefined && !String(company_name ?? '').trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }
  try {
    const emp = await getEmployer(req.user.id);
    if (!emp) return res.status(404).json({ error: 'Profile not found' });

    await db.query(
      `UPDATE employers SET
         company_name=?, company_address=?, contact_person=?, contact_number=?,
         business_type=?, company_size=?
       WHERE id=?`,
      [
        company_name ? String(company_name).trim() : emp.company_name,
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
  // Saved without surrounding spaces; blank or spaces only clears it.
  const appEmail = typeof application_email === 'string' ? application_email.trim() : application_email;

  const inputError = jobInputError(req.body);
  if (inputError) {
    return res.status(400).json({ error: inputError });
  }
  if (closing_date && !isRealDate(closing_date)) {
    return res.status(400).json({ error: 'Closing date must be a real date written as YYYY-MM-DD' });
  }
  // A new post that is already past its closing date would be hidden from job seekers right away.
  if (closing_date && String(closing_date).trim() < todayKey()) {
    return res.status(400).json({ error: 'Closing date cannot be in the past' });
  }
  if (appEmail && !isValidEmail(appEmail)) {
    return res.status(400).json({ error: `Application email: ${INVALID_EMAIL_MESSAGE}` });
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
        emp.id, String(job_title).trim(), String(job_description).trim(), job_type || 'full-time',
        salary_min || null, salary_max || null, location || null,
        vacancies || 1, requirements || null, appEmail || null, closing_date ? String(closing_date).trim() : null,
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
  // Saved without surrounding spaces; blank or spaces only clears it.
  const appEmail = typeof application_email === 'string' ? application_email.trim() : application_email;

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
    const inputError = jobInputError(req.body, job);
    if (inputError) {
      await conn.rollback();
      return res.status(400).json({ error: inputError });
    }
    if (!isBlank(status) && !['active', 'closed'].includes(status)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Status must be active or closed' });
    }
    // Reopening needs its own flow (restoring the applications the closing closed), which is not built.
    if (status === 'active' && job.status === 'closed') {
      await conn.rollback();
      return res.status(400).json({ error: 'A closed job post cannot be reopened. Post a new job instead.' });
    }
    if (closing_date && !isRealDate(closing_date)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Closing date must be a real date written as YYYY-MM-DD' });
    }
    if (appEmail && !isValidEmail(appEmail)) {
      await conn.rollback();
      return res.status(400).json({ error: `Application email: ${INVALID_EMAIL_MESSAGE}` });
    }
    // Optional fields: omitted keeps the saved value, blank clears it.
    const optional = (value, saved) => (value === undefined ? saved : (value === '' ? null : value));
    const next = {
      job_title: job_title ? String(job_title).trim() : job.job_title,
      job_description: job_description ? String(job_description).trim() : job.job_description,
      job_type: job_type || job.job_type,
      salary_min: optional(salary_min, job.salary_min),
      salary_max: optional(salary_max, job.salary_max),
      location: optional(location, job.location),
      vacancies: vacancies || job.vacancies,
      requirements: optional(requirements, job.requirements),
      application_email: optional(appEmail, job.application_email),
      closing_date: optional(typeof closing_date === 'string' ? closing_date.trim() : closing_date, job.closing_date),
    };

    await conn.query(
      `UPDATE job_posts SET
         job_title=?, job_description=?, job_type=?, salary_min=?, salary_max=?,
         location=?, vacancies=?, requirements=?, application_email=?, closing_date=?, status=?
       WHERE id=?`,
      [
        next.job_title, next.job_description, next.job_type, next.salary_min, next.salary_max,
        next.location, next.vacancies, next.requirements, next.application_email, next.closing_date,
        status || job.status,
        req.params.id,
      ]
    );

    // "Job Post Updated" goes out only when something job seekers see on the post changed: the fields
    // above or the required skills. Saving the same values again (e.g. tapping Update Job with no edits)
    // sends nothing. Values are compared the way they are shown (numbers as numbers, blank text as empty).
    const asText = (v) => String(v ?? '').trim();
    const asNumber = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
    const textFields = ['job_title', 'job_description', 'job_type', 'location', 'requirements', 'application_email'];
    const numberFields = ['salary_min', 'salary_max', 'vacancies'];
    let postingChanged = textFields.some((f) => asText(next[f]) !== asText(job[f]))
      || numberFields.some((f) => asNumber(next[f]) !== asNumber(job[f]))
      || asText(next.closing_date).slice(0, 10) !== asText(job.closing_date).slice(0, 10);
    if (!postingChanged && Array.isArray(required_skills)) {
      const [savedSkills] = await conn.query('SELECT skill_id FROM job_required_skills WHERE job_post_id = ?', [job.id]);
      const idList = (ids) => [...new Set(ids.map(Number))].sort((a, b) => a - b).join(',');
      postingChanged = idList(required_skills.filter((s) => s.skill_id).map((s) => s.skill_id))
        !== idList(savedSkills.map((s) => s.skill_id));
    }

    const nextStatus = status || job.status;
    if (nextStatus === 'closed' && job.status !== 'closed') {
      await closeJobRecords(conn, job.id, req.user.id, next.job_title, 'the employer');
    } else if (nextStatus === 'active' && postingChanged) {
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
          `${emp.company_name} updated the job post "${next.job_title}". Open it to review the latest details.`,
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
      'SELECT id, job_title, status FROM job_posts WHERE id = ? AND employer_id = ?',
      [req.params.id, emp.id]
    );
    if (jobs.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job not found' });
    }
    if (jobs[0].status === 'closed') {
      await conn.rollback();
      return res.status(400).json({ error: 'This job post is already closed' });
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
    // Closed records (job post closed, job seeker deactivated) are final; the seeker was already told why.
    if (oldStatus === 'closed') {
      await conn.rollback();
      return res.status(409).json({ error: 'This application is closed and can no longer be updated' });
    }
    // Same status again: nothing changes, so no duplicate history entry or notification.
    if (oldStatus === status) {
      await conn.rollback();
      return res.json({ message: 'Status unchanged' });
    }

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
          `"${app.job_title}" now has ${hired.count} hired for ${job.vacancies} ${job.vacancies === 1 ? 'vacancy' : 'vacancies'}. Your other applicants are not changed. You can keep them for future openings, update each one's status, or stop accepting applications for this job post.`,
          'vacancies_filled',
          job.id,
          'job_post'
        );
      }
      // The hire that fills the last vacancy also tells applicants still in progress, once.
      // Their status is not changed: the employer may keep them for future openings.
      if (job.status === 'active' && hired.count === job.vacancies) {
        const [waiting] = await conn.query(
          `SELECT ja.id, js.user_id FROM job_applications ja
           JOIN job_seekers js ON js.id = ja.job_seeker_id
           WHERE ja.job_post_id = ? AND ja.referral_status = 'peso_referred'
             AND ja.application_status IN ('for_review', 'for_interview')`,
          [app.job_post_id]
        );
        for (const other of waiting) {
          await notify(
            conn,
            other.user_id,
            'Vacancies Filled',
            `All vacancies for "${app.job_title}" have been filled. Your application stays with the employer, who may still contact you for future openings. This is not a rejection. You can also apply to other jobs.`,
            'vacancies_filled',
            other.id,
            'application'
          );
        }
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
