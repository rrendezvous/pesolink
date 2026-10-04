// ============================================================
// PESO Admin Routes - employer approvals, monitoring, simple counts
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateReferralReadiness, refreshProfileCompleted, parseFullData } = require('../services/nsrpProfileValidation');
const {
  notify, closeJobRecords, closeActiveApplications, buildSkillComparison,
} = require('../services/referral');
const { NSRP_STATUS_LABELS, NSRP_OPEN_STATUSES, nsrpFingerprint } = require('../services/nsrpReview');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// NSRP Form 1 "Eligible for public employment services?" options (for use of PESO only).
const PESO_PROGRAMS = ['SPES', 'GIP', 'TUPAD', 'JobStart'];

// GET /api/admin/employers/pending
router.get('/employers/pending', async (req, res) => {
  try {
    const [employers] = await db.query(
      `SELECT e.*, u.email, u.created_at AS registered_at
       FROM employers e JOIN users u ON u.id = e.user_id
       WHERE e.approval_status = 'pending'
       ORDER BY e.created_at DESC`
    );
    res.json({ employers });
  } catch (err) {
    console.error('[Admin Pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending employers' });
  }
});

// GET /api/admin/employers
router.get('/employers', async (req, res) => {
  try {
    const [employers] = await db.query(
      `SELECT e.*, u.email, u.account_status, u.created_at AS registered_at
       FROM employers e JOIN users u ON u.id = e.user_id
       ORDER BY e.created_at DESC`
    );
    res.json({ employers });
  } catch (err) {
    console.error('[Admin Employers]', err);
    res.status(500).json({ error: 'Failed to fetch employers' });
  }
});

// POST /api/admin/employers - Admin creates an employer account directly
// (Employer self-registration is disabled; this is the only way to create one.)
router.post('/employers', async (req, res) => {
  const {
    email, password, company_name, company_address,
    contact_person, contact_number, business_type, company_size,
  } = req.body;

  if (!email || !password || !company_name) {
    return res.status(400).json({ error: 'email, password and company_name are required' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const bcrypt = require('bcryptjs');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'employer', 'active')",
      [cleanEmail, passwordHash]
    );
    const userId = userResult.insertId;

    const [empResult] = await conn.query(
      `INSERT INTO employers
        (user_id, company_name, company_address, contact_person, contact_number,
         business_type, company_size, approval_status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
      [
        userId, company_name, company_address || null, contact_person || null,
        contact_number || null, business_type || null, company_size || null,
        req.user.id,
      ]
    );

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'employer_account_created')`,
      [userId, 'Employer account created', 'Your employer account has been created by PESO Admin. You can now sign in and post jobs.']
    );

    await conn.commit();
    res.status(201).json({
      message: 'Employer account created',
      employer_id: empResult.insertId,
      user_id: userId,
    });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Create Employer]', err);
    res.status(500).json({ error: 'Failed to create employer account' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/employers/:id/approve
router.put('/employers/:id/approve', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [employers] = await conn.query('SELECT * FROM employers WHERE id = ?', [req.params.id]);
    if (employers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Employer not found' });
    }
    const emp = employers[0];

    await conn.query(
      `UPDATE employers SET approval_status='approved', approved_by=?, approved_at=NOW()
       WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await conn.query("UPDATE users SET account_status='active' WHERE id=?", [emp.user_id]);

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'employer_approval')`,
      [emp.user_id, 'Account Approved', 'Your employer account has been approved. You can now post jobs.']
    );

    await conn.commit();
    res.json({ message: 'Employer approved' });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Approve]', err);
    res.status(500).json({ error: 'Failed to approve' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/employers/:id/reject
router.put('/employers/:id/reject', async (req, res) => {
  const { reason } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [employers] = await conn.query('SELECT * FROM employers WHERE id = ?', [req.params.id]);
    if (employers.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Employer not found' });
    }
    const emp = employers[0];

    await conn.query(
      `UPDATE employers SET approval_status='rejected', approved_by=?, approved_at=NOW()
       WHERE id=?`,
      [req.user.id, req.params.id]
    );
    await conn.query("UPDATE users SET account_status='suspended' WHERE id=?", [emp.user_id]);

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'employer_approval')`,
      [
        emp.user_id,
        'Account Rejected',
        `Your employer account was rejected.${reason ? ' Reason: ' + reason : ''}`,
      ]
    );

    await conn.commit();
    res.json({ message: 'Employer rejected' });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Reject]', err);
    res.status(500).json({ error: 'Failed to reject' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/employers/:id - PESO Admin corrects an employer's company details (§3.5.3)
router.put('/employers/:id', async (req, res) => {
  const fields = ['company_name', 'company_address', 'contact_person', 'contact_number', 'business_type', 'company_size'];
  const updates = Object.fromEntries(fields.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));
  if (updates.company_name !== undefined && !String(updates.company_name).trim()) {
    return res.status(400).json({ error: 'Company name cannot be blank' });
  }
  if (updates.company_size && !['small', 'medium', 'large'].includes(updates.company_size)) {
    return res.status(400).json({ error: 'Company size must be small, medium, or large' });
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  try {
    const [rows] = await db.query('SELECT * FROM employers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Employer not found' });
    const emp = rows[0];

    const values = Object.values(updates).map((v) => (typeof v === 'string' && v.trim() === '' ? null : v));
    await db.query(
      `UPDATE employers SET ${Object.keys(updates).map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...values, emp.id]
    );
    await notify(
      db,
      emp.user_id,
      'Company Details Updated',
      'PESO Admin updated your company details. Open your dashboard to review them.',
      'employer_account',
      emp.id,
      'employer'
    );
    const [updated] = await db.query(
      'SELECT e.*, u.email, u.account_status FROM employers e JOIN users u ON u.id = e.user_id WHERE e.id = ?',
      [emp.id]
    );
    res.json({ message: 'Employer details updated', employer: updated[0] });
  } catch (err) {
    console.error('[Admin Update Employer]', err);
    res.status(500).json({ error: 'Failed to update employer' });
  }
});

// PUT /api/admin/employers/:id/deactivate - suspend an employer account (§3.5.3 manage employer accounts)
// Its active job posts are closed so job seekers are not left waiting on an employer who can no longer act.
router.put('/employers/:id/deactivate', async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM employers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Employer not found' });
    }
    const emp = rows[0];

    await conn.query("UPDATE users SET account_status = 'suspended' WHERE id = ?", [emp.user_id]);
    const [jobs] = await conn.query("SELECT id, job_title FROM job_posts WHERE employer_id = ? AND status = 'active'", [emp.id]);
    for (const job of jobs) {
      await conn.query("UPDATE job_posts SET status = 'closed' WHERE id = ?", [job.id]);
      await closeJobRecords(conn, job.id, req.user.id, job.job_title, 'PESO Admin');
    }
    await notify(
      conn,
      emp.user_id,
      'Account Deactivated',
      `Your employer account was deactivated by PESO Admin.${reason ? ` Reason: ${reason}` : ''} Your active job posts were closed.`,
      'account_deactivated',
      emp.id,
      'employer'
    );

    await conn.commit();
    res.json({ message: 'Employer account deactivated', closed_job_posts: jobs.length });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Deactivate Employer]', err);
    res.status(500).json({ error: 'Failed to deactivate employer' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/employers/:id/reactivate - closed job posts stay closed; the employer can post again
router.put('/employers/:id/reactivate', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Employer not found' });
    const emp = rows[0];
    if (emp.approval_status !== 'approved') {
      return res.status(400).json({ error: 'Approve this employer instead; only approved accounts can be reactivated' });
    }
    await db.query("UPDATE users SET account_status = 'active' WHERE id = ?", [emp.user_id]);
    await notify(
      db,
      emp.user_id,
      'Account Reactivated',
      'Your employer account was reactivated by PESO Admin. Job posts closed during the deactivation stay closed; you can post again.',
      'account_reactivated',
      emp.id,
      'employer'
    );
    res.json({ message: 'Employer account reactivated' });
  } catch (err) {
    console.error('[Admin Reactivate Employer]', err);
    res.status(500).json({ error: 'Failed to reactivate employer' });
  }
});

// GET /api/admin/job-seekers/:id/nsrp-forms - uploaded NSRP form images, for comparing with the encoded profile.
// Kept separate from the profile endpoint because the images are large.
router.get('/job-seekers/:id/nsrp-forms', async (req, res) => {
  try {
    const [forms] = await db.query(
      `SELECT id, image_base64, ocr_confirmed, uploaded_at
       FROM uploaded_nsrp_forms WHERE job_seeker_id = ? ORDER BY uploaded_at DESC LIMIT 4`,
      [req.params.id]
    );
    res.json({ forms });
  } catch (err) {
    console.error('[Admin NSRP Forms]', err);
    res.status(500).json({ error: 'Failed to fetch uploaded NSRP forms' });
  }
});

// GET /api/admin/job-seekers - NSRP profiles waiting for PESO verification first
router.get('/job-seekers', async (req, res) => {
  try {
    const [seekers] = await db.query(
      `SELECT js.*, u.email, u.account_status, u.created_at AS registered_at
       FROM job_seekers js JOIN users u ON u.id = js.user_id
       ORDER BY FIELD(js.nsrp_status, 'for_review', 'submitted') DESC, js.nsrp_submitted_at ASC, js.created_at DESC`
    );
    res.json({ job_seekers: seekers });
  } catch (err) {
    console.error('[Admin Seekers]', err);
    res.status(500).json({ error: 'Failed to fetch job seekers' });
  }
});

// GET /api/admin/job-seekers/:id/profile - full NSRP profile, skills, and referral requests (monitoring)
router.get('/job-seekers/:id/profile', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT js.*, u.email, u.account_status, u.created_at AS registered_at,
              reviewer.email AS nsrp_reviewed_by_email
       FROM job_seekers js
       JOIN users u ON u.id = js.user_id
       LEFT JOIN users reviewer ON reviewer.id = js.nsrp_reviewed_by
       WHERE js.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Job seeker not found' });
    const profile = rows[0];
    profile.nsrp_full_data = parseFullData(profile.nsrp_full_data);

    const [skills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss
       JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?
       ORDER BY s.category, s.skill_name`,
      [profile.id]
    );

    const [applications] = await db.query(
      `SELECT ja.id, ja.application_status, ja.referral_status, ja.applied_at, jp.job_title, e.company_name
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       WHERE ja.job_seeker_id = ?
       ORDER BY ja.applied_at DESC`,
      [profile.id]
    );

    const referralRequirements = validateReferralReadiness(profile, { selectedSkillCount: skills.length });
    const [[uploads]] = await db.query('SELECT COUNT(*) AS count FROM uploaded_nsrp_forms WHERE job_seeker_id = ?', [profile.id]);

    res.json({
      profile, skills, applications, referral_requirements: referralRequirements, uploaded_form_count: uploads.count,
    });
  } catch (err) {
    console.error('[Admin Seeker Profile]', err);
    res.status(500).json({ error: 'Failed to fetch job seeker profile' });
  }
});

// PUT /api/admin/job-seekers/:id/nsrp-status - PESO Admin's one-time NSRP verification
//   for_review     - recorded when PESO opens a submitted profile (no-op otherwise)
//   verified       - the job seeker can apply to any job as PESO-Referred
//   needs_revision - returned with a reason; the job seeker fixes the profile and resubmits
// Only profiles waiting on PESO (submitted / for_review) can be decided. A verified profile goes back
// to PESO automatically when the job seeker changes it.
router.put('/job-seekers/:id/nsrp-status', async (req, res) => {
  const { nsrp_status: next, notes, peso_assessment: assessment } = req.body;
  if (!['for_review', 'verified', 'needs_revision'].includes(next)) {
    return res.status(400).json({ error: 'nsrp_status must be for_review, verified, or needs_revision' });
  }
  const reason = String(notes || '').trim();
  if (next === 'needs_revision' && !reason) {
    return res.status(400).json({ error: 'Please tell the job seeker what needs to be revised' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_seekers WHERE id = ? FOR UPDATE', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job seeker not found' });
    }
    const seeker = rows[0];
    const current = seeker.nsrp_status;

    if (next === 'for_review' && current !== 'submitted') {
      await conn.rollback();
      return res.json({ message: 'NSRP profile is not waiting to be opened', nsrp_status: current });
    }
    if (!NSRP_OPEN_STATUSES.includes(current)) {
      await conn.rollback();
      return res.status(400).json({
        error: `This NSRP profile is ${NSRP_STATUS_LABELS[current]}, so there is nothing to decide`,
      });
    }
    if (next === 'verified') {
      const requirements = await refreshProfileCompleted(conn, seeker.id);
      if (!requirements.isComplete) {
        await conn.rollback();
        return res.status(400).json({
          error: 'The NSRP profile is missing required items and cannot be verified',
          missing_fields: requirements.missing_fields,
        });
      }
    }

    await conn.query(
      `UPDATE job_seekers
       SET nsrp_status = ?, nsrp_review_notes = ?, nsrp_reviewed_by = ?, nsrp_reviewed_at = NOW(), nsrp_reviewed_hash = ?
       WHERE id = ?`,
      [next, reason || null, req.user.id, next === 'verified' ? await nsrpFingerprint(conn, seeker.id) : seeker.nsrp_reviewed_hash, seeker.id]
    );
    // NSRP Form 1 "For use of PESO only": eligibility for public employment services.
    if (next === 'verified' && assessment && typeof assessment === 'object') {
      const programs = (Array.isArray(assessment.programs) ? assessment.programs : [])
        .filter((p) => PESO_PROGRAMS.includes(p));
      await conn.query('UPDATE job_seekers SET peso_assessment = ? WHERE id = ?', [
        JSON.stringify({
          programs,
          other: String(assessment.other || '').trim() || null,
          assessed_by: req.user.email,
          assessed_at: new Date().toISOString(),
        }),
        seeker.id,
      ]);
    }

    const message = {
      for_review: ['NSRP Profile For Review', 'PESO Misamis Oriental is now reviewing your NSRP profile.'],
      verified: [
        'NSRP Profile PESO-Verified',
        `PESO Misamis Oriental verified your NSRP profile.${reason ? ` Note: ${reason}` : ''} You can now apply to jobs with PESO referral. Changing your NSRP profile later sends it back to PESO for re-checking.`,
      ],
      needs_revision: [
        'NSRP Profile Needs Revision',
        `PESO Misamis Oriental returned your NSRP profile. What to fix: ${reason}. Update your profile and submit it again.`,
      ],
    }[next];
    await notify(conn, seeker.user_id, message[0], message[1], 'nsrp_review', seeker.id, 'job_seeker');

    await conn.commit();
    res.json({ message: `NSRP profile marked ${NSRP_STATUS_LABELS[next]}`, nsrp_status: next });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin NSRP Status]', err);
    res.status(500).json({ error: 'Failed to update NSRP status' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/job-seekers/:id/deactivate - admin suspends a seeker account
router.put('/job-seekers/:id/deactivate', async (req, res) => {
  const { reason } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_seekers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job seeker not found' });
    }
    const seeker = rows[0];

    await conn.query("UPDATE users SET account_status='suspended' WHERE id=?", [seeker.user_id]);
    await closeActiveApplications(conn, {
      where: 'ja.job_seeker_id = ?',
      params: [seeker.id],
      closedBy: req.user.id,
      note: 'The job seeker account was deactivated by PESO Admin.',
      seekerMessage: (app) => `Your application for "${app.job_title}" was closed because your account was deactivated.`,
      notifyEmployer: true,
    });

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'account_deactivated')`,
      [
        seeker.user_id,
        'Account Deactivated',
        `Your job seeker account has been deactivated by PESO Admin.${reason ? ' Reason: ' + reason : ''}`,
      ]
    );

    await conn.commit();
    res.json({ message: 'Job seeker account deactivated' });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Deactivate Seeker]', err);
    res.status(500).json({ error: 'Failed to deactivate' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/job-seekers/:id/reactivate - admin re-activates a seeker
router.put('/job-seekers/:id/reactivate', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_seekers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job seeker not found' });
    }
    const seeker = rows[0];

    await conn.query("UPDATE users SET account_status='active' WHERE id=?", [seeker.user_id]);

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'account_reactivated')`,
      [seeker.user_id, 'Account Reactivated', 'Your job seeker account has been reactivated.']
    );

    await conn.commit();
    res.json({ message: 'Job seeker account reactivated' });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Reactivate Seeker]', err);
    res.status(500).json({ error: 'Failed to reactivate' });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/jobs/:id/close - admin soft-closes a job post (no hard delete)
router.put('/jobs/:id/close', async (req, res) => {
  const { reason } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT jp.*, e.user_id AS employer_user_id, e.company_name
       FROM job_posts jp JOIN employers e ON e.id = jp.employer_id WHERE jp.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Job post not found' });
    }
    const job = rows[0];

    await conn.query("UPDATE job_posts SET status='closed' WHERE id=?", [req.params.id]);
    await closeJobRecords(conn, job.id, req.user.id, job.job_title, 'PESO Admin');

    await conn.query(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES (?, ?, ?, 'job_closed_by_admin', ?, 'job_post')`,
      [
        job.employer_user_id,
        'Job Post Closed',
        `Your job post "${job.job_title}" has been closed by PESO Admin.${reason ? ' Reason: ' + reason : ''}`,
        job.id,
      ]
    );

    await conn.commit();
    res.json({ message: 'Job post closed (soft removal; record retained for audit)' });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Close Job]', err);
    res.status(500).json({ error: 'Failed to close job post' });
  } finally {
    conn.release();
  }
});

// GET /api/admin/jobs
router.get('/jobs', async (req, res) => {
  try {
    const [jobs] = await db.query(
      `SELECT jp.*, e.company_name,
        (SELECT COUNT(*) FROM job_applications WHERE job_post_id = jp.id) AS applicant_count
       FROM job_posts jp JOIN employers e ON e.id = jp.employer_id
       ORDER BY jp.posted_at DESC`
    );
    res.json({ jobs });
  } catch (err) {
    console.error('[Admin Jobs]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/admin/applications - PESO-referred applications across all job posts (monitoring)
router.get('/applications', async (req, res) => {
  try {
    const [apps] = await db.query(
      `SELECT ja.*, jp.job_title, jp.location, jp.status AS job_status, jp.vacancies, e.id AS employer_id, e.company_name,
              js.first_name, js.last_name, js.profile_completed, u.email AS seeker_email
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       JOIN users u ON u.id = js.user_id
       ORDER BY ja.updated_at DESC`
    );
    res.json({ applications: apps });
  } catch (err) {
    console.error('[Admin Apps]', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/admin/applications/:id - application with the applicant's full NSRP profile (monitoring)
router.get('/applications/:id', async (req, res) => {
  try {
    const [apps] = await db.query(
      `SELECT ja.*, jp.job_title, jp.location, jp.job_type, jp.status AS job_status,
              e.company_name, reviewer.email AS referral_reviewed_by_email
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       LEFT JOIN users reviewer ON reviewer.id = ja.referral_reviewed_by
       WHERE ja.id = ?`,
      [req.params.id]
    );
    if (apps.length === 0) return res.status(404).json({ error: 'Referral request not found' });
    const application = apps[0];

    const [profiles] = await db.query(
      `SELECT js.*, u.email, u.account_status, u.created_at AS registered_at
       FROM job_seekers js JOIN users u ON u.id = js.user_id
       WHERE js.id = ?`,
      [application.job_seeker_id]
    );
    const profile = profiles[0];
    profile.nsrp_full_data = parseFullData(profile.nsrp_full_data);

    const [skills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?
       ORDER BY s.category, s.skill_name`,
      [profile.id]
    );
    const [requiredSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category
       FROM job_required_skills jrs JOIN skills s ON s.id = jrs.skill_id
       WHERE jrs.job_post_id = ?`,
      [application.job_post_id]
    );
    const [history] = await db.query(
      `SELECT ash.*, u.email AS changed_by_email
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = ?
       ORDER BY ash.changed_at ASC, ash.id ASC`,
      [application.id]
    );

    res.json({
      application,
      profile,
      skills,
      skill_comparison: buildSkillComparison(requiredSkills, skills),
      referral_requirements: validateReferralReadiness(profile, { selectedSkillCount: skills.length }),
      history,
    });
  } catch (err) {
    console.error('[Admin Referral Detail]', err);
    res.status(500).json({ error: 'Failed to fetch referral request' });
  }
});

// GET /api/admin/stats - simple counts: total users, total jobs, total applications
router.get('/stats', async (req, res) => {
  try {
    const [[userCount]] = await db.query('SELECT COUNT(*) AS count FROM users');
    const [[seekerCount]] = await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'job_seeker'");
    const [[employerCount]] = await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'employer'");
    const [[pendingEmployerCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM employers WHERE approval_status = 'pending'"
    );
    const [[jobCount]] = await db.query('SELECT COUNT(*) AS count FROM job_posts');
    const [[activeJobCount]] = await db.query("SELECT COUNT(*) AS count FROM job_posts WHERE status = 'active'");
    const [[appCount]] = await db.query('SELECT COUNT(*) AS count FROM job_applications');
    const [[pendingNsrpCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM job_seekers WHERE nsrp_status IN (?)',
      [NSRP_OPEN_STATUSES]
    );
    const [[verifiedNsrpCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM job_seekers WHERE nsrp_status = 'verified'"
    );
    const [[endorsedCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM job_applications WHERE referral_status = 'peso_referred'"
    );
    const [[completeProfileCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM job_seekers WHERE profile_completed = TRUE'
    );

    res.json({
      pending_nsrp_reviews: pendingNsrpCount.count,
      verified_nsrp_profiles: verifiedNsrpCount.count,
      peso_referred_applications: endorsedCount.count,
      complete_nsrp_profiles: completeProfileCount.count,
      total_users: userCount.count,
      total_job_seekers: seekerCount.count,
      total_employers: employerCount.count,
      pending_employer_approvals: pendingEmployerCount.count,
      total_jobs: jobCount.count,
      active_jobs: activeJobCount.count,
      total_applications: appCount.count,
    });
  } catch (err) {
    console.error('[Admin Stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
