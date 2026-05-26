'use strict';

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

function validateReferralReadiness(profile = {}, options = {}) {
  const normalized = normalizeProfile(profile);
  const full = normalized.nsrp_full_data || {};
  const selectedSkillCount = Number(options.selectedSkillCount || 0);

  const checks = [
    { key: 'first_name', label: 'First name', ok: hasText(normalized.first_name) },
    { key: 'last_name', label: 'Last name', ok: hasText(normalized.last_name) },
    { key: 'date_of_birth', label: 'Date of birth', ok: hasText(normalized.date_of_birth) },
    { key: 'place_of_birth', label: 'Place of birth', ok: hasText(full.place_of_birth) },
    { key: 'gender', label: 'Gender', ok: hasText(normalized.gender) },
    { key: 'civil_status', label: 'Civil status', ok: hasText(normalized.civil_status) },
    { key: 'contact_number', label: 'Contact number or cellphone number', ok: hasAny(normalized.contact_number, full.cell_phone_number) },
    { key: 'address', label: 'Present address or house/street/barangay', ok: hasAny(normalized.address, full.house_street) && hasAny(full.barangay, normalized.address) },
    { key: 'city', label: 'City/Municipality', ok: hasText(normalized.city) },
    { key: 'province', label: 'Province', ok: hasText(normalized.province) },
    { key: 'employment_status', label: 'Employment status', ok: hasText(normalized.employment_status) },
    { key: 'employment_type', label: 'Employment type', ok: hasText(full.employment_type) },
    { key: 'looking_for_work', label: 'Actively looking for work', ok: hasText(full.looking_for_work) },
    { key: 'willing_to_work_immediately', label: 'Willing to work immediately', ok: hasText(full.willing_to_work_immediately) },
    { key: 'four_ps_beneficiary', label: '4Ps beneficiary answer', ok: hasText(full.four_ps_beneficiary) },
    { key: 'education', label: 'Educational background', ok: hasAny(normalized.education_level, normalized.course, full.elementary_background, full.secondary_background, full.tertiary_background, full.graduate_studies_background) },
    { key: 'preferred_occupation', label: 'Preferred occupation', ok: hasAny(normalized.preferred_occupation, full.preferred_occupations) },
    { key: 'preferred_work_location', label: 'Preferred work location', ok: hasAny(full.preferred_work_location, full.preferred_local_locations, full.preferred_overseas_locations) },
    { key: 'skills', label: 'At least one skill, training, or work experience', ok: selectedSkillCount > 0 || hasAny(full.other_skills_acquired, full.trainings, full.eligibility_license, full.work_experience) },
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

module.exports = {
  validateReferralReadiness,
  parseFullData,
};
