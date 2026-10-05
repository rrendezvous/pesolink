'use strict';

// ============================================================
// NSRP Form 1 (DOLE, January 2017) structure
// The app stores the form's tables as structured rows in nsrp_full_data and keeps the older
// summary text fields (elementary_background, trainings, work_experience, ...) filled from them,
// so the required-items check, employer/admin views, and older profiles keep working.
// Summary text is only rebuilt when the structured rows have content, so profiles encoded
// before this structure keep their free-text answers.
// ============================================================

const EDUCATION_LEVELS = [
  { key: 'elementary', label: 'Elementary', legacy: 'elementary_background' },
  { key: 'secondary', label: 'Secondary', legacy: 'secondary_background' },
  { key: 'tertiary', label: 'Tertiary', legacy: 'tertiary_background' },
  { key: 'graduate', label: 'Graduate Studies', legacy: 'graduate_studies_background' },
];

const LANGUAGES = [
  { key: 'english', label: 'English' },
  { key: 'filipino', label: 'Filipino' },
  { key: 'other', label: 'Others' },
];
const LANGUAGE_SKILLS = ['read', 'write', 'speak', 'understand'];

const text = (v) => String(v ?? '').trim();
const filled = (obj) => Object.values(obj || {}).some((v) => (typeof v === 'boolean' ? v : text(v) !== ''));
const rowsOf = (rows) => (Array.isArray(rows) ? rows.filter(filled) : []);
const join = (parts, sep = ', ') => parts.map(text).filter(Boolean).join(sep);

function educationLine(level, row) {
  return join([
    row.school,
    row.course,
    text(row.year_graduated) && `Graduated ${text(row.year_graduated)}`,
    text(row.level_reached) && `Level reached: ${text(row.level_reached)}`,
    text(row.year_last_attended) && `Last attended ${text(row.year_last_attended)}`,
    text(row.awards) && `Awards: ${text(row.awards)}`,
  ]);
}

// Fills summary fields from the structured form rows. `profile` has the base columns plus nsrp_full_data.
function normalizeNsrpProfile(profile) {
  const full = { ...(profile.nsrp_full_data || {}) };
  const base = { ...profile };

  // I. Personal information: the summary address and contact number follow the form's own fields.
  // (Checklist summaries such as disability and other skills are written by the app with the checklist.)
  const street = join([full.house_street, full.village, full.barangay]);
  if (street) base.address = street;
  const phone = text(full.cell_phone_number) || text(full.landline_number);
  if (phone) base.contact_number = phone;

  // II. Job preference
  if (Array.isArray(full.preferred_occupation_list) && full.preferred_occupation_list.some(text)) {
    const list = full.preferred_occupation_list.map(text).filter(Boolean);
    full.preferred_occupations = list.join('\n');
    base.preferred_occupation = list[0];
  }
  if (Array.isArray(full.local_location_list) && full.local_location_list.some(text)) {
    full.preferred_local_locations = full.local_location_list.map(text).filter(Boolean).join('\n');
  }
  if (Array.isArray(full.overseas_location_list) && full.overseas_location_list.some(text)) {
    full.preferred_overseas_locations = full.overseas_location_list.map(text).filter(Boolean).join('\n');
  }

  // III. Language / dialect proficiency
  if (full.languages && typeof full.languages === 'object') {
    const lines = LANGUAGES.map(({ key, label }) => {
      const row = full.languages[key] || {};
      const skills = LANGUAGE_SKILLS.filter((s) => row[s]);
      const name = key === 'other' ? text(row.name) : label;
      return name && skills.length ? `${name}: ${skills.join(', ')}` : '';
    }).filter(Boolean);
    if (lines.length) {
      full.language_dialect = lines.map((l) => l.split(':')[0]).join(', ');
      full.language_proficiency = lines.join('\n');
    }
  }

  // IV. Educational background
  if (full.education && typeof full.education === 'object') {
    let highest = null;
    for (const level of EDUCATION_LEVELS) {
      const row = full.education[level.key] || {};
      if (filled(row)) {
        full[level.legacy] = educationLine(level.label, row);
        highest = { level, row };
      }
    }
    if (highest) {
      const undergrad = text(highest.row.level_reached) && !text(highest.row.year_graduated);
      base.education_level = `${highest.level.label}${undergrad ? ' (undergraduate)' : ' graduate'}`;
      if (text(highest.row.course)) base.course = text(highest.row.course);
    }
  }

  // V-VII. Training, eligibility / license, work experience
  const training = rowsOf(full.training_rows);
  if (training.length) {
    full.trainings = training.map((r) => join([r.course, r.duration, r.institution, text(r.certificate) && `Certificate: ${text(r.certificate)}`])).join('\n');
  }
  const eligibility = rowsOf(full.eligibility_rows);
  const licenses = rowsOf(full.license_rows);
  if (eligibility.length || licenses.length) {
    full.eligibility_license = [
      ...eligibility.map((r) => join([r.eligibility, text(r.rating) && `Rating ${text(r.rating)}`, text(r.exam_date) && `Exam ${text(r.exam_date)}`])),
      ...licenses.map((r) => join([r.license, text(r.valid_until) && `Valid until ${text(r.valid_until)}`])),
    ].join('\n');
  }
  const work = rowsOf(full.work_rows);
  if (work.length) {
    full.work_experience = work.map((r) => join([r.company, r.address, r.position, r.dates, r.status])).join('\n');
  }

  base.nsrp_full_data = full;
  return base;
}

// Date of birth is entered as YYYY-MM-DD and must be a real calendar date (MySQL rejects 2000-13-40).
// Returns an error message, or null when the value is blank or valid.
function dateOfBirthError(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    return 'Date of birth must be a real date written as YYYY-MM-DD (for example 2000-05-14)';
  }
  return null;
}

// Base columns the app fills from other NSRP fields; left out of the change fingerprint so that
// re-deriving them never counts as the job seeker changing their profile.
const DERIVED_COLUMNS = ['address', 'contact_number', 'education_level', 'course', 'preferred_occupation'];

module.exports = {
  normalizeNsrpProfile, EDUCATION_LEVELS, LANGUAGES, LANGUAGE_SKILLS, DERIVED_COLUMNS, dateOfBirthError,
};
