// ============================================================
// Jobs Routes - Browse, Details, Skill Match (rule-based)
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/jobs - list active jobs with search/filter
router.get('/', authenticate, async (req, res) => {
  const { search, job_type, location } = req.query;
  try {
    let sql = `
      SELECT jp.*, e.company_name, e.business_type
      FROM job_posts jp
      JOIN employers e ON e.id = jp.employer_id
      WHERE jp.status = 'active' AND e.approval_status = 'approved'
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
              e.contact_number, e.business_type
       FROM job_posts jp
       JOIN employers e ON e.id = jp.employer_id
       WHERE jp.id = ?`,
      [req.params.id]
    );
    if (jobs.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobs[0];

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
      const [js] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [req.user.id]);
      if (js.length > 0) {
        const [app] = await db.query(
          'SELECT id, application_status, applied_at FROM job_applications WHERE job_post_id = ? AND job_seeker_id = ?',
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

    const [requiredSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jrs.required_level, jrs.is_required
       FROM job_required_skills jrs
       JOIN skills s ON s.id = jrs.skill_id
       WHERE jrs.job_post_id = ?`,
      [req.params.id]
    );

    const [seekerSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss
       JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?`,
      [jsId]
    );

    const seekerSkillIds = new Set(seekerSkills.map((s) => s.id));
    const matched = requiredSkills.filter((s) => seekerSkillIds.has(s.id));
    const unmatched = requiredSkills.filter((s) => !seekerSkillIds.has(s.id));

    res.json({
      notice: 'Rule-based skill comparison only. No ranking or recommendation.',
      total_required: requiredSkills.length,
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      matched_skills: matched,
      unmatched_required_skills: unmatched,
    });
  } catch (err) {
    console.error('[Skill Match]', err);
    res.status(500).json({ error: 'Failed to compare skills' });
  }
});

module.exports = router;
