'use strict';

const { syncNsrpStatusAfterEdit } = require('./nsrpReview');

function parseFullData(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

function hasAny(...values) {
  return values.some(hasText);
}

function normalizeProfile(profile = {}) {
  return {
    ...profile,
    nsrp_full_data: parseFullData(profile.nsrp_full_data),
  };
}

function validateReferralReadiness(profile = {}) {
  const normalized = normalizeProfile(profile);
  const full = normalized.nsrp_full_data || {};

  // Required items confirmed by PESO Misamis Oriental (written answers, 2026-10-31); every other NSRP item is optional.
  const checks = [
    { key: 'last_name', label: 'Surname', ok: hasText(normalized.last_name) },
    { key: 'first_name', label: 'First name', ok: hasText(normalized.first_name) },
    { key: 'date_of_birth', label: 'Date of birth', ok: hasText(normalized.date_of_birth) },
    { key: 'gender', label: 'Sex', ok: hasText(normalized.gender) },
    { key: 'religion', label: 'Religion', ok: hasText(full.religion) },
    { key: 'civil_status', label: 'Civil status', ok: hasText(normalized.civil_status) },
    { key: 'address', label: 'Present address or house/street/barangay', ok: hasAny(normalized.address, full.house_street) && hasAny(full.barangay, normalized.address) },
    { key: 'city', label: 'City/Municipality', ok: hasText(normalized.city) },
    { key: 'province', label: 'Province', ok: hasText(normalized.province) },
    { key: 'height', label: 'Height', ok: hasText(full.height) },
    { key: 'contact_number', label: 'Contact number or cellphone number', ok: hasAny(normalized.contact_number, full.cell_phone_number, full.landline_number) },
    { key: 'email_address', label: 'Email address', ok: hasText(full.email_address) },
    { key: 'employment_status', label: 'Employment status', ok: hasText(normalized.employment_status) },
    { key: 'education', label: 'Educational background', ok: hasAny(normalized.education_level, normalized.course, full.elementary_background, full.secondary_background, full.tertiary_background, full.graduate_studies_background) },
    { key: 'preferred_occupation', label: 'Preferred occupation', ok: hasAny(normalized.preferred_occupation, full.preferred_occupations) },
    { key: 'preferred_work_location', label: 'Preferred work location', ok: hasAny(full.preferred_work_location, full.preferred_local_locations, full.preferred_overseas_locations) },
  ];

  const missing = checks.filter((check) => !check.ok).map(({ key, label }) => ({ key, label }));
  return {
    isComplete: missing.length === 0,
    missing_fields: missing.map((item) => item.label),
    missing,
    required_count: checks.length,
    filled_count: checks.length - missing.length,
  };
}

// Recompute job_seekers.profile_completed from the full NSRP readiness check, and send a
// changed PESO-verified profile back to PESO for re-checking.
// `queryable` is the db pool or an open transaction connection.
// `before` (optional): fingerprints of the profile taken just before the save (see fingerprintsBeforeEdit).
async function refreshProfileCompleted(queryable, jobSeekerId, before = null) {
  const [rows] = await queryable.query('SELECT * FROM job_seekers WHERE id = ?', [jobSeekerId]);
  if (rows.length === 0) return null;
  const result = validateReferralReadiness(rows[0]);
  await queryable.query('UPDATE job_seekers SET profile_completed = ? WHERE id = ?', [result.isComplete, jobSeekerId]);
  result.nsrp_status_changed_to = await syncNsrpStatusAfterEdit(queryable, jobSeekerId, result, before);
  return result;
}

module.exports = {
  validateReferralReadiness,
  refreshProfileCompleted,
  parseFullData,
};
