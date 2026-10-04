// ============================================================
// PESO Admin Routes - employer approvals, monitoring, simple counts
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateReferralReadiness, parseFullData } = require('../services/nsrpProfileValidation');
const {
  REFERRAL_LABELS, OPEN_REFERRAL_STATUSES, recordHistory, notify, closeOpenReferralsForJob, buildSkillComparison,
} = require('../services/referral');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

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
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const bcrypt = require('bcryptjs');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      "INSERT INTO users (email, password_hash, role, account_status) VALUES (?, ?, 'employer', 'active')",
      [email, passwordHash]
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

// GET /api/admin/job-seekers
router.get('/job-seekers', async (req, res) => {
  try {
    const [seekers] = await db.query(
      `SELECT js.*, u.email, u.account_status, u.created_at AS registered_at
       FROM job_seekers js JOIN users u ON u.id = js.user_id
       ORDER BY js.created_at DESC`
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
      `SELECT js.*, u.email, u.account_status, u.created_at AS registered_at
       FROM job_seekers js
       JOIN users u ON u.id = js.user_id
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

    res.json({ profile, skills, applications, referral_requirements: referralRequirements });
  } catch (err) {
    console.error('[Admin Seeker Profile]', err);
    res.status(500).json({ error: 'Failed to fetch job seeker profile' });
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
    await closeOpenReferralsForJob(conn, job.id, req.user.id, job.job_title);

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

// GET /api/admin/applications - PESO referral requests across all job posts
router.get('/applications', async (req, res) => {
  try {
    const [apps] = await db.query(
      `SELECT ja.*, jp.job_title, jp.location, jp.status AS job_status, e.company_name,
              js.first_name, js.last_name, js.profile_completed, u.email AS seeker_email
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       JOIN users u ON u.id = js.user_id
       ORDER BY FIELD(ja.referral_status, 'submitted', 'for_review') DESC, ja.updated_at DESC`
    );
    res.json({ applications: apps });
  } catch (err) {
    console.error('[Admin Apps]', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET /api/admin/applications/:id - referral request with the applicant's full NSRP profile
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

// PUT /api/admin/applications/:id/referral-status - PESO Admin's referral decision
//   for_review    - recorded when PESO opens the request (no-op once already reviewed)
//   peso_referred - endorse: the applicant becomes visible to the employer
//   rejected      - not endorsed (reason required); the job seeker may fix the profile and request again
//   closed        - request no longer needed
// Only undecided requests (submitted / for_review) can change; after endorsement the employer owns the record.
router.put('/applications/:id/referral-status', async (req, res) => {
  const { referral_status: next, notes } = req.body;
  if (!['for_review', 'peso_referred', 'rejected', 'closed'].includes(next)) {
    return res.status(400).json({ error: 'referral_status must be for_review, peso_referred, rejected, or closed' });
  }
  const reason = String(notes || '').trim();
  if (next === 'rejected' && !reason) {
    return res.status(400).json({ error: 'Please give the job seeker a reason for the rejection' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [apps] = await conn.query(
      `SELECT ja.*, jp.job_title, e.user_id AS employer_user_id, e.company_name,
              js.user_id AS seeker_user_id, js.first_name, js.last_name
       FROM job_applications ja
       JOIN job_posts jp ON jp.id = ja.job_post_id
       JOIN employers e ON e.id = jp.employer_id
       JOIN job_seekers js ON js.id = ja.job_seeker_id
       WHERE ja.id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Referral request not found' });
    }
    const app = apps[0];
    const current = app.referral_status;

    if (next === 'for_review' && current !== 'submitted') {
      await conn.rollback();
      return res.json({ message: 'Referral request already reviewed', referral_status: current });
    }
    if (!OPEN_REFERRAL_STATUSES.includes(current)) {
      await conn.rollback();
      return res.status(400).json({
        error: `This referral request is already ${REFERRAL_LABELS[current]} and can no longer be changed`,
      });
    }

    await conn.query(
      `UPDATE job_applications
       SET referral_status = ?, referral_notes = ?, referral_reviewed_by = ?, referral_reviewed_at = NOW()
           ${next === 'peso_referred' ? ", application_status = 'for_review'" : ''}
       WHERE id = ?`,
      [next, reason || null, req.user.id, app.id]
    );
    await recordHistory(conn, {
      applicationId: app.id,
      type: 'referral',
      oldStatus: current,
      newStatus: next,
      changedBy: req.user.id,
      notes: {
        for_review: 'PESO is reviewing the NSRP profile',
        peso_referred: `Endorsed to ${app.company_name}${reason ? ` - ${reason}` : ''}`,
        rejected: reason,
        closed: reason || 'Closed by PESO Admin',
      }[next],
    });

    const job = `"${app.job_title}"`;
    const seekerMessage = {
      for_review: [
        'Referral Request For Review',
        `PESO Misamis Oriental is now reviewing your NSRP profile for ${job}.`,
      ],
      peso_referred: [
        'Application PESO-Referred',
        `PESO Misamis Oriental endorsed your application for ${job} to ${app.company_name}. This is not a hiring decision; the employer will update your status.`,
      ],
      rejected: [
        'Referral Request Not Endorsed',
        `PESO did not endorse your referral request for ${job}. Reason: ${reason}. You may update your NSRP profile and request again.`,
      ],
      closed: [
        'Referral Request Closed',
        `Your PESO referral request for ${job} was closed.${reason ? ` Note: ${reason}` : ''}`,
      ],
    }[next];
    await notify(conn, app.seeker_user_id, seekerMessage[0], seekerMessage[1], 'referral_status', app.id);

    // Routing step: the employer first learns about the applicant at endorsement.
    if (next === 'peso_referred') {
      await notify(
        conn,
        app.employer_user_id,
        'New PESO-Referred Applicant',
        `PESO Misamis Oriental endorsed ${app.first_name} ${app.last_name} for ${job}.${reason ? ` Note: ${reason}` : ''}`,
        'peso_referral',
        app.id
      );
    }

    await conn.commit();
    res.json({ message: `Referral request marked ${REFERRAL_LABELS[next]}`, referral_status: next });
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Referral Status]', err);
    res.status(500).json({ error: 'Failed to update referral request' });
  } finally {
    conn.release();
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
    const [[pendingReferralCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM job_applications WHERE referral_status IN (?)',
      [OPEN_REFERRAL_STATUSES]
    );
    const [[endorsedCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM job_applications WHERE referral_status = 'peso_referred'"
    );
    const [[completeProfileCount]] = await db.query(
      'SELECT COUNT(*) AS count FROM job_seekers WHERE profile_completed = TRUE'
    );

    res.json({
      pending_referral_requests: pendingReferralCount.count,
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
