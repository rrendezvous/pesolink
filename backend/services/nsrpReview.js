'use strict';

// ============================================================
// One-time PESO verification of the job seeker's NSRP profile
// NSRP status (PESO Admin): not_submitted -> submitted -> for_review -> verified | needs_revision
// - A verified seeker can apply to any job with one tap; the application reaches the employer
//   as PESO-Referred because PESO already verified the NSRP profile.
// - Any change to a verified NSRP profile sends it back to PESO (submitted) for re-checking.
// ============================================================
const crypto = require('crypto');
const { notify } = require('./referral');

const NSRP_STATUS_LABELS = {
  not_submitted: 'Not Submitted',
  submitted: 'Submitted',
  for_review: 'For Review',
  verified: 'PESO-Verified',
  needs_revision: 'Needs Revision',
};

// Waiting on PESO.
const NSRP_OPEN_STATUSES = ['submitted', 'for_review'];

// Temporary minimum skill-match rule until PESO Misamis Oriental confirms its own rule.
// Capped at the job's own required-skill count, so a job listing 2 skills needs 2 matches
// and a job with no required skills needs none. Set MIN_SKILL_MATCHES=0 to turn it off.
function minSkillMatches() {
  const value = Number.parseInt(process.env.MIN_SKILL_MATCHES ?? '3', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function requiredMatchesFor(totalRequiredSkills) {
  return Math.min(minSkillMatches(), totalRequiredSkills);
}

const NSRP_COLUMNS = [
  'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender', 'civil_status',
  'contact_number', 'address', 'city', 'province', 'education_level', 'course',
  'years_of_experience', 'employment_status', 'preferred_occupation',
];

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

// Blank values don't count as changes (the profile form sends empty strings for untouched fields).
function withoutBlanks(value) {
  if (Array.isArray(value)) {
    const items = value.map(withoutBlanks).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, withoutBlanks(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

// Fingerprint of everything PESO verifies: NSRP fields, extended NSRP data, and skills.
async function nsrpFingerprint(queryable, jobSeekerId) {
  const [rows] = await queryable.query('SELECT * FROM job_seekers WHERE id = ?', [jobSeekerId]);
  if (rows.length === 0) return null;
  const profile = rows[0];
  const [skills] = await queryable.query(
    'SELECT skill_id, proficiency_level FROM job_seeker_skills WHERE job_seeker_id = ? ORDER BY skill_id',
    [jobSeekerId]
  );
  const data = withoutBlanks({
    fields: Object.fromEntries(NSRP_COLUMNS.map((column) => [column, profile[column]])),
    full: parseJson(profile.nsrp_full_data),
    skills: skills.map((skill) => `${skill.skill_id}:${skill.proficiency_level}`),
  }) || {};
  return crypto.createHash('sha256').update(stableStringify(data)).digest('hex');
}

// Called after every NSRP save (profile form, OCR confirm, skills).
// - Verified profile changed -> back to PESO for re-checking (or not submitted if now incomplete).
// - Waiting profile became incomplete -> not submitted.
// Returns the new status when it changed, otherwise null.
async function syncNsrpStatusAfterEdit(queryable, jobSeekerId, requirements) {
  const [rows] = await queryable.query(
    'SELECT id, user_id, first_name, last_name, nsrp_status, nsrp_reviewed_hash FROM job_seekers WHERE id = ?',
    [jobSeekerId]
  );
  if (rows.length === 0) return null;
  const seeker = rows[0];
  const isComplete = Boolean(requirements?.isComplete);

  if (seeker.nsrp_status === 'verified') {
    const current = await nsrpFingerprint(queryable, jobSeekerId);
    if (current === seeker.nsrp_reviewed_hash) return null;
    const next = isComplete ? 'submitted' : 'not_submitted';
    await queryable.query(
      `UPDATE job_seekers
       SET nsrp_status = ?, nsrp_review_notes = NULL, nsrp_submitted_at = ${next === 'submitted' ? 'NOW()' : 'NULL'}
       WHERE id = ?`,
      [next, jobSeekerId]
    );
    await notify(
      queryable,
      seeker.user_id,
      'NSRP Profile Sent Back to PESO',
      next === 'submitted'
        ? 'You changed your PESO-verified NSRP profile, so it was sent to PESO for re-checking. You can apply with PESO referral again once PESO verifies it.'
        : 'You changed your PESO-verified NSRP profile and some required items are now missing. Complete them and submit your NSRP profile to PESO again.',
      'nsrp_review',
      jobSeekerId,
      'job_seeker'
    );
    if (next === 'submitted') {
      await notifyAdminsOfSubmission(queryable, seeker, 'NSRP Profile Updated', 'updated their verified NSRP profile. Please re-check it.');
    }
    return next;
  }

  if (NSRP_OPEN_STATUSES.includes(seeker.nsrp_status) && !isComplete) {
    await queryable.query(
      "UPDATE job_seekers SET nsrp_status = 'not_submitted', nsrp_submitted_at = NULL WHERE id = ?",
      [jobSeekerId]
    );
    return 'not_submitted';
  }
  return null;
}

async function notifyAdminsOfSubmission(queryable, seeker, title, action) {
  await queryable.query(
    `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
     SELECT id, ?, ?, 'nsrp_review', ?, 'job_seeker'
     FROM users WHERE role = 'admin' AND account_status = 'active'`,
    [title, `${seeker.first_name || ''} ${seeker.last_name || ''}`.trim() + ` ${action}`, seeker.id]
  );
}

module.exports = {
  NSRP_STATUS_LABELS,
  NSRP_OPEN_STATUSES,
  minSkillMatches,
  requiredMatchesFor,
  nsrpFingerprint,
  syncNsrpStatusAfterEdit,
  notifyAdminsOfSubmission,
};
