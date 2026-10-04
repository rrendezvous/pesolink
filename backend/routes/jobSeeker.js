// ============================================================
// Job Seeker Profile Routes
// ============================================================
const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateReferralReadiness, refreshProfileCompleted } = require('../services/nsrpProfileValidation');
const { NSRP_STATUS_LABELS, notifyAdminsOfSubmission } = require('../services/nsrpReview');

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

    await db.query(
      `UPDATE job_seekers SET
         first_name=?, middle_name=?, last_name=?, date_of_birth=?, gender=?,
         civil_status=?, contact_number=?, address=?, city=?, province=?,
         education_level=?, course=?, years_of_experience=?, employment_status=?,
         preferred_occupation=?, nsrp_full_data=?
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
        jsId,
      ]
    );

    // "Profile complete" means all required NSRP fields are filled - the gate for submitting the NSRP to PESO.
    // A change to a PESO-verified profile sends it back to PESO for re-checking.
    const referralRequirements = await refreshProfileCompleted(db, jsId);

    const [updated] = await db.query('SELECT * FROM job_seekers WHERE id = ?', [jsId]);
    res.json({
      message: 'Profile updated',
      profile: updated[0],
      referral_requirements: referralRequirements,
      nsrp_status_changed_to: referralRequirements.nsrp_status_changed_to,
    });
  } catch (err) {
    console.error('[Profile POST]', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/job-seeker/profile/submit-nsrp - send the completed NSRP profile to PESO for one-time verification
router.post('/profile/submit-nsrp', async (req, res) => {
  try {
    const jsId = await getJobSeekerId(req.user.id);
    if (!jsId) return res.status(404).json({ error: 'Profile not found' });

    const requirements = await refreshProfileCompleted(db, jsId);
    if (!requirements.isComplete) {
      return res.status(400).json({
        error: 'Complete the required NSRP profile fields before submitting to PESO',
        missing_fields: requirements.missing_fields,
      });
    }

    const [rows] = await db.query('SELECT * FROM job_seekers WHERE id = ?', [jsId]);
    const seeker = rows[0];
    if (!['not_submitted', 'needs_revision'].includes(seeker.nsrp_status)) {
      return res.status(409).json({
        error: `Your NSRP profile is already ${NSRP_STATUS_LABELS[seeker.nsrp_status]}`,
        nsrp_status: seeker.nsrp_status,
      });
    }

    await db.query(
      "UPDATE job_seekers SET nsrp_status = 'submitted', nsrp_submitted_at = NOW(), nsrp_review_notes = NULL WHERE id = ?",
      [jsId]
    );
    await notifyAdminsOfSubmission(
      db,
      seeker,
      seeker.nsrp_status === 'needs_revision' ? 'NSRP Profile Resubmitted' : 'New NSRP Profile Submitted',
      seeker.nsrp_status === 'needs_revision'
        ? 'revised and resubmitted their NSRP profile for PESO verification.'
        : 'submitted their NSRP profile for PESO verification.'
    );

    res.json({ message: 'NSRP profile submitted to PESO for verification', nsrp_status: 'submitted' });
  } catch (err) {
    console.error('[Submit NSRP]', err);
    res.status(500).json({ error: 'Failed to submit NSRP profile' });
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
    // Skills are one of the NSRP review requirements, so completeness can change here too.
    const requirements = await refreshProfileCompleted(conn, jsId);
    await conn.commit();

    const [savedSkills] = await db.query(
      `SELECT s.id, s.skill_name, s.category, jss.proficiency_level
       FROM job_seeker_skills jss
       JOIN skills s ON s.id = jss.skill_id
       WHERE jss.job_seeker_id = ?`,
      [jsId]
    );
    res.json({ message: 'Skills updated', skills: savedSkills, nsrp_status_changed_to: requirements.nsrp_status_changed_to });
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
    const requirements = await refreshProfileCompleted(db, jsId);
    res.json({ message: 'Skill removed', nsrp_status_changed_to: requirements.nsrp_status_changed_to });
  } catch (err) {
    console.error('[Skills DELETE]', err);
    res.status(500).json({ error: 'Failed to remove skill' });
  }
});

module.exports = router;
