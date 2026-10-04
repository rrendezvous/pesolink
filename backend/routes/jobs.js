// ============================================================
// Jobs Routes - Browse, Details, Skill Match (rule-based)
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const { requiredMatchesFor } = require('../services/nsrpReview');
const { getSkillComparison } = require('../services/referral');

const router = express.Router();

// GET /api/jobs - list active jobs with search/filter
router.get('/', authenticate, async (req, res) => {
  const { search, job_type, location } = req.query;
  try {
    let sql = `
      SELECT jp.*, e.company_name, e.business_type
      FROM job_posts jp
      JOIN employers e ON e.id = jp.employer_id
      JOIN users eu ON eu.id = e.user_id
      WHERE jp.status = 'active' AND e.approval_status = 'approved' AND eu.account_status = 'active'
        AND (jp.closing_date IS NULL OR jp.closing_date >= CURDATE())
    `;
    const params = [];

    if (search) {
      sql += ' AND (jp.job_title LIKE ? OR jp.job_description LIKE ? OR e.company_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (job_type) {
      sql += ' AND jp.job_type = ?';
      params.push(job_type);
    }
    if (location) {
      sql += ' AND jp.location LIKE ?';
      params.push(`%${location}%`);
    }

    sql += ' ORDER BY jp.posted_at DESC';

    const [jobs] = await db.query(sql, params);
    res.json({ jobs });
  } catch (err) {
    console.error('[Jobs LIST]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - single job with required skills
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [jobs] = await db.query(
      `SELECT jp.*, e.company_name, e.company_address, e.contact_person,
              e.contact_number, e.business_type,
              (jp.status = 'active' AND eu.account_status = 'active'
               AND (jp.closing_date IS NULL OR jp.closing_date >= CURDATE())) AS accepting_applications
       FROM job_posts jp
       JOIN employers e ON e.id = jp.employer_id
       JOIN users eu ON eu.id = e.user_id
       WHERE jp.id = ?`,
      [req.params.id]
    );
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobs[0];
    job.accepting_applications = Boolean(job.accepting_applications);

    const [skills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jrs.required_level, jrs.is_required
       FROM job_required_skills jrs
       JOIN skills s ON s.id = jrs.skill_id
       WHERE jrs.job_post_id = ?`,
      [req.params.id]
    );
    job.required_skills = skills;

    // Check if current job seeker already applied
    if (req.user.role === 'job_seeker') {
      const [js] = await db.query('SELECT id, nsrp_status FROM job_seekers WHERE user_id = ?', [req.user.id]);
      if (js.length > 0) {
        job.my_nsrp_status = js[0].nsrp_status;
        const [app] = await db.query(
          'SELECT id, application_status, referral_status, referral_notes, applied_at FROM job_applications WHERE job_post_id = ? AND job_seeker_id = ?',
          [req.params.id, js[0].id]
        );
        job.my_application = app[0] || null;
      }
    }

    res.json({ job });
  } catch (err) {
    console.error('[Job GET]', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// GET /api/jobs/:id/match - rule-based skill comparison
// Returns simple comparison of matched and unmatched skills.
// Rule-based only. No ranking, recommendation, or hiring decision.
router.get('/:id/match', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'job_seeker') {
      return res.status(403).json({ error: 'Only job seekers can view skill match' });
    }

    const [jsRows] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [req.user.id]);
    if (jsRows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const jsId = jsRows[0].id;

    const comparison = await getSkillComparison(db, req.params.id, jsId);
    // Temporary minimum (MIN_SKILL_MATCHES) for applying with PESO referral, capped at the job's skill count.
    const requiredMatches = requiredMatchesFor(comparison.total_required_skills);
    res.json({
      notice: comparison.skill_comparison_notice,
      // §3.5.4: the comparison is meaningful only after the job seeker has saved (confirmed) profile skills.
      skills_confirmed: comparison.seeker_skill_count > 0,
      required_matches: requiredMatches,
      meets_minimum: comparison.matched_count >= requiredMatches,
      total_required: comparison.total_required_skills,
      matched_count: comparison.matched_count,
      unmatched_count: comparison.missing_count,
      matched_skills: comparison.matched_skills,
      unmatched_required_skills: comparison.missing_required_skills,
    });
  } catch (err) {
    console.error('[Skill Match]', err);
    res.status(500).json({ error: 'Failed to compare skills' });
  }
});

module.exports = router;
