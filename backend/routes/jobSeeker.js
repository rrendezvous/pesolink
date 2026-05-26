// ============================================================
// Job Seeker Profile Routes
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateReferralReadiness } = require('../services/nsrpProfileValidation');

const router = express.Router();

router.use(authenticate, requireRole('job_seeker'));

// Helper: get job_seeker_id from user_id
async function getJobSeekerId(userId) {
  const [rows] = await db.query('SELECT id FROM job_seekers WHERE user_id = ?', [userId]);
  return rows[0]?.id || null;
}

// GET /api/job-seeker/profile - get full profile with skills
router.get('/profile', async (req, res) => {
  try {
    const [profileRows] = await db.query(
      'SELECT * FROM job_seekers WHERE user_id = ?',
      [req.user.id]
    );
    if (profileRows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const profile = profileRows[0];

    const [skills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss
       JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?`,
      [profile.id]
    );
    const referralRequirements = validateReferralReadiness(profile, { selectedSkillCount: skills.length });

    res.json({ profile, skills, referral_requirements: referralRequirements });
  } catch (err) {
    console.error('[Profile GET]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/job-seeker/profile - create/update NSRP profile
router.post('/profile', async (req, res) => {
  const {
    first_name,
    middle_name,
    last_name,
    date_of_birth,
    gender,
    civil_status,
    contact_number,
    address,
    city,
    province,
    education_level,
    course,
    years_of_experience,
    employment_status,
    preferred_occupation,
    nsrp_full_data,
  } = req.body;

  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    const profileCompleted = !!(first_name && last_name && date_of_birth && contact_number && city);

    const [[current]] = await db.query('SELECT referral_status FROM job_seekers WHERE id = ?', [jsId]);
    const nextReferralStatus = current?.referral_status === 'submitted' ? 'submitted' : 'draft';

    await db.query(
      `UPDATE job_seekers SET
         first_name=?, middle_name=?, last_name=?, date_of_birth=?, gender=?,
         civil_status=?, contact_number=?, address=?, city=?, province=?,
         education_level=?, course=?, years_of_experience=?, employment_status=?,
         preferred_occupation=?, nsrp_full_data=?, profile_completed=?, referral_status=?, referral_review_notes=NULL,
         referral_reviewed_by=NULL, referral_reviewed_at=NULL
       WHERE id=?`,
      [
        first_name || null,
        middle_name || null,
        last_name || null,
        date_of_birth || null,
        gender || null,
        civil_status || null,
        contact_number || null,
        address || null,
        city || null,
        province || null,
        education_level || null,
        course || null,
        years_of_experience || 0,
        employment_status || null,
        preferred_occupation || null,
        nsrp_full_data ? JSON.stringify(nsrp_full_data) : null,
        profileCompleted,
        nextReferralStatus,
        jsId,
      ]
    );

    const [updated] = await db.query('SELECT * FROM job_seekers WHERE id = ?', [jsId]);
    res.json({ message: 'Profile updated', profile: updated[0] });
  } catch (err) {
    console.error('[Profile POST]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/job-seeker/profile/submit-referral - submit NSRP profile for PESO review
router.post('/profile/submit-referral', async (req, res) => {
  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    const [rows] = await db.query('SELECT * FROM job_seekers WHERE id = ?', [jsId]);
    const profile = rows[0];
    const [[skillCountRow]] = await db.query(
      'SELECT COUNT(*) AS count FROM job_seeker_skills WHERE job_seeker_id = ?',
      [jsId]
    );
    const referralRequirements = validateReferralReadiness(profile, { selectedSkillCount: skillCountRow?.count || 0 });
    if (!referralRequirements.isComplete) {
      return res.status(400).json({
        error: 'Complete the required NSRP fields before submitting for PESO review',
        missing_fields: referralRequirements.missing_fields,
        missing_count: referralRequirements.missing.length,
        required_count: referralRequirements.required_count,
        filled_count: referralRequirements.filled_count,
      });
    }

    await db.query(
      `UPDATE job_seekers
       SET referral_status='submitted', referral_review_notes=NULL,
           referral_reviewed_by=NULL, referral_reviewed_at=NULL
       WHERE id=?`,
      [jsId]
    );

    res.json({ message: 'NSRP profile submitted for PESO review', referral_status: 'submitted' });
  } catch (err) {
    console.error('[Referral Submit]', err);
    res.status(500).json({ error: 'Failed to submit profile for review' });
  }
});

// POST /api/job-seeker/skills - replace skill set
router.post('/skills', async (req, res) => {
  const { skills } = req.body; // [{ skill_id, proficiency_level }]
  if (!Array.isArray(skills)) {
    return res.status(400).json({ error: 'skills must be an array' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) {
      await conn.rollback();
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Replace existing
    await conn.query('DELETE FROM job_seeker_skills WHERE job_seeker_id = ?', [jsId]);
    for (const s of skills) {
      if (!s.skill_id) continue;
      await conn.query(
        `INSERT INTO job_seeker_skills (job_seeker_id, skill_id, proficiency_level)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level)`,
        [jsId, s.skill_id, s.proficiency_level || 'beginner']
      );
    }
    await conn.commit();

    const [savedSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss
       JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?`,
      [jsId]
    );
    res.json({ message: 'Skills updated', skills: savedSkills });
  } catch (err) {
    await conn.rollback();
    console.error('[Skills POST]', err);
    res.status(500).json({ error: 'Failed to update skills' });
  } finally {
    conn.release();
  }
});

// DELETE /api/job-seeker/skills/:skillId
router.delete('/skills/:skillId', async (req, res) => {
  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    await db.query(
      'DELETE FROM job_seeker_skills WHERE job_seeker_id = ? AND skill_id = ?',
      [jsId, req.params.skillId]
    );
    res.json({ message: 'Skill removed' });
  } catch (err) {
    console.error('[Skills DELETE]', err);
    res.status(500).json({ error: 'Failed to remove skill' });
  }
});

module.exports = router;
